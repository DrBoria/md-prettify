import type { TextEditor } from "../../host";
import type { Selection } from "../../host";
import type { DocumentStore } from "../type";
import { commitSelections } from "./decorations";

/**
 * Adjusts every selection against the baseline recorded for the editor, writes
 * the result back to the editor and records it as the new baseline.
 */
export const adjustCursorAction = (state: DocumentStore, editor: TextEditor): null | Selection[] => {
  state.lastSelections.set(editor, editor.selections);
  return commitSelections(state, editor, editor.selections);
};

/** Debounced selection handler: adjusts cursors and re-reveals if the revealed ranges changed. */
export const selectionChangedAction = (state: DocumentStore, editor: TextEditor): void => {
  state.updateSelection.call(function () {
    if (state.adjustCursorMovement) adjustCursorAction(state, editor);
  });
};
