/**
 * The grammar feature's orchestrators: they sequence the grammar store's actions
 * so the registry follows the ide the extension is attached to.
 */
import type { IGrammar } from 'vscode-textmate';
import { getRoot } from '../store';

/** initializeGrammar: rebuilds the TextMate registry over the ide's grammar locator. */
export function initializeGrammar(): void {
	const grammar = getRoot().grammar;
	grammar.resetGrammarCache();
	grammar.initializeGrammar();
}

/** disposeGrammar: releases the cached grammars and registry when the extension unloads. */
export function disposeGrammar(): void {
	getRoot().grammar.releaseOnigLib();
}

/** rememberGrammar: stores the grammar one document is tokenized with.
 * @param {string} uri the document the grammar belongs to
 * @param {IGrammar | null} grammar the grammar, or null when none was found
 */
export function rememberGrammar(uri: string, grammar: IGrammar | null): void {
	getRoot().grammar.storeDocumentGrammar(uri, grammar);
}

/** forgetGrammar: drops the grammar of a closed document.
 * @param {string} uri the document whose grammar is dropped
 */
export function forgetGrammar(uri: string): void {
	getRoot().grammar.dropDocumentGrammar(uri);
}
