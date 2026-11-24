/**
 * The grammar actions: they load a scope's grammar through the registry the store
 * holds and remember it, so a document reopened for the same language tokenizes
 * without touching the registry again.
 */
import type { IGrammar } from 'vscode-textmate';

import type { GrammarStore } from '../store';

/**
 * grammarOfAction: loads a scope's grammar through the registry the store holds
 * and caches it in `loadedGrammars`, so a document opened twice tokenizes once.
 * @param {GrammarStore} state the grammar store the grammar is cached in
 * @param {string} scopeName the scope whose grammar is loaded
 * @returns {Promise<IGrammar | null>} the grammar, or null when it is unavailable
 */
export async function grammarOfAction(state: GrammarStore, scopeName: string): Promise<IGrammar | null> {
	const cached = state.loadedGrammars.get(scopeName);
	if (cached) return cached;
	if (!state.registry) return null;
	try {
		const grammar = await state.registry.loadGrammar(scopeName);
		if (grammar) state.loadedGrammars.set(scopeName, grammar);

		return grammar;
	} catch (error) {
		console.error('loadGrammar:', error);

		return null;
	}
}
