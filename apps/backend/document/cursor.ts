import type { TextEditor, Selection } from '../host';
import { positionIsEqual, selectionFrom } from '../host';
import * as pos from '../utils/position';
import { applyActiveEditorDecorations } from './editor-decorations';
import type { DocumentStore } from './type';
import { commitSelections } from './store';

const defaultEqual = <T>(x: T, y: T): boolean => x === y;

/** Compares two arrays element-wise using the given equality check. */
const arrayEqual = <T>(a1: T[], a2: T[], isEqual: (x: T, y: T) => boolean = defaultEqual): boolean => {
  if (a1.length != a2.length)
    return false;
  for (let idx = 0; idx < a1.length; ++idx) {
    if (!isEqual(a1[idx], a2[idx]))
      return false;
  }
  return true;
};

/**
 * Adjusts the editor selections so cursors stay on the pretty text after
 * the document changed. Returns the adjusted selections, or null if nothing
 * changed.
 */
const adjustOneSelection = (
  state: DocumentStore,
  beforeSel: Selection,
  sel: Selection,
  adjustedSelections: Selection[],
): boolean => {
  const adjusted = pos.adjustCursorMovement(beforeSel.active, sel.active, state.document, state.prettyModel.getPrettySubstitutionsRanges());

  if (!positionIsEqual(adjusted.pos, sel.active)) {
    return true;
  }

  const adjustedAnchor = positionIsEqual(sel.anchor, beforeSel.active) ? adjusted.pos : sel.anchor;
  adjustedSelections.push(selectionFrom(adjustedAnchor, adjusted.pos));
  return false;
};

/** Records the editor's current selections as the baseline for cursor adjustment. */
const seedSelectionRecord = (state: DocumentStore, editor: TextEditor): void => {
  state.lastSelections.set(editor, editor.selections);
};

/** Adjusts every selection against its baseline; returns the adjusted list. */
const adjustAllSelections = (
  state: DocumentStore,
  before: Selection[],
  after: Selection[],
): Selection[] => {
  const adjustedSelections: Selection[] = [];
  for (let idx = 0; idx < after.length; idx++) {
    const sel = after[idx];
    const beforeSel = before.length > idx ? before[idx] : sel;
    adjustOneSelection(state, beforeSel, sel, adjustedSelections);
  }

  return adjustedSelections;
};

/** Whether any adjusted selection moved away from the editor's current position. */
const anySelectionMoved = (after: Selection[], adjustedSelections: Selection[]): boolean => {
  for (let idx = 0; idx < adjustedSelections.length; idx++) {
    if (!positionIsEqual(after[idx].active, adjustedSelections[idx].active)) return true;
  }

  return false;
};

/** Records the adjusted selections as the new baseline. */
const recordAdjustedSelections = (state: DocumentStore, editor: TextEditor, adjustedSelections: Selection[]): void => {
  state.lastSelections.set(editor, adjustedSelections);
};

/** True when the editor's selections are unchanged from the stored baseline. */
const selectionsUnchanged = (editor: TextEditor, before: Selection[]): boolean =>
  arrayEqual(before, editor.selections);

/** Commits the adjusted selections to the editor when any of them moved. */
const commitAdjustedSelections = (state: DocumentStore, editor: TextEditor, adjustedSelections: Selection[]): null | Selection[] => {
  if (anySelectionMoved(editor.selections, adjustedSelections)) return commitSelections(state, editor, adjustedSelections);

  return null;
};

export const adjustCursor = (state: DocumentStore, editor: TextEditor): null | Selection[] => {
  if (!state.prettyModel || !state.document) return null;
  const before = state.lastSelections.get(editor);
  if (!before) {
    seedSelectionRecord(state, editor);
    return null;
  }
  if (selectionsUnchanged(editor, before)) return null;

  const adjustedSelections = adjustAllSelections(state, before, editor.selections);
  recordAdjustedSelections(state, editor, adjustedSelections);

  return commitAdjustedSelections(state, editor, adjustedSelections);
};

/** The debounced selection update body. */
const runSelectionUpdate = (state: DocumentStore, editor: TextEditor): void => {
  if (!state.prettyModel || !state.document || editor.document.uri !== state.document.uri) return;
  if (state.adjustCursorMovement) adjustCursor(state, editor);

  const currentEditorSelections = editor.selections;
  const cursors = state.prettyModel.renderPrettyCursor(currentEditorSelections);
  const cR = cursors == null ? [] : Array.from(cursors.ranges);
  const revealed = state.prettyModel.revealSelections(currentEditorSelections);

  if (!arrayEqual(revealed.ranges, state.revealedRanges) || !arrayEqual(cR, state.cursorRanges)) {
    applyActiveEditorDecorations(
      state,
      [editor],
      Array.from(state.prettyModel.getDecorationsList()),
      revealed.ranges,
      cursors,
    );
    state.revealedRanges.replace(revealed.ranges);
    state.cursorRanges.replace(cR);
  }
};

/** Debounced selection handler: adjusts cursors and re-reveals if the revealed ranges changed. */
export const selectionChanged = (state: DocumentStore, editor: TextEditor): void => {
  if (!state.prettyModel || !state.document || editor.document.uri !== state.document.uri) {
    return;
  }

  state.updateSelection.call(function () {
    runSelectionUpdate(state, editor);
  });
};
