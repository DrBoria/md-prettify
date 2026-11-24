import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import type { TextDocument, Disposable, OutputChannel, TextEditorDecorationType, DecorationRenderOptions } from '@md-prettify/types';
import { getLanguageEntry } from '@md-prettify/utils';
import type { LanguageEntryContext, LanguageMatcher } from '@md-prettify/types';
import { reloadConfiguration } from '../config/controller';
import type { RootStore } from '../store';
import { getRoot } from '../store';
import { resetStoreAction } from '../settings/actions/reset-store';

/** Resets the root store and points it at the given ide. */
const installRoot = (ide: Ide): RootStore => {
	const root = getRoot();
	resetStoreAction(root, ide);
	return root;
};

/** The store state the pure language-entry helper reads from. */
const languageEntryContext = (root: RootStore): LanguageEntryContext => ({
	substitutions: root.settings.values.substitutions,
	revealOn: root.settings.values.revealOn,
	adjustCursorMovement: root.settings.values.adjustCursorMovement,
	prettyCursor: root.settings.values.prettyCursor,
	predefinedConfig: root.settings.values.predefinedConfig,
	predefined: root.config.predefined,
	additionalSubstitutions: root.config.additionalSubstitutions,
});

/** The ide matcher the entry lookup takes as its third argument. */
const matchLanguage =
	(root: RootStore): LanguageMatcher =>
	(language, doc) =>
		root.settings.ide?.matchLanguage(language, doc) ?? 0;

// A ide whose configuration and language matching are driven by test data.
const makeHost = (config: unknown, match: (lang: string | string[], doc: TextDocument) => number): Ide => {
	const noop = (): Disposable => ({ dispose: () => {} });
	const ide: Ide = {
		registerCommand: noop,
		setDecorations(): void {},
		textDocuments: [],
		visibleTextEditors: [],
		activeTextEditor: null,
		getConfiguration(): unknown {
			return config;
		},
		matchLanguage: match,
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

const makeDoc = (languageId: string): TextDocument => ({
	uri: `file:///${languageId}.ts`,
	languageId,
	fileName: `${languageId}.ts`,
	isClosed: false,
	lineCount: 1,
	text: '',
	lineStarts: [0],
});

suite('config settings', () => {
	const reset = (): void => {
		void getRoot().config.additionalSubstitutions;
	};

	test('reloadConfiguration applies defaults from an empty config', () => {
		reset();
		installRoot(makeHost({}, () => 0));
		reloadConfiguration();
		const s = getRoot().settings.values;
		assert.strictEqual(s.revealOn, 'cursor');
		assert.strictEqual(s.adjustCursorMovement, false);
		assert.strictEqual(s.prettyCursor, 'boxed');
		assert.strictEqual(s.hideTextMethod, 'hack-letterSpacing');
		assert.deepStrictEqual(s.substitutions, []);
	});

	test('getLanguageEntry returns the best-matching user entry', () => {
		reset();
		const config = {
			substitutions: [
				{ language: 'typescript', substitutions: [{ ugly: '\\*', pretty: 'x' }], combineIdenticalScopes: true },
				{ language: 'plaintext', substitutions: [{ ugly: '#', pretty: 'y' }], combineIdenticalScopes: true },
			],
		};
		const root = installRoot(makeHost(config, (lang) => (lang === 'typescript' ? 1 : 0)));
		reloadConfiguration();
		const entry = getLanguageEntry(makeDoc('typescript'), languageEntryContext(root), matchLanguage(root));
		assert.ok(entry);
		assert.strictEqual(entry.language, 'typescript');
		assert.strictEqual(entry.substitutions.length, 1);
	});

	test('getLanguageEntry merges a predefined config with user substitutions', () => {
		reset();
		const config = {
			predefinedConfig: 'custom',
			predefinedConfigurations: {
				custom: { language: 'typescript', substitutions: [{ ugly: 'a', pretty: 'A' }], combineIdenticalScopes: true },
			},
			substitutions: [{ language: 'typescript', substitutions: [{ ugly: 'b', pretty: 'B' }], combineIdenticalScopes: true }],
		};
		const root = installRoot(makeHost(config, (lang) => (lang === 'typescript' ? 1 : 0)));
		reloadConfiguration();
		const entry = getLanguageEntry(makeDoc('typescript'), languageEntryContext(root), matchLanguage(root));
		assert.ok(entry);
		assert.strictEqual(entry.substitutions.length, 2, 'predefined + user substitutions concatenated');
	});

	test('getLanguageEntry falls back to additionalSubstitutions', () => {
		reset();
		const root = installRoot(makeHost({}, (lang) => (lang === 'typescript' ? 1 : 0)));
		root.config.registerSubstitution(
			{
				language: 'typescript',
				substitutions: [{ ugly: 'c', pretty: 'C' }],
				combineIdenticalScopes: true,
			},
			true,
		);
		reloadConfiguration();
		const entry = getLanguageEntry(makeDoc('typescript'), languageEntryContext(root), matchLanguage(root));
		assert.ok(entry);
		assert.strictEqual(entry.language, 'typescript');
		assert.strictEqual(entry.substitutions.length, 1);
	});

	test('getLanguageEntry returns undefined when nothing matches', () => {
		reset();
		const root = installRoot(makeHost({}, () => 0));
		reloadConfiguration();
		assert.strictEqual(getLanguageEntry(makeDoc('rust'), languageEntryContext(root), matchLanguage(root)), undefined);
	});
});
