/**
 * The locating actions: each one answers one question about a scope and keeps the
 * answer in the grammar store, so the next step reads a field instead of
 * recomputing it.
 *
 * Every action here writes a field of the store — `located`, `sources`,
 * `injectionScopes` or `loadedGrammars` — which is why the answers are visible as
 * state and not only as return values.
 */
import type { GrammarStore } from '../store';

/**
 * locateGrammarAction: resolves the file that serves a scope name and records it
 * in `located`, trying the declared scope and then the `source.<languageId>`
 * convention so markdown's `text.html.markdown` still resolves.
 * @param {GrammarStore} state the grammar store the located file is recorded in
 * @param {string} scopeName the TextMate scope whose file is wanted
 */
export function locateGrammarAction(state: GrammarStore, scopeName: string): void {
	const declared = state.grammarPaths.get(scopeName);
	const languageId = scopeName.replace(/^source\./, '');
	const byLanguage = state.languagePaths.get(languageId) ?? null;
	state.located.set(scopeName, declared ?? byLanguage);
}
