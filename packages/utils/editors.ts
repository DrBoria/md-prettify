import type { TextEditor, Range, TextEditorDecorationType } from '@md-prettify/types';
import { visibleRanges } from './decorations';

/** All visible editors showing the given document uri. */
export const editorsForDocument = (visibleTextEditors: TextEditor[], documentUri: string | undefined): TextEditor[] => {
  const editors: TextEditor[] = [];
  for (const editor of visibleTextEditors) {
    if (editor && editor.document && editor.document.uri === documentUri) editors.push(editor);
  }
  return editors;
};

/** Whether the editor is usable for decoration updates. */
export const editorUsable = (editor: TextEditor | undefined): boolean =>
  !!editor && !!editor.document && !editor.document.isClosed;

/** One decoration entry to apply to an editor. */
export type DecorationEntry = { decoration: TextEditorDecorationType; ranges: Range[] };

/** Applies every decoration entry to the open editors, skipping revealed ranges. */
export const applyDecorationEntries = (editors: Iterable<TextEditor>, decs: DecorationEntry[], reveal: Range[]): void => {
  for (const editor of editors) {
    if (!editorUsable(editor)) continue;
    for (const d of decs) {
      if (d && d.decoration) {
        editor.setDecorations(d.decoration, visibleRanges(d.ranges, reveal));
      }
    }
  }
};
