import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import { lineStartsOf, loadOnigLib } from '@md-prettify/utils';
import type { TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from '@md-prettify/types';
import type { TextDocument } from '@md-prettify/types';
import type { LanguageEntry } from '@md-prettify/types';
import { parseRawGrammar, Registry } from 'vscode-textmate';
import type { IGrammar } from 'vscode-textmate';

import { buildDecorationsList } from '@md-prettify/utils';
import * as oniguruma from 'vscode-oniguruma';
import { syntheticGrammarJson } from '../constants';
import { getRoot } from '../store';

import { rememberGrammar } from '../grammar/controller';
import { onDocumentChange } from '../document/controller';
import { resetStoreAction } from '../settings/actions/reset-store';

import type { Range } from '@md-prettify/types';
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

// A document snapshot that follows the lines the test mutates: a change event
// then sees the text the IDE would report afterwards.
const makeMutableDocModel = (initial: string[]): { doc: TextDocument; setLines: (l: string[]) => void } => {
	const doc = makeDocModel(initial) as { -readonly [K in keyof TextDocument]: TextDocument[K] };

	return {
		doc,
		setLines: (l) => {
			Object.assign(doc, makeDocModel(l));
		},
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

const settings: LanguageEntry = {
	language: 'typescript',
	substitutions: [{ ugly: '&&', pretty: 'AND' }],
	combineIdenticalScopes: true,
};

suite('document store mutations', () => {
	test('applyChanges shifts ranges after an insertion and reparses', async () => {
		const grammar = await loadGrammar();
		const { doc, setLines } = makeMutableDocModel(['const a = x && y;', 'const b = p && q;']);
		const model = makeModel(doc, settings, grammar);
		assert.strictEqual(allSpans(model).length, 2, 'one marker per line');

		// Insert a new blank line at the very top of the document.
		setLines(['inserted', 'const a = x && y;', 'const b = p && q;']);
		onDocumentChange(doc);
		const after = allSpans(model);
		assert.strictEqual(after.length, 2, 'same number of markers after the shift');
		for (const r of after) assert.ok(r.start.line >= 1, `range not shifted: ${r.start.line}:${r.start.character}`);
	});

	test('recomputeDecorations is idempotent', async () => {
		const grammar = await loadGrammar();
		const doc = makeDocModel(['const a = x && y;', 'plain']);
		const model = makeModel(doc, settings, grammar);
		const first = allSpans(model).length;
		onDocumentChange(doc);
		const second = allSpans(model).length;
		assert.strictEqual(first, 1);
		assert.strictEqual(second, first, 'recompute is stable');
	});

	test('decoration entries are built from the store', async () => {
		const grammar = await loadGrammar();
		const doc = makeDocModel(['const a = x && y;']);
		const model = makeModel(doc, settings, grammar);
		const entries = buildDecorationsList(
			model.dec.disabledLines,
			model.dec.decorationTypes,
			model.dec.prettySpans,
			model.dec.hiddenType,
		);
		assert.ok(entries.length > 0, 'expected at least one decoration entry');
	});
});
