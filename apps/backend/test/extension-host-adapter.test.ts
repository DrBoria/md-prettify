import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import { createRequire, Module } from 'module';

/**
 * Integration tests for the VS Code ide adapter (packages/vscode-extension).
 *
 * The vscode API is a types-only dependency — at runtime VS Code injects the
 * real module. Here we run the *compiled* adapter against a minimal fake
 * vscode module swapped in via Module._load interception. The tests live in
 * apps/backend/test (the only legal *.test.ts home) and are executed by the
 * extension's own `test` script against its compiled out/. When the compiled
 * adapter is not present (e.g. under the backend's own mocha run) the suite
 * self-skips.
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
const sharedFake: unknown = (globalThis as Record<string, unknown>).tsPrettifyFake ?? null;

type FakeShape = {
	commands: { registry: Map<string, (...args: unknown[]) => unknown> };
	workspace: { listeners: Map<string, ((d: unknown) => void)[]> };
};

const fake = (sharedFake ?? {
	commands: {
		registry: new Map<string, (...args: unknown[]) => unknown>(),
		registerCommand(id: string, cb: (...args: unknown[]) => unknown) {
			fake.commands.registry.set(id, cb);
			return { dispose: () => fake.commands.registry.delete(id) };
		},
		executeCommand: (_id: string) => Promise.resolve(),
	},
	workspace: {
		textDocuments: [] as unknown[],
		getConfiguration: () => ({}),
		listeners: new Map<string, Listener[]>(),
		onDidOpenTextDocument(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidOpenTextDocument', cb);
			return { dispose: () => {} };
		},
		onDidCloseTextDocument(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidCloseTextDocument', cb);
			return { dispose: () => {} };
		},
		onDidChangeTextDocument(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidChangeTextDocument', cb);
			return { dispose: () => {} };
		},
		onDidChangeConfiguration(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidChangeConfiguration', cb);
			return { dispose: () => {} };
		},
	},
	window: {
		visibleTextEditors: [] as unknown[],
		activeTextEditor: null,
		listeners: new Map<string, Listener[]>(),
		onDidChangeActiveTextEditor(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidChangeActiveTextEditor', cb);
			return { dispose: () => {} };
		},
		onDidChangeTextEditorSelection(cb: Listener) {
			pushListener(fake.workspace.listeners, 'onDidChangeTextEditorSelection', cb);
			return { dispose: () => {} };
		},
		createOutputChannel(name: string) {
			return {
				name,
				lines: [] as string[],
				appendLine(v: string) {
					this.lines.push(v);
				},
				dispose() {},
			};
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
if (!sharedFake) (globalThis as Record<string, unknown>).tsPrettifyFake = fake;

interface Loadable {
	_load: (request: string, parent: unknown, isMain: boolean) => unknown;
}
/** loadEntry: the adapter, loaded after the SDK module was swapped. */
const loadEntry = createRequire(__filename);

const patch = (id: string, mod: unknown): void => {
	const M = Module as typeof Module & Loadable;
	const orig = M._load;
	M._load = (request: string, parent: unknown, isMain: boolean) => (request === id ? mod : orig(request, parent, isMain));
};
patch('vscode', fake);

const hasAdapter = (() => {
	try {
		loadEntry('../../vscode-extension/ide-adapter.js');
		return true;
	} catch {
		return false;
	}
})();
const s = hasAdapter ? suite : suite.skip.bind(suite);

s('vscode ide adapter', () => {
	if (!hasAdapter) return;
	const { createIde } = (() => loadEntry('../../vscode-extension/ide-adapter.js'))();

	test('exposes the full Ide surface', () => {
		const ide: Ide = createIde();
		for (const prop of [
			'registerCommand',
			'textDocuments',
			'visibleTextEditors',
			'activeTextEditor',
			'getConfiguration',
			'matchLanguage',
			'getInstalledExtensions',
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
			assert.ok(prop in ide, `ide has ${prop}`);
		}
		assert.strictEqual(typeof ide.registerCommand, 'function');
		assert.strictEqual(typeof ide.getConfiguration, 'function');
		assert.strictEqual(ide.activeTextEditor, null);
	});

	test('registerCommand forwards to vscode.commands', () => {
		const ide = createIde();
		const d = ide.registerCommand('x.y', () => 1);
		assert.ok(fake.commands.registry.has('x.y'));
		assert.strictEqual(typeof d.dispose, 'function');
	});

	test('document-open events flow through to the ide listener', () => {
		const ide = createIde();
		const seen: unknown[] = [];
		ide.onDidOpenTextDocument((doc) => seen.push(doc));

		const vscodeDoc = {
			uri: { toString: () => 'file:///x.ts' },
			languageId: 'typescript',
			fileName: 'x.ts',
			isClosed: false,
			lineCount: 1,
			getText: () => 'hi',
			lineAt: () => ({ text: 'hi', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } } }),
		};
		const cbs = fake.workspace.listeners.get('onDidOpenTextDocument') ?? [];
		for (const cb of cbs) cb(vscodeDoc);

		assert.strictEqual(seen.length, 1);
		const o = seen[0] as { uri: unknown; languageId: string };
		assert.strictEqual(o.uri, 'file:///x.ts');
		assert.strictEqual(o.languageId, 'typescript');
	});
});
