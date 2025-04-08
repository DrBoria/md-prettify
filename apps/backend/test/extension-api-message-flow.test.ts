import * as assert from 'assert';
import { Module } from 'module';

/**
 * Integration test for the api message flow: a command dispatched through the
 * fake vscode host reaches the real backend handler, and the reply/state comes
 * back through the mdPrettify activation api.
 *
 * Uses the real compiled backend behind a fake host (deterministic — no network,
 * no real VS Code). Lives in apps/backend/test and is run by the extension's own
 * `test` script; self-skips when the compiled adapter is not present.
 */

type Listener = (payload: unknown) => void;
const pushListener = (m: Map<string, Listener[]>, key: string, cb: Listener): void => {
  const arr = m.get(key) ?? [];
  arr.push(cb);
  m.set(key, arr);
};

// Shared across the extension-*.test.ts files: the compiled adapter is cached
// by require() and holds the FIRST fake it was patched with, so every test file
// must assert against the SAME fake object (stored on globalThis).
const sharedFake: unknown = (globalThis as Record<string, unknown>).mdPrettifyFake ?? null;

type FakeShape = {
  commands: { registry: Map<string, (...args: unknown[]) => unknown> };
  workspace: { listeners: Map<string, ((d: unknown) => void)[]> };
};

const fake = (sharedFake ?? {
  commands: {
    registry: new Map<string, (...args: unknown[]) => unknown>(),
    registerCommand(id: string, cb: (...args: unknown[]) => unknown) {
      this.registry.set(id, cb);
      return { dispose: () => this.registry.delete(id) };
    },
    executeCommand: () => Promise.resolve(),
  },
  workspace: {
    textDocuments: [] as unknown[],
    getConfiguration: () => ({}),
    workspaceFolders: undefined,
    listeners: new Map<string, Listener[]>(),
    onDidOpenTextDocument(cb: Listener) {
      pushListener(this.listeners, 'onDidOpenTextDocument', cb);
      return { dispose: () => {} };
    },
    onDidCloseTextDocument(cb: Listener) {
      pushListener(this.listeners, 'onDidCloseTextDocument', cb);
      return { dispose: () => {} };
    },
    onDidChangeTextDocument(cb: Listener) {
      pushListener(this.listeners, 'onDidChangeTextDocument', cb);
      return { dispose: () => {} };
    },
    onDidChangeConfiguration(cb: Listener) {
      pushListener(this.listeners, 'onDidChangeConfiguration', cb);
      return { dispose: () => {} };
    },
  },
  window: {
    visibleTextEditors: [] as unknown[],
    activeTextEditor: null,
    state: { focused: true },
    listeners: new Map<string, Listener[]>(),
    onDidChangeActiveTextEditor(cb: Listener) {
      pushListener(this.listeners, 'onDidChangeActiveTextEditor', cb);
      return { dispose: () => {} };
    },
    onDidChangeTextEditorSelection(cb: Listener) {
      pushListener(this.listeners, 'onDidChangeTextEditorSelection', cb);
      return { dispose: () => {} };
    },
    createOutputChannel(name: string) {
      return { name, lines: [] as string[], appendLine(v: string) { this.lines.push(v); }, dispose() {} };
    },
    createTextEditorDecorationType() {
      return { dispose() {} };
    },
  },
  languages: { match: () => 0 },
  extensions: { all: [] as unknown[] },
  env: { clipboard: { writeText: () => Promise.resolve() } },
  Uri: {
    parse: (v: string) => ({ fsPath: v, toString: () => v }),
    joinPath: (base: { fsPath: string }, p: string) => ({ fsPath: `${base.fsPath}/${p}` }),
  },
  DecorationRangeBehavior: { OpenOpen: 1, ClosedClosed: 2, OpenClosed: 3, ClosedOpen: 4 },
}) as FakeShape;
if (!sharedFake) (globalThis as Record<string, unknown>).mdPrettifyFake = fake;

class FakeDevtoolServer {
  static stopGlobalInstance(): Promise<void> {
    return Promise.resolve();
  }
  start(): Promise<void> {
    return Promise.resolve();
  }
}

interface Loadable {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
}
const patch = (id: string, mod: unknown): void => {
  const M = Module as typeof Module & Loadable;
  const orig = M._load;
  M._load = (request: string, parent: unknown, isMain: boolean) =>
    request === id ? mod : orig(request, parent, isMain);
};
patch('vscode', fake);
patch('vscode-extension-devtool-mcp', { DevtoolServer: FakeDevtoolServer });

const hasAdapter = (() => {
  try {
    require('../../../packages/vscode-extension/activate.js');
    return true;
  } catch {
    return false;
  }
})();
const s = hasAdapter ? suite : suite.skip.bind(suite);

s('extension api message flow', () => {
  if (!hasAdapter) return;
  const { activate, deactivate } = (() => require('../../../packages/vscode-extension/activate.js'))();

  test('a command through the host reaches the backend and the reply comes back', () => {
    const context: { subscriptions: { dispose?: () => void }[] } = { subscriptions: [] };
    const api = activate(context);

    const events: boolean[] = [];
    const handler = api.onDidEnabledChange((enabled) => events.push(enabled));
    assert.strictEqual(typeof handler.dispose, 'function', 'onDidEnabledChange returns a disposable');

    assert.strictEqual(api.isEnabled(), true, 'starts enabled');

    // The line-toggle is a no-op without an active editor.
    const toggle = fake.commands.registry.get('md-prettify.togglePrettySymbols');
    assert.ok(toggle, 'toggle command is registered on the host');
    void toggle?.();
    assert.strictEqual(api.isEnabled(), true, 'line toggle is a no-op without an active editor');

    // The global enable/disable commands still flip the backend state.
    const disable = fake.commands.registry.get('md-prettify.disablePrettySymbols');
    assert.ok(disable, 'disable command is registered on the host');
    void disable?.();
    assert.strictEqual(api.isEnabled(), false, 'backend state flipped to disabled');
    assert.deepStrictEqual(events, [false], 'onDidEnabledChange fired with the new state');

    // Enable back so module-level backend state stays clean for other suites.
    const enable = fake.commands.registry.get('md-prettify.enablePrettySymbols');
    assert.ok(enable, 'enable command is registered on the host');
    void enable?.();
    assert.strictEqual(api.isEnabled(), true, 'toggled back to enabled');
    deactivate();
  });
});
