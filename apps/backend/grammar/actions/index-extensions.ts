/**
 * The indexing actions: they read the contributions of the installed extensions
 * once and keep the result in the grammar store, so locating a grammar later is a
 * map lookup instead of a walk over every extension.
 *
 * Each action writes one field of the store — the scope index, the language index
 * or the injection list — which is what makes the steps of the discovery visible
 * as state instead of hiding inside one expression.
 */
import * as path from 'path';

import type { IdeExtension } from '@md-prettify/types';

import type { GrammarStore } from '../store';

/**
 * indexScopePathsAction: fills the scope → file map from the grammars the
 * extensions contribute under a scope name, so a scope resolves without a search.
 * @param {GrammarStore} state the grammar store the scope index is written to
 */
export function indexScopePathsAction(state: GrammarStore): void {
	state.grammarPaths.clear();
	for (const extension of state.extensions) {
		const folder = extension.extensionUri.fsPath;
		for (const grammar of extension.packageJSON?.contributes?.grammars ?? []) {
			if (!grammar.path || !grammar.scopeName) continue;
			state.grammarPaths.set(grammar.scopeName, path.join(folder, grammar.path));
		}
	}
}

/**
 * indexLanguagePathsAction: fills the language → file map from the grammars filed
 * under a language, which is how a scope no grammar declares by name resolves.
 * @param {GrammarStore} state the grammar store the language index is written to
 */
export function indexLanguagePathsAction(state: GrammarStore): void {
	state.languagePaths.clear();
	for (const extension of state.extensions) {
		const folder = extension.extensionUri.fsPath;
		for (const grammar of extension.packageJSON?.contributes?.grammars ?? []) {
			if (!grammar.path || !grammar.language) continue;
			state.languagePaths.set(grammar.language, path.join(folder, grammar.path));
			state.grammarPaths.set(`source.${grammar.language}`, path.join(folder, grammar.path));
		}
	}
}

/**
 * indexDeclaredLanguagePathsAction: adds the grammar paths the language
 * contributions declare, which outrank a grammar only filed under a language.
 * @param {GrammarStore} state the grammar store the language index is written to
 */
export function indexDeclaredLanguagePathsAction(state: GrammarStore): void {
	for (const extension of state.extensions) {
		const folder = extension.extensionUri.fsPath;
		for (const language of extension.packageJSON?.contributes?.languages ?? []) {
			if (!language.grammarPath) continue;
			state.languagePaths.set(language.id, path.join(folder, language.grammarPath));
			state.grammarPaths.set(`source.${language.id}`, path.join(folder, language.grammarPath));
		}
	}
}

/**
 * indexInjectionsAction: collects the injection grammars the extensions declare,
 * so `injectionsFor` answers from one list instead of walking them again.
 * @param {GrammarStore} state the grammar store the injections are collected in
 */
export function indexInjectionsAction(state: GrammarStore): void {
	state.injectionGrammars.splice(0, state.injectionGrammars.length);
	state.injectionScopes.clear();
	for (const extension of state.extensions) indexExtensionInjectionsAction(state, extension);
}

/**
 * indexExtensionInjectionsAction: adds the injection grammars of one extension,
 * so the walk over its contributions stays out of the loop above.
 * @param {GrammarStore} state the grammar store the injections are collected in
 * @param {IdeExtension} extension the extension whose contributions are read
 */
export function indexExtensionInjectionsAction(state: GrammarStore, extension: IdeExtension): void {
	const folder = extension.extensionUri.fsPath;
	for (const grammar of extension.packageJSON?.contributes?.grammars ?? []) {
		if (!grammar.injectionSelector || !grammar.path) continue;
		state.injectionGrammars.push({ scopeName: grammar.scopeName ?? '', path: path.join(folder, grammar.path) });
	}
}
