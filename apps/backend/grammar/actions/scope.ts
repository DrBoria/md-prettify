/**
 * The scope action: it resolves the TextMate scope a document's language is
 * tokenized by and keeps it in the store, so the grammar step reads a field
 * instead of deriving the scope again.
 */
import type { GrammarStore } from '../store';

/**
 * scopeOfDocumentAction: the TextMate scope a document is tokenized by, recorded
 * in `documentScopes` so the document feature reads it back instead of deriving it.
 * @param {GrammarStore} state the grammar store the scope is recorded in
 * @param {{ textMateInitialScope?: string }} entry the document's config entry
 * @param {string} languageId the language the ide reports for the document
 */
export function scopeOfDocumentAction(state: GrammarStore, entry: { textMateInitialScope?: string }, languageId: string): string {
	const scope = entry.textMateInitialScope ?? `source.${languageId}`;
	state.documentScopes.set(languageId, scope);

	return scope;
}
