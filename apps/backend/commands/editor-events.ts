import type { Host, TextEditor } from '../host';
import type { PrettyDocumentController } from '../document/store';
import { getRoot } from '../store';

/** Copies the decorated text of the active editor's selections to the clipboard. */
export const copyWithSubstitutions = async (host: Host): Promise<void> => {
  const editor = host.activeTextEditor;
  if (!editor) return;
  const controller: PrettyDocumentController | undefined = getRoot().documents.get(editor.document.uri);
  if (!controller) return;
  await controller.copyDecorated(editor);
};

/** Runs the focused document's controller on an active-editor change. */
export const onActiveEditorChanged = (editor: TextEditor | null): void => {
  const controller: PrettyDocumentController | undefined = editor ? getRoot().documents.get(editor.document.uri) : undefined;
  if (editor && controller) controller.gotFocus(editor);
};

/** Runs the document's controller on a selection change. */
export const onSelectionChanged = (event: { editor: TextEditor }): void => {
  const controller: PrettyDocumentController | undefined = getRoot().documents.get(event.editor.document.uri);
  if (controller) controller.selectionChanged(event.editor);
};
