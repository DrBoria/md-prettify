import * as assert from 'assert';
import { Module } from 'module';

/**
 * Integration tests for the WebStorm host adapter (packages/webstorm-extension).
 *
 * The `webstorm` API is a types-only dependency — at runtime the IDE injects the
 * real module. Here we run the *compiled* adapter against a minimal fake
 * `webstorm` module swapped in via Module._load interception. The tests live in
 * apps/backend/test (the only legal *.test.ts home) and are executed by the
 * webstorm package's own `test` script against its compiled out/. When the
 * compiled adapter is not present (e.g. under the backend's own mocha run) the
 * suite self-skips.
 */

type Listener = (payload: unknown) => void;

const pushListener = (m: Map<string, Listener[]>, key: string, cb: Listener): void => {
  const arr = m.get(key) ?? [];
  arr.push(cb);
  m.set(key, arr);
};

// Shared across ALL webstorm-*.test.ts files: the compiled adapter is cached
// by require() and binds to the FIRST fake it was patched with, so every test
// file must patch 'webstorm' with the SAME fake object (stored on globalThis).
// This fake is a superset of what any single test needs (window.state,
// workspace.workspaceFolders, etc.) so whichever file loads first still satisfies
// the others.
const sharedFake: unknown = (globalThis as Record<string, unknown>).webstormPrettifyFake ?? null;

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
    executeCommand: (_id: string) => Promise.resolve(),
  },
  workspace: {
    textDocuments: [] as unknown[],
    getConfiguration: () => ({}),
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
  DecorationRangeBehavior: {
    OpenOpen: 1,
    ClosedClosed: 2,
    OpenClosed: 3,
    ClosedOpen: 4,
  },
}) as FakeShape;
if (!sharedFake) (globalThis as Record<string, unknown>).webstormPrettifyFake = fake;

interface Loadable {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
}
const patch = (id: string, mod: unknown): void => {
  const M = Module as typeof Module & Loadable;
  const orig = M._load;
  M._load = (request: string, parent: unknown, isMain: boolean) =>
    request === id ? mod : orig(request, parent, isMain);
};
patch('webstorm', fake);

const hasAdapter = (() => {
  try {
    require('../../../packages/webstorm-extension/host-adapter.js');
    return true;
  } catch {
    return false;
  }
})();
const s = hasAdapter ? suite : suite.skip.bind(suite);

s('webstorm host adapter', () => {
  if (!hasAdapter) return;
  const { createHost } = (() => require('../../../packages/webstorm-extension/host-adapter.js'))();

  test('exposes the full Host surface', () => {
    const host = createHost();
    for (const prop of [
      'registerCommand',
      'textDocuments',
      'visibleTextEditors',
      'activeTextEditor',
      'getConfiguration',
      'matchLanguage',
      'getGrammarFilePath',
      'getGrammarInjections',
      'getLanguageScopeName',
      'copyToClipboard',
      'createDecorationType',
      'createOutputChannel',
      'onDidOpenTextDocument',
      'onDidCloseTextDocument',
      'onDidChangeTextDocument',
      'onDidChangeConfiguration',
      'onDidChangeActiveTextEditor',
      'onDidChangeTextEditorSelection',
    ]) {
      assert.ok(prop in host, `host has ${prop}`);
    }
    assert.strictEqual(typeof host.registerCommand, 'function');
    assert.strictEqual(typeof host.getConfiguration, 'function');
    assert.strictEqual(host.activeTextEditor, null);
  });

  test('registerCommand forwards to webstorm.commands', () => {
    const host = createHost();
    const d = host.registerCommand('x.y', () => 1);
    assert.ok(fake.commands.registry.has('x.y'));
    assert.strictEqual(typeof d.dispose, 'function');
  });

  test('document-open events flow through to the host listener', () => {
    const host = createHost();
    const seen: unknown[] = [];
    host.onDidOpenTextDocument((doc) => seen.push(doc));

    const webstormDoc = {
      uri: { toString: () => 'file:///x.md' },
      languageId: 'markdown',
      fileName: 'x.md',
      isClosed: false,
      lineCount: 1,
      getText: () => 'hi',
      lineAt: () => ({ text: 'hi', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } } }),
    };
    const cbs = fake.workspace.listeners.get('onDidOpenTextDocument') ?? [];
    for (const cb of cbs) cb(webstormDoc);

    assert.strictEqual(seen.length, 1);
    const o = seen[0] as { uri: unknown; languageId: string };
    assert.strictEqual(o.uri, 'file:///x.md');
    assert.strictEqual(o.languageId, 'markdown');
  });
});
