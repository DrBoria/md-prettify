import * as assert from 'assert';
import { Module } from 'module';

/**
 * Integration tests for extension activation (packages/vscode-extension).
 *
 * Runs the *compiled* activate()/deactivate() against a fake vscode module and
 * a stubbed DevtoolServer (so no real 60060/60061 transports start). The tests
 * live in apps/backend/test and are executed by the extension's own `test`
 * script; they self-skip when the compiled adapter is not present (e.g. under
 * the backend's own mocha run).
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

// Stub the DevtoolServer so activation never opens real network transports.
class FakeDevtoolServer {
  static instances: FakeDevtoolServer[] = [];
  static stopGlobalInstance(): Promise<void> {
    return Promise.resolve();
  }
  started = false;
  start(): Promise<void> {
    this.started = true;
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

s('extension activation', () => {
  if (!hasAdapter) return;
  const { activate, deactivate } = (() => require('../../../packages/vscode-extension/activate.js'))();

  test('activate registers commands, listeners and an output channel', () => {
    const context: { subscriptions: { dispose?: () => void }[] } = { subscriptions: [] };
    const api = activate(context);

    for (const id of [
      'md-prettify.copyWithSubstitutions',
      'md-prettify.disablePrettySymbols',
      'md-prettify.enablePrettySymbols',
      'md-prettify.togglePrettySymbols',
    ]) {
      assert.ok(fake.commands.registry.has(id), `command ${id} registered`);
    }
    assert.strictEqual(context.subscriptions.length, 10, '1 output channel + 4 commands + 5 listeners');
    assert.ok(api, 'returns the mdPrettify api');
    assert.strictEqual(api.isEnabled(), true, 'enabled by default');
  });

  test('deactivate disposes the subscriptions', () => {
    const context: { subscriptions: { dispose?: () => void }[] } = { subscriptions: [] };
    activate(context);
    const disposables = context.subscriptions.filter((d) => typeof d.dispose === 'function');
    assert.ok(disposables.length >= 9, 'most subscriptions are disposables');
    deactivate();
  });
});
