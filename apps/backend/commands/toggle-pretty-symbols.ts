import { getHost } from "../store.d/controller";
import { getRoot } from "../store";

/**
 * Toggles pretty symbols on the line under the active editor's cursor.
 * Unlike enable/disable, this is per-line: the rest of the file keeps
 * rendering normally.
 */
export const togglePrettySymbols = (): void => {
  const host = getHost();
  const editor = host?.activeTextEditor;
  if (!editor) {
    console.warn('togglePrettySymbols: no active editor');
    return;
  }
  const controller = editor ? getRoot().documents.get(editor.document.uri) : undefined;
  if (!controller) {
    console.info(`togglePrettySymbols: no controller for ${editor.document.fileName}`);
    return;
  }
  const line = editor.selections[0]?.active.line;
  if (line === undefined) {
    console.warn('togglePrettySymbols: no cursor position');
    return;
  }
  const disabled = controller.toggleLine(line);
  console.info(`togglePrettySymbols: line ${line} ${disabled ? 'disabled' : 'enabled'}`);
};
