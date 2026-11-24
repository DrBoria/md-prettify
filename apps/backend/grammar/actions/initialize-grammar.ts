/**
 * The grammar actions: they build the TextMate registry over the grammars the
 * installed extensions contribute, so the document engine can tokenize with the
 * real grammars instead of plain text.
 */
import * as oniguruma from 'vscode-oniguruma';
import * as vsctm from 'vscode-textmate';
import type { IGrammar } from 'vscode-textmate';
import { loadOnigLib } from '@md-prettify/utils';
import type { GrammarStore } from '../store';
import { getRoot } from '../../store';

/** resetGrammarCacheAction: clears the loaded grammars and drops the registry.
 * @param {GrammarStore} state the grammar store being reset
 */
export function resetGrammarCacheAction(state: GrammarStore): void {
	state.loadedGrammars.clear();
	state.registry = null;
}

/** releaseOnigLibAction: drops the cached Oniguruma library promise.
 * @param {GrammarStore} state the grammar store being released
 */
export function releaseOnigLibAction(state: GrammarStore): void {
	state.onigLibPromise = undefined;
}

/** initializeGrammarAction: builds the TextMate registry and stores it, replacing any previous one.
 *
 * The registry asks this feature, not the ide, where a grammar lives: the
 * installed extensions are read once and the discovery actions pick the file,
 * so no IDE knowledge is needed here.
 *
 * @param {GrammarStore} state the grammar store the registry is stored on
 */
export function initializeGrammarAction(state: GrammarStore): void {
	const onigLibPromise = state.onigLibPromise ?? loadOnigLib(oniguruma, console.info, console.error);
	state.onigLibPromise = onigLibPromise;
	state.extensions = getRoot().settings.ide?.getInstalledExtensions() ?? [];
	const grammar = getRoot().grammar;
	grammar.indexScopePaths();
	grammar.indexLanguagePaths();
	grammar.indexDeclaredLanguagePaths();
	grammar.indexInjections();
	state.registry = new vsctm.Registry({
		onigLib: onigLibPromise,
		loadGrammar: grammar.loadSource.bind(null, vsctm.parseRawGrammar),
		getInjections: grammar.injectionsFor,
	});
}

/**
 * storeDocumentGrammarAction: remembers the grammar one document is tokenized with.
 * @param {GrammarStore} state the grammar store the grammar is stored on
 * @param {string} uri the document the grammar belongs to
 * @param {IGrammar | null} grammar the grammar, or null when none was found
 */
export function storeDocumentGrammarAction(state: GrammarStore, uri: string, grammar: IGrammar | null): void {
	state.byDocument.set(uri, grammar);
}

/**
 * dropDocumentGrammarAction: forgets the grammar of a closed document.
 * @param {GrammarStore} state the grammar store the grammar was stored on
 * @param {string} uri the document whose grammar is dropped
 */
export function dropDocumentGrammarAction(state: GrammarStore, uri: string): void {
	state.byDocument.delete(uri);
}
