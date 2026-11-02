import type { Position, Range, CursorMovementDocument } from '@md-prettify/types';

/** Lexicographic position order: -1 when `a` precedes `b`, 1 when it follows, 0 when equal. */
const positionCompare = (a: Position, b: Position): number => {
  if (a.line < b.line) return -1;
  if (a.line > b.line) return 1;
  if (a.character < b.character) return -1;
  if (a.character > b.character) return 1;
  return 0;
};

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

export function adjustCursorMovement(start: Position, end: Position, doc: CursorMovementDocument, avoidRanges: Range[]): {pos: Position, range: Range} {
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
