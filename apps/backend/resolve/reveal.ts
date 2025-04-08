import type { Range, Selection } from '../host';
import { rangeFromPositions } from '../host';
import { mapSet } from '../utils/range';
import type { UpdateDecorationEntry, UpdateDecorationInstanceEntry } from '../document/type';
import type { DocumentStore } from '../document/type';
import { findSymbolAt, findSymbolsIn } from './lookup';

type GetRanges = (sel: Selection) => Range | Set<Range> | undefined;
type GetRange = (sel: Selection) => Range | undefined;

/** Normalizes a single getRanges result into an iterable of ranges. */
const rangeList = (r: Range | Set<Range>): Iterable<Range> => (r instanceof Set ? r : [r]);

/** The ranges found for one selection, skipping disabled lines. */
const selectionRanges = (state: DocumentStore, selection: Selection, getRanges: GetRanges): Set<Range> => {
  const r = getRanges(selection);
  if (!r) return new Set<Range>();

  return mapSet(new Set(rangeList(r)), (range) => (state.disabledLines.has(range.start.line) ? undefined : range));
};

/** Collects all ranges found by `getRanges` across the given selections, skipping disabled lines. */
const collectRanges = (state: DocumentStore, selections: Selection[], getRanges: GetRanges): Set<Range> => {
  const found = new Set<Range>();
  for (const selection of selections) {
    for (const range of selectionRanges(state, selection, getRanges)) found.add(range);
  }
  return found;
};

const revealRangesForCursor = (
  state: DocumentStore,
  sel: Selection,
  options: { includeEnd?: boolean, excludeStart?: boolean },
): Range | undefined => findSymbolAt(state, sel.active, options);

const revealRangesForActiveLine = (state: DocumentStore, sel: Selection): Range | Set<Range> | undefined =>
  findSymbolsIn(state, state.document.getLineRange(sel.active.line));

const revealRangesForSelection = (state: DocumentStore, sel: Selection): Range | Set<Range> | undefined =>
  findSymbolsIn(state, rangeFromPositions(sel.start, sel.end));

const boxRangesForCursor = (state: DocumentStore, sel: Selection): Range | undefined =>
  findSymbolAt(state, sel.active);

/** Builds the reveal decoration entry for the ranges collected across the selections. */
const reveal = (state: DocumentStore, selections: Selection[], getRanges: GetRanges): UpdateDecorationEntry => {
  const decoration = state.revealedUglyDecoration || state.host.createDecorationType({});
  return {
    decoration,
    ranges: Array.from(collectRanges(state, selections, getRanges)),
  };
};

/**
 * Computes the decoration entry that reveals the ugly text under the given selections,
 * depending on the configured reveal strategy.
 */
export const revealSelections = (state: DocumentStore, selections: Selection[]): UpdateDecorationEntry => {
  // add the new intersections
  switch (state.revealStrategy) {
    case 'cursor':
    case 'cursor-inside': {
      const cursorOptions = state.revealStrategy === 'cursor' ? { includeEnd: true } : { excludeStart: true };
      return reveal(state, selections, function (sel) { return revealRangesForCursor(state, sel, cursorOptions); });
    }
    case 'active-line':
      return reveal(state, selections, function (sel) { return revealRangesForActiveLine(state, sel); });
    case 'selection':
      return reveal(state, selections, function (sel) { return revealRangesForSelection(state, sel); });
    default:
      return { decoration: state.revealedUglyDecoration || state.host.createDecorationType({}), ranges: [] };
  }
};

/**
 * Finds all pretty symbols on the given line; used by the per-line toggle.
 */
export const findSymbolsOnLine = (state: DocumentStore, line: number): Range[] => {
  return Array.from(findSymbolsIn(state, state.document.getLineRange(line)));
};

/** Builds the boxed-cursor decoration entry around the pretty symbol under the cursor. */
const boxPretty = (state: DocumentStore, selections: Selection[], getRange: GetRange): UpdateDecorationInstanceEntry | null => {
  try {
    return {
      decoration: state.boxedSymbolDecoration || {},
      ranges: collectRanges(state, selections, getRange),
    };
  } catch (err) {
    console.error(err);
    console.error('\n');
    return null;
  }
};

/**
 * Computes the decoration entry that draws a box around the pretty symbol
 * under the cursor, depending on the configured pretty cursor style.
 */
export const renderPrettyCursor = (state: DocumentStore, selections: Selection[]): UpdateDecorationInstanceEntry | null => {
  switch (state.prettyCursor) {
    case 'boxed': {
      return boxPretty(state, selections, function (sel) { return boxRangesForCursor(state, sel); });
    }
    default:
      return null;
  }
};
