import type { Range } from '../host';
import { positionFrom, rangeFrom, rangeFromPositions, positionCompare } from '../host';
import * as textUtil from '../utils/text-deltas';
import type { DocumentStore } from '../document/type';
import type { RangeDelta } from '../utils/text-deltas';
import { shiftRangeDeltaForSet } from '../resolve/cache';
import { reparsePretties } from './pretties';
import { buildLineIndex, rebuildRangeKeyMap, shiftKeyMapForSet } from '../resolve/range-index';

/** Rebuilds the derived indexes after a bulk mutation of the range sets. */
const rebuildDerivedIndexes = (state: DocumentStore): void => {
  state.lineIndex = buildLineIndex(state.hiddeDecorationsRanges);
  state.rangeKeyToCacheKey = rebuildRangeKeyMap(state);
};

const outsideLineRange = (r: Range, startLine: number, endLine: number): boolean =>
  r.start.line < startLine || r.start.line > endLine;

/** Sort document changes by start position, earliest first. */
const compareChangeStart = (change1: { range: Range }, change2: { range: Range }): number =>
  -positionCompare(change1.range.start, change2.range.start);

/** Shifts every decoration range by a single change's delta and updates the derived indexes. */
const applyChangeDelta = (state: DocumentStore, change: { range: Range, text: string }): RangeDelta => {
  const delta = textUtil.toRangeDelta(change.range, change.text);
  for (const cacheEntry of state.decorationCache.values()) {
    cacheEntry.ranges = shiftRangeDeltaForSet(cacheEntry.ranges, delta);
  }
  const oldHiddenRanges = state.hiddeDecorationsRanges;
  state.hiddeDecorationsRanges = shiftRangeDeltaForSet(oldHiddenRanges, delta);
  shiftKeyMapForSet(state.rangeKeyToCacheKey, oldHiddenRanges, (r) => textUtil.rangeTranslate(r, delta));
  state.lineIndex = buildLineIndex(state.hiddeDecorationsRanges);
  return delta;
};

/** Removes every range in the set that starts outside the given line range. */
const deleteRangesInLineRange = (ranges: Set<Range>, minLine: number, maxLine: number): void => {
  for (const r of ranges) {
    if (outsideLineRange(r, minLine, maxLine)) {
      ranges.delete(r);
    }
  }
};

/** Computes the line range to reparse after a bulk edit, clamped to the document. */
const reparseLineSpan = (minLine: number, maxLine: number, totalLinesDelta: number, docLineCount: number): [number, number] => {
  const finalMinLine = Math.max(0, minLine);
  const estimatedFinalMaxLine = maxLine + totalLinesDelta;
  const finalEndLine = Math.min(Math.max(0, docLineCount - 1), Math.max(estimatedFinalMaxLine, finalMinLine));
  return [finalMinLine, finalEndLine];
};

/** Clears decoration ranges within a line range and reparses that range. */
const reparseAffectedLines = (state: DocumentStore, minLine: number, maxLine: number, totalLinesDelta: number): void => {
  const docLineCount = state.document.getLineCount();
  const [finalMinLine, finalEndLine] = reparseLineSpan(minLine, maxLine, totalLinesDelta, docLineCount);

  if (finalMinLine > finalEndLine) {
    state.changedUglies = false;
    return;
  }

  deleteRangesInLineRange(state.hiddeDecorationsRanges, finalMinLine, finalEndLine);
  for (const cacheEntry of state.decorationCache.values()) {
    deleteRangesInLineRange(cacheEntry.ranges, finalMinLine, finalEndLine);
  }
  rebuildDerivedIndexes(state);

  try {
    const endLineLength = finalEndLine >= 0 && finalEndLine < docLineCount
      ? state.document.getLine(finalEndLine).length
      : 0;
    const reparseRange = rangeFromPositions(positionFrom(finalMinLine, 0), positionFrom(finalEndLine, endLineLength));
    reparsePretties(state, reparseRange);
    state.changedUglies = true;
  } catch (e) {
    console.error("Error during incremental reparse:", e);
    recomputeDecorations(state);
  }
};

/** reparses the document and recreates the highlights for all editors */
export const recomputeDecorations = (state: DocumentStore): void => {
  // Clear existing ranges from cache entries and hidden ranges
  for (const entry of state.decorationCache.values()) {
    entry.ranges.clear();
  }
  state.hiddeDecorationsRanges.clear();
  state.lineIndex.clear();
  state.rangeKeyToCacheKey.clear();
  state.grammarState = []; // Reset grammar state

  const docRange = rangeFrom(0, 0, state.document.getLineCount(), 0);
  reparsePretties(state, docRange); // Repopulates ranges in the cache
};

/**
 * Applies document changes to the decoration ranges: shifts all existing
 * ranges by the change deltas, then incrementally reparses the affected lines.
 * @returns true if the decorations were invalidated/updated
 */
export const applyChanges = (state: DocumentStore, changes: { range: Range, text: string }[]): boolean => {
  state.changedUglies = false; // assume no changes need to be made for now
  const sortedChanges = changes.sort(compareChangeStart);
  let minAffectedLineInitial = Infinity;
  let maxAffectedLineInitial = -Infinity;
  let totalLinesDelta = 0;

  // First pass: Apply deltas and track initial affected range + total line delta
  for (const change of sortedChanges) {
    try {
      const delta = applyChangeDelta(state, change);

      minAffectedLineInitial = Math.min(minAffectedLineInitial, change.range.start.line);
      maxAffectedLineInitial = Math.max(maxAffectedLineInitial, change.range.end.line);
      totalLinesDelta += delta.linesDelta;
    } catch (e) {
      console.error("Error applying change delta:", e);
      recomputeDecorations(state); // Fallback to full recompute on error
      return true; // Indicate that decorations might have changed due to fallback
    }
  }

  // Second pass: Determine final affected range and reparse
  if (minAffectedLineInitial <= maxAffectedLineInitial) {
    reparseAffectedLines(state, minAffectedLineInitial, maxAffectedLineInitial, totalLinesDelta);
  } else {
    state.changedUglies = false;
  }
  return state.changedUglies;
};
