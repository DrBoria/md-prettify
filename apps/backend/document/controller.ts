/**
 * The document feature's orchestrators: they open, close and unload documents and
 * tell every feature that owns a part of one. The config entry, the grammar and
 * the decorations belong to those features, so each is told here through its own
 * store and keeps its own state.
 */
import type { LanguageEntry, LanguageEntryContext, TextDocument } from '@md-prettify/types';
import { getLanguageEntry } from '@md-prettify/utils';
import { getRoot } from '../store';

/**
 * openDocument: resolves the document's config entry, loads its grammar and lets
 * the decorations feature paint it.
 * @param {TextDocument} doc the document the ide opened
 */
export async function openDocument(doc: TextDocument): Promise<void> {
	const root = getRoot();
	if (root.documents.has(doc.uri) || !root.settings.isEnabled || !root.settings.ide) return;
	const ide = root.settings.ide;
	const values = root.settings.values;
	const context: LanguageEntryContext = {
		substitutions: values.substitutions,
		revealOn: values.revealOn,
		adjustCursorMovement: values.adjustCursorMovement,
		prettyCursor: values.prettyCursor,
		predefinedConfig: values.predefinedConfig,
		predefined: root.config.predefined,
		additionalSubstitutions: root.config.additionalSubstitutions,
	};
	const entry = getLanguageEntry(doc, context, ide.matchLanguage.bind(ide));
	if (!entry) return;
	const scope = root.grammar.scopeOfDocument(entry, doc.languageId);
	const grammar = await root.grammar.grammarOf(scope);
	if (doc.isClosed) return;
	root.documents.set(doc.uri, {});
	root.decorations.set(doc.uri, { uri: doc.uri });
	const state = root.documents.get(doc.uri);
	const decorations = root.decorations.get(doc.uri);
	if (!state || !decorations) return;
	state.refresh(doc);
	root.config.loadDocumentConfig(doc.uri, entry);
	root.grammar.storeDocumentGrammar(doc.uri, grammar);
	decorations.loadDecorations();
	decorations.decorateSpans(grammar, entry);
	decorations.paintDocument();
	state.subscriptions.push(ide.onDidChangeTextDocument(onDocumentChange));
}

/**
 * onDocumentChange: rebuilds the document map after an edit and repaints it.
 * @param {TextDocument} doc the document as the ide reports it now
 */
export function onDocumentChange(doc: TextDocument): void {
	const root = getRoot();
	const decorations = root.decorations.get(doc.uri);
	const entry = root.config.applied.get(doc.uri);
	root.documents.get(doc.uri)?.refresh(doc);
	if (!decorations || !entry) return;
	decorations.decorateSpans(root.grammar.byDocument.get(doc.uri) ?? null, entry);
	decorations.paintDocument();
}

/**
 * closeDocument: disposes a document's store and forgets it everywhere.
 * @param {TextDocument} doc the document the ide closed
 */
export function closeDocument(doc: TextDocument): void {
	const root = getRoot();
	root.decorations.get(doc.uri)?.disposeDecorations();
	root.config.forgetDocumentConfig(doc.uri);
	root.grammar.dropDocumentGrammar(doc.uri);
	root.documents.delete(doc.uri);
}

/**
 * reloadDocument: refreshes the document's snapshot, its config entry and its
 * decorations.
 * @param {TextDocument} doc the document as the ide reports it now
 * @param {LanguageEntry} entry the entry config still resolved for it
 */
export function reloadDocument(doc: TextDocument, entry: LanguageEntry): void {
	const root = getRoot();
	const decorations = root.decorations.get(doc.uri);
	root.documents.get(doc.uri)?.refresh(doc);
	root.config.loadDocumentConfig(doc.uri, entry);
	decorations?.loadDecorations();
	decorations?.decorateSpans(root.grammar.byDocument.get(doc.uri) ?? null, entry);
	decorations?.paintDocument();
}

/** unloadAllDocuments: disposes every open document. */
export function unloadAllDocuments(): void {
	const root = getRoot();
	for (const uri of Array.from(root.documents.keys())) closeDocument({ uri } as TextDocument);
}
