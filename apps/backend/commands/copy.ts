import type { Host } from '../host';
import { getDocument } from '../document/manager';
import { logInfo, logWarn } from '../config/logger';

/** Copy the visible (substituted) text of the active editor to the clipboard. */
export async function copyWithSubstitutions(host: Host): Promise<void> {
  const editor = host.activeTextEditor;
  if (!editor) {
    logWarn('copyWithSubstitutions: no active editor');
    return;
  }

  const doc = getDocument(editor.document);
  if (!doc) {
    logWarn(`copyWithSubstitutions: document is not pretty: ${editor.document.uri}`);
    return;
  }

  await doc.copyDecorated(editor);
  logInfo('Copied text with substitutions');
}
