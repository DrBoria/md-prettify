/**
 * The grammar store: a mobx-state-tree model holding the state of the grammar
 * feature — the Oniguruma WASM library promise, the TextMate registry, the
 * extensions the ide has installed and every step of the discovery kept as a
 * field of its own. Object literal, no classes.
 *
 * The intermediate steps live here on purpose: the scope → file index, the
 * language → file index, the injection grammars, the file located for a scope,
 * the parsed sources, the scope of each document and the loaded grammars. An
 * action writes one of them, the next step reads it, and no step has to be
 * recomputed at a call site.
 *
 * Actions live in `./actions/` and the orchestrators in `./controller.ts`.
 */
import { types as t } from 'mobx-state-tree';
import type { Instance } from 'mobx-state-tree';
import { registerActions } from '@md-prettify/utils';
import type { IdeExtension } from '@md-prettify/types';
import type { IGrammar } from 'vscode-textmate';
import type { IOnigLib } from 'vscode-textmate';
import type { GrammarInjection, ITextMateRegistry } from './type';
import {
	dropDocumentGrammarAction,
	initializeGrammarAction,
	releaseOnigLibAction,
	resetGrammarCacheAction,
	storeDocumentGrammarAction,
} from './actions/initialize-grammar';
import {
	indexDeclaredLanguagePathsAction,
	indexInjectionsAction,
	indexLanguagePathsAction,
	indexScopePathsAction,
} from './actions/index-extensions';
import { injectionsForAction } from './actions/injections';
import { locateGrammarAction } from './actions/locate';
import { grammarOfAction } from './actions/load';
import { scopeOfDocumentAction } from './actions/scope';
import { loadSourceAction, readSourceTextAction } from './actions/source';

const GrammarStoreBase = t.model('GrammarStore', {}).volatile(() => ({
	/** The in-flight WASM library promise, set once by `initializeGrammarAction`. */
	onigLibPromise: undefined as Promise<IOnigLib> | undefined,
	/** The TextMate registry, rebuilt when the ide configuration reloads. */
	registry: null as ITextMateRegistry | null,
	/** The extensions the ide has installed, indexed by the actions below. */
	extensions: [] as IdeExtension[],
	/** Scope name → grammar file, filled by `indexGrammarsAction`. */
	grammarPaths: new Map<string, string>(),
	/** Language id → grammar file, filled by `indexGrammarsAction` and `indexLanguagesAction`. */
	languagePaths: new Map<string, string>(),
	/** The injection grammars the extensions contribute, filled by `indexGrammarsAction`. */
	injectionGrammars: [] as GrammarInjection[],
	/** The file `locateGrammarAction` resolved for a scope, or null when nothing serves it. */
	located: new Map<string, string | null>(),
	/** The grammar text read from disk, keyed by scope name. */
	sourceTexts: new Map<string, string>(),
	/** The raw grammars `loadSourceAction` parsed, keyed by scope name. */
	sources: new Map<string, unknown>(),
	/** The injected scope names `injectionsForAction` collected, keyed by scope name. */
	injectionScopes: new Map<string, string[]>(),
	/** The TextMate scope each document's language resolves to. */
	documentScopes: new Map<string, string>(),
	/** Cache for loaded grammars, keyed by scope name. */
	loadedGrammars: new Map<string, IGrammar>(),
	/** The grammar each open document is tokenized with, keyed by document uri. */
	byDocument: new Map<string, IGrammar | null>(),
}));

export type GrammarStore = Instance<typeof GrammarStoreBase>;

export const GrammarStoreModel = GrammarStoreBase.actions((self) =>
	registerActions(self, {
		resetGrammarCache: resetGrammarCacheAction,
		releaseOnigLib: releaseOnigLibAction,
		initializeGrammar: initializeGrammarAction,
		storeDocumentGrammar: storeDocumentGrammarAction,
		dropDocumentGrammar: dropDocumentGrammarAction,
		indexScopePaths: indexScopePathsAction,
		indexLanguagePaths: indexLanguagePathsAction,
		indexDeclaredLanguagePaths: indexDeclaredLanguagePathsAction,
		indexInjections: indexInjectionsAction,
		locateGrammar: locateGrammarAction,
		readSourceText: readSourceTextAction,
		loadSource: loadSourceAction,
		injectionsFor: injectionsForAction,
		grammarOf: grammarOfAction,
		scopeOfDocument: scopeOfDocumentAction,
	}),
);
