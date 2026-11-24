/**
 * The decorations feature's orchestrators: they answer the ide's editor events by
 * asking the document's decorations store to repaint itself. The document, its
 * config entry and its grammar are other features' state — read, never copied.
 */
import type { EditorSnapshot } from '@md-prettify/types';
import { getDecoratedText } from '@md-prettify/utils';
import { getRoot } from '../store';

/**
 * copyDocumentText: copies the decorated text of the editor's selections to the clipboard.
 * @param {EditorSnapshot} editor the editor whose selections are copied
 */
export async function copyDocumentText(editor: EditorSnapshot): Promise<void> {
	const root = getRoot();
	const state = root.decorations.get(editor.document.uri);
	const doc = root.documents.get(editor.document.uri);
	const ide = root.settings.ide;
	if (!state || !doc || !ide) return;
	const copy: string[] = [];
	for (const selection of editor.selections) copy.push(getDecoratedText(state.prettySpans, doc.document, selection));
	if (copy.length > 0) await ide.copyToClipboard(copy.join('\n'));
}

/**
 * focusActiveEditor: repaints the document of the editor the ide reports, be it a
 * focus change or a selection change.
 * @param {EditorSnapshot | null} editor the editor the ide reports
 */
export function focusActiveEditor(editor: EditorSnapshot | null): void {
	if (!editor) return;
	getRoot().decorations.get(editor.document.uri)?.paintDocument();
}

/** copyWithSubstitutions: copies the decorated text of the active editor's selections.
 * @param {{ activeTextEditor: EditorSnapshot | null }} ide the ide whose active editor is copied
 */
export async function copyWithSubstitutions(ide: { activeTextEditor: EditorSnapshot | null }): Promise<void> {
	const editor = ide.activeTextEditor;
	if (editor) await copyDocumentText(editor);
}

/** togglePrettySymbols: toggles pretty symbols on the line under the active editor's cursor. */
export function togglePrettySymbols(): void {
	const decorations = getRoot().decorations;
	const editor = getRoot().settings.ide?.activeTextEditor;
	const line = editor?.selections[0]?.active.line;
	if (!editor || line === undefined) return;
	const state = decorations.get(editor.document.uri);
	state?.toggleLine(line);
	state?.paintDocument();
}
