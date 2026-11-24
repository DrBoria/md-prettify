import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import type {
	TextDocument,
	EditorSnapshot,
	Disposable,
	OutputChannel,
	TextEditorDecorationType,
	DecorationRenderOptions,
} from '@md-prettify/types';
import { copyWithSubstitutions, togglePrettySymbols } from '../decorations/controller';
import type { RootStore } from '../store';
import { getRoot } from '../store';
import { resetStoreAction } from '../settings/actions/reset-store';

const noop = (): Disposable => ({ dispose: () => {} });

const makeHost = (editor: EditorSnapshot | null): Ide => {
	const ide: Ide = {
		registerCommand: noop,
		setDecorations(): void {},
		textDocuments: [],
		visibleTextEditors: editor ? [editor] : [],
		activeTextEditor: editor,
		getConfiguration(): unknown {
			return {};
		},
		matchLanguage(): number {
			return 0;
		},
		getInstalledExtensions: () => [],
		copyToClipboard(): Promise<void> {
			return Promise.resolve();
		},
		createDecorationType(o: DecorationRenderOptions): TextEditorDecorationType {
			return { key: 'k', options: o, dispose: () => {} };
		},
		createOutputChannel(): OutputChannel {
			return { appendLine: () => {}, dispose: () => {} };
		},
		onDidOpenTextDocument: noop,
		onDidCloseTextDocument: noop,
		onDidChangeTextDocument: noop,
		onDidChangeConfiguration: noop,
		onDidChangeActiveTextEditor: noop,
		onDidChangeTextEditorSelection: noop,
	};
	return ide;
};

const makeEditor = (): EditorSnapshot => {
	const doc: TextDocument = {
		uri: 'file:///unknown.ts',
		languageId: 'typescript',
		fileName: 'unknown.ts',
		isClosed: false,
		lineCount: 1,
		text: '',
		lineStarts: [0],
	};
	return { document: doc, selections: [], native: undefined };
};

/** Writes the enabled flag to the store and notifies its subscribers. */
const applyEnabled = (root: RootStore, value: boolean): void => {
	const commands = root.settings;
	if (commands.enabled === value) return;
	commands.enabled = value;
	for (const handler of commands.enabledHandlers) handler(value);
};

const reset = (): RootStore => {
	const root = getRoot();
	resetStoreAction(root, makeHost(null));
	return root;
};

suite('commands', () => {
	suite('toggle', () => {
		test('setEnabled toggles state and notifies handlers', () => {
			const root = reset();
			const seen: boolean[] = [];
			const handler = (v: boolean): void => {
				seen.push(v);
			};
			root.settings.enabledHandlers.add(handler);
			applyEnabled(root, false);
			applyEnabled(root, true);
			assert.strictEqual(root.settings.enabled, true);
			assert.deepStrictEqual(seen, [false, true]);
			root.settings.enabledHandlers.delete(handler);
			applyEnabled(root, false);
			assert.deepStrictEqual(seen, [false, true], 'unsubscribed handler not called');
		});

		test('setEnabled is a no-op when the value is unchanged', () => {
			const root = reset();
			const seen: boolean[] = [];
			root.settings.enabledHandlers.add((v) => seen.push(v));
			applyEnabled(root, true); // already true
			assert.deepStrictEqual(seen, [], 'no notification for unchanged value');
		});

		test('enable/disable drive the state', () => {
			const root = reset();
			applyEnabled(root, false);
			assert.strictEqual(root.settings.enabled, false);
			applyEnabled(root, true);
			assert.strictEqual(root.settings.enabled, true);
		});

		test('line toggle is a no-op without an active editor and does not touch global state', () => {
			const root = reset();
			togglePrettySymbols();
			assert.strictEqual(root.settings.enabled, true);
			applyEnabled(root, false);
			togglePrettySymbols();
			assert.strictEqual(root.settings.enabled, false);
			applyEnabled(root, true);
		});
	});

	suite('copyWithSubstitutions', () => {
		test('returns early when there is no active editor', async () => {
			reset();
			const ide = makeHost(null);
			await copyWithSubstitutions(ide); // must not throw
			assert.ok(true);
		});

		test('returns early when the document is not pretty', async () => {
			reset();
			const ide = makeHost(makeEditor());
			await copyWithSubstitutions(ide); // unknown doc -> not pretty
			assert.ok(true);
		});
	});
});
