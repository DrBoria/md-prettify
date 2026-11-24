import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import { lineStartsOf, loadOnigLib, rangeFrom } from '@md-prettify/utils';
import type { Range } from '@md-prettify/types';
import type { TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from '@md-prettify/types';
import type { TextDocument } from '@md-prettify/types';
import type { LanguageEntry } from '@md-prettify/types';
import { parseRawGrammar, Registry } from 'vscode-textmate';
import type { IGrammar } from 'vscode-textmate';

import { getDecoratedText } from '@md-prettify/utils';
import * as oniguruma from 'vscode-oniguruma';
import { syntheticGrammarJson } from '../constants';
import { getRoot } from '../store';

import { rememberGrammar } from '../grammar/controller';
import { resetStoreAction } from '../settings/actions/reset-store';

import type { DocumentStore } from '../document/store';
import type { DecorationsStore } from '../decorations/store';

/** The two stores one test document is read through. */
interface Model {
	doc: DocumentStore;
	dec: DecorationsStore;
}

/** allSpans: every span the view model holds, whatever rule produced it. */
const allSpans = (model: Model): Range[] => [...model.dec.prettySpans.values()].flatMap((entry) => [...entry.ranges]);

const onigLibPromise = loadOnigLib(oniguruma, console.info, console.error);

const noop = (): Disposable => ({ dispose: () => {} });

const makeFakeIde = (): Ide => {
	const ide: Ide = {
		textDocuments: [],
		visibleTextEditors: [],
		activeTextEditor: null,
		registerCommand: noop,
		setDecorations(): void {},
		getConfiguration(): unknown {
			return {};
		},
		matchLanguage(): number {
			return 1;
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

const makeDocModel = (lines: string[]): TextDocument => {
	const text = lines.join('\n');

	return {
		uri: 'test',
		languageId: 'typescript',
		fileName: 'test.ts',
		isClosed: false,
		lineCount: lines.length,
		text,
		lineStarts: lineStartsOf(text),
	};
};

const loadGrammar = async (): Promise<IGrammar> => {
	const registry = new Registry({
		onigLib: onigLibPromise as never,
		loadGrammar: () => Promise.resolve(parseRawGrammar(syntheticGrammarJson, 'synthetic-ts.json')),
	});
	const grammar = await registry.loadGrammar('source.ts');
	assert.ok(grammar, 'grammar loaded');
	return grammar as never;
};

/** Installs the document store through the feature actions and returns it. */
const makeModel = (doc: TextDocument, settings: LanguageEntry, grammar: IGrammar): Model => {
	const ide = makeFakeIde();
	resetStoreAction(getRoot(), ide);
	const entry: LanguageEntry = { textMateInitialScope: 'source.ts', ...settings };
	getRoot().documents.set(doc.uri, {});
	const docState = getRoot().documents.get(doc.uri);
	docState?.refresh(doc);
	assert.ok(docState, 'document store installed');
	getRoot().config.loadDocumentConfig(doc.uri, entry);
	rememberGrammar(doc.uri, grammar);
	getRoot().decorations.set(doc.uri, { uri: doc.uri });
	const dec = getRoot().decorations.get(doc.uri);
	dec?.loadDecorations();
	dec?.decorateSpans(grammar, entry);
	dec?.paintDocument();
	assert.ok(dec, 'decorations store installed');

	return { doc: docState, dec };
};

const rangeAt = (r: Range): [number, number, number, number] => [r.start.line, r.start.character, r.end.line, r.end.character];

suite('PrettyModel (synthetic TypeScript grammar)', () => {
	test('finds substitution ranges in plain source scope', async () => {
		const grammar = await loadGrammar();
		const lines = ['const r = a && b;'];
		const doc = makeDocModel(lines);
		const settings: LanguageEntry = {
			language: 'typescript',
			substitutions: [{ ugly: '&&', pretty: 'AND' }],
			combineIdenticalScopes: true,
		};
		const model = makeModel(doc, settings, grammar);
		const ranges = allSpans(model);
		assert.strictEqual(ranges.length, 1);
		// "const r = a " = 12 chars; "&&" spans indices 12..14
		assert.deepStrictEqual(rangeAt(ranges[0]), [0, 12, 0, 14]);
		assert.strictEqual(getDecoratedText(model.dec.prettySpans, model.doc.document, rangeFrom(0, 0, 0, 18)), 'const r = a AND b;');
	});

	test('scope-restricted rules only match inside their scope', async () => {
		const grammar = await loadGrammar();
		const lines = ['function alpha() {', '\treturn 1;', '}', 'const x = 1;'];
		const doc = makeDocModel(lines);
		// `function` -> fun is restricted to meta.function.ts, so the keyword
		// only matches where the grammar actually opened that scope.
		const settings: LanguageEntry = {
			language: 'typescript',
			substitutions: [{ ugly: 'function', pretty: 'fun', scope: 'meta.function.ts' }],
			combineIdenticalScopes: true,
		};
		const model = makeModel(doc, settings, grammar);
		const ranges = allSpans(model);
		assert.strictEqual(ranges.length, 1, 'only the in-scope `function` keyword matches');
		assert.strictEqual(ranges[0].start.line, 0);
		// "function alpha() {" (18 chars) decorates to "fun alpha() {" (shorter).
		assert.strictEqual(getDecoratedText(model.dec.prettySpans, model.doc.document, rangeFrom(0, 0, 0, 18)), 'fun alpha() {');
	});

	test('a scope that never appears in the grammar matches nothing', async () => {
		const grammar = await loadGrammar();
		const lines = ['const r = a && b;'];
		const doc = makeDocModel(lines);
		// A scope the synthetic grammar never produces: no match.
		const settings: LanguageEntry = {
			language: 'typescript',
			substitutions: [{ ugly: '&&', pretty: 'AND', scope: 'meta.arrow.ts' }],
			combineIdenticalScopes: true,
		};
		const model = makeModel(doc, settings, grammar);
		assert.strictEqual(allSpans(model).length, 0, 'scope never present in this grammar');
	});

	test('excludedScopes skip substitution on excluded segments', async () => {
		const grammar = await loadGrammar();
		const lines = ['// && in a comment'];
		const doc = makeDocModel(lines);
		const settings: LanguageEntry = {
			language: 'typescript',
			substitutions: [{ ugly: '&&', pretty: 'AND' }],
			excludedScopes: ['comment.line.double-slash.ts'],
			combineIdenticalScopes: true,
		};
		const model = makeModel(doc, settings, grammar);
		assert.strictEqual(allSpans(model).length, 0, 'comment segment excluded');
	});
});
