import type { Selection, Range, CursorMovementDocument } from '@md-prettify/types';
import { positionIsEqual, selectionFrom } from './range';
import { adjustCursorMovement } from './cursor-movement';

const defaultEqual = <T,>(x: T, y: T): boolean => x === y;

/** Compares two arrays element-wise using the given equality check. */
export const arrayEqual = <T,>(a1: T[], a2: T[], isEqual: (x: T, y: T) => boolean = defaultEqual): boolean => {
  if (a1.length !== a2.length) return false;
  for (let idx = 0; idx < a1.length; idx += 1) {
    if (!isEqual(a1[idx], a2[idx])) return false;
  }
  return true;
};

/** True when two selection lists are element-wise identical. */
export const selectionsEqual = (a: Selection[], b: Selection[]): boolean => arrayEqual(a, b);

/** Whether any adjusted selection moved away from the editor's current position. */
export const anySelectionMoved = (after: Selection[], adjustedSelections: Selection[]): boolean => {
  for (let idx = 0; idx < adjustedSelections.length; idx++) {
    if (!positionIsEqual(after[idx].active, adjustedSelections[idx].active)) return true;
  }
  return false;
};

/** Snaps every selection to the edge of the range it crossed; returns the adjusted list. */
export const computeAdjustedSelections = (
  before: Selection[],
  after: Selection[],
  doc: CursorMovementDocument,
  avoidRanges: Range[],
): Selection[] => {
  const adjustedSelections: Selection[] = [];
  for (let idx = 0; idx < after.length; idx++) {
    const sel = after[idx];
    const beforeSel = before.length > idx ? before[idx] : sel;
    const adjusted = adjustCursorMovement(beforeSel.active, sel.active, doc, avoidRanges);
    if (!positionIsEqual(adjusted.pos, sel.active)) continue;
    const adjustedAnchor = positionIsEqual(sel.anchor, beforeSel.active) ? adjusted.pos : sel.anchor;
    adjustedSelections.push(selectionFrom(adjustedAnchor, adjusted.pos));
  }
  return adjustedSelections;
};
