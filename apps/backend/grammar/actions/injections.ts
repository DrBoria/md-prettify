/**
 * The injection action: it answers which scopes inject into one scope and keeps
 * the answer in the store, so the TextMate registry reads a field instead of the
 * contributons being walked again on every document.
 */
import type { GrammarStore } from '../store';

/**
 * injectionsForAction: the scope names that inject into one scope, recorded in
 * `injectionScopes` so the registry's callback answers from a field.
 * @param {GrammarStore} state the grammar store the injection scopes are recorded in
 * @param {string} scopeName the scope the injections are registered under
 * @returns {string[]} the injected scope names
 */
export function injectionsForAction(state: GrammarStore, scopeName: string): string[] {
	const scopes: string[] = [];
	for (const injection of state.injectionGrammars) scopes.push(injection.scopeName);
	state.injectionScopes.set(scopeName, scopes);

	return scopes;
}
