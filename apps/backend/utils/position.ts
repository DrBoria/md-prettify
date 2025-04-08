import type { Position, Range } from '../host';
import type { DocumentView } from '../document/type';
import { positionCompare } from './range';

const isStrictlyInside = (range: Range, p: Position): boolean => {
  const afterStart = positionCompare(p, range.start) > 0;
  const beforeEnd = positionCompare(p, range.end) < 0;
  return afterStart && beforeEnd;
};

/** Binary search for the range that strictly contains `end`; undefined when none does. */
const findRangeContaining = (avoidRanges: Range[], end: Position): { range: Range, index: number } | undefined => {
  let begin = 0;
  let endIdx = avoidRanges.length;
  while (begin < endIdx) {
    const idx = (begin + endIdx) >> 1;
    const range = avoidRanges[idx];
    if (isStrictlyInside(range, end)) {
      return { range, index: idx };
    }
    const beforeStart = positionCompare(end, range.start) < 0;
    if (beforeStart) {
      endIdx = idx;
    } else {
      begin = idx + 1;
    }
  }
  return undefined;
};

/** Snaps the cursor to the edge of the range it would have crossed, based on movement direction. */
const snapToRangeEdge = (start: Position, end: Position, range: Range): { pos: Position, range: Range } => {
  if (start.line === end.line && start.character > end.character) {
    return { pos: range.start, range }; // moving left
  }
  if (start.line === end.line && start.character < end.character) {
    return { pos: range.end, range }; // moving right
  }
  return { pos: end, range: undefined };
};

export function adjustCursorMovement(start: Position, end: Position, doc: DocumentView, avoidRanges: Range[]): {pos: Position, range: Range} {
  try {
    const match = findRangeContaining(avoidRanges, end);
    if (match) {
      return snapToRangeEdge(start, end, match.range);
    }
  } catch (err) {
    // cursor movement adjustment failed — fall through to the plain position
  }
  return {pos: end, range: undefined};
}