import type { Position, Range } from '../host';
import { rangeContains, positionIsEqual, rangeIntersection } from '../host';
import type { DocumentStore } from '../document/type';

const isPositionAtStart = (range: Range, pos: Position): boolean => positionIsEqual(range.start, pos);
const isPositionAtEnd = (range: Range, pos: Position): boolean => positionIsEqual(range.end, pos);

/**
 * Checks whether a position is contained in a range with the given edge-inclusion options.
 */
const rangeContainsPosition = (range: Range, pos: Position, options: { excludeStart: boolean, includeEnd: boolean }): boolean => {
  const contained = rangeContains(range, pos);
  const atStart = isPositionAtStart(range, pos);
  const atEnd = isPositionAtEnd(range, pos);

  if (options.excludeStart) {
    if (options.includeEnd) {
      return contained && !atStart;
    }
    return contained && !atStart && !atEnd;
  }
  if (options.includeEnd) {
    return contained || atEnd;
  }
  return contained;
};

/**
 * Finds the hidden range containing the given position.
 */
export const findSymbolAt = (state: DocumentStore, pos: Position, options: { excludeStart?: boolean, includeEnd?: boolean } = { excludeStart: false, includeEnd: false }): Range | undefined => {
  for (const range of state.hiddeDecorationsRanges) {
    if (rangeContainsPosition(range, pos, { excludeStart: options.excludeStart, includeEnd: options.includeEnd })) {
      return range;
    }
  }
  return undefined;
};

/**
 * Finds all hidden ranges overlapping the given range.
 */
export const findSymbolsIn = (state: DocumentStore, range: Range): Set<Range> => {
  const overlappingRanges = new Set<Range>();
  state.hiddeDecorationsRanges.forEach((hiddenRange) => {
    if (rangeIntersection(range, hiddenRange)) { // Check for intersection (overlap)
      overlappingRanges.add(hiddenRange);
    }
  });
  return overlappingRanges;
};
