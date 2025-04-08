/**
 * The host's own geometry value types: Position, Range, Selection.
 *
 * The backend owns its geometry — an IDE adapter converts IDE geometry to
 * these via the `*From` factories and back. Kept in the decorations feature
 * because decoration ranges are built from them.
 *
 * Functional by design: the types are plain interfaces and all behavior is
 * module-scope free functions (the backend is functional + mobx, no classes).
 */

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  /** Brand: lets `isRange` tell a Range apart from a Position. */
  readonly __range: true;
  readonly start: Position;
  readonly end: Position;
}

export interface Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export const positionFrom = (line: number, character: number): Position => ({
  line,
  character,
});

export const positionCompare = (a: Position, b: Position): number => {
  if (a.line < b.line) return -1;
  if (a.line > b.line) return 1;
  if (a.character < b.character) return -1;
  if (a.character > b.character) return 1;
  return 0;
};

export const positionIsEqual = (a: Position, b: Position): boolean =>
  a.line === b.line && a.character === b.character;

export const positionIsNull = (p: Position): boolean =>
  p.line < 0 && p.character < 0;

export const positionTranslate = (p: Position, lineDelta = 0, charDelta = 0): Position => ({
  line: p.line + lineDelta,
  character: p.character + charDelta,
});

export const positionWith = (p: Position, line?: number, character?: number): Position => {
  if (line === undefined && character === undefined) return p;
  return { line: line ?? p.line, character: character ?? p.character };
};

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

/** 4-arg form, mirroring `vscode.Range`: (startLine, startChar, endLine, endChar). */
export const rangeFrom = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): Range => ({
  __range: true,
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

/** 2-arg form: (start: Position, end: Position). */
export const rangeFromPositions = (start: Position, end: Position): Range => ({
  __range: true,
  start,
  end,
});

/** Type guard: distinguishes a Range from a Position. */
export const isRange = (value: Position | Range): value is Range =>
  (value as Range).__range === true;

export const rangeIsEmpty = (r: Range): boolean =>
  r.start.line === r.end.line && r.start.character === r.end.character;

export const rangeIsEqual = (a: Range, b: Range): boolean =>
  a.start.line === b.start.line && a.start.character === b.start.character &&
  a.end.line === b.end.line && a.end.character === b.end.character;

export const rangeIsSingleLine = (r: Range): boolean =>
  r.start.line === r.end.line;

export const rangeIsValid = (r: Range): boolean =>
  !(r.start.line > r.end.line || (r.start.line === r.end.line && r.start.character > r.end.character));

/** True when `p` is not before `start` and not after `end` (both inclusive). */
const positionWithinBounds = (p: Position, start: Position, end: Position): boolean =>
  positionCompare(p, start) >= 0 && positionCompare(p, end) <= 0;

export const rangeContains = (range: Range, positionOrRange: Position | Range): boolean => {
  const r = positionOrRange as Range;
  if (r.__range === true) {
    return positionWithinBounds(r.start, range.start, range.end) && positionWithinBounds(r.end, range.start, range.end);
  }
  const p = positionOrRange as Position;
  return positionWithinBounds(p, range.start, range.end);
};

export const rangeIntersection = (range: Range, other: Range): Range | null => {
  const start = positionCompare(range.start, other.start) > 0 ? range.start : other.start;
  const end = positionCompare(range.end, other.end) < 0 ? range.end : other.end;
  if (positionCompare(start, end) > 0) return null;
  return { __range: true, start, end };
};

export const rangeUnion = (range: Range, other: Range): Range => {
  const startBefore = range.start.line < other.start.line || (range.start.line === other.start.line && range.start.character < other.start.character);
  const start = startBefore ? range.start : other.start;
  const endAfter = range.end.line > other.end.line || (range.end.line === other.end.line && range.end.character > other.end.character);
  const end = endAfter ? range.end : other.end;
  return { __range: true, start, end };
};

export const rangeEndIsAt = (r: Range, line: number, character: number): boolean =>
  r.end.line === line && r.end.character === character;

export const rangeTranslate = (range: Range, lineDelta = 0, charDelta = 0): Range => ({
  __range: true,
  start: { line: range.start.line + lineDelta, character: range.start.character + charDelta },
  end: { line: range.end.line + lineDelta, character: range.end.character + charDelta },
});

export const rangeWith = (range: Range, start?: Position, end?: Position): Range =>
  ({ __range: true, start: start ?? range.start, end: end ?? range.end });

/** Maps every element of a set through `fn`, collecting non-undefined results into a new set. */
export const mapSet = <T, U>(set: Set<T>, fn: (item: T) => U | undefined): Set<U> => {
  const out = new Set<U>();
  for (const item of set) {
    const mapped = fn(item);
    if (mapped !== undefined) out.add(mapped);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export const selectionFrom = (anchor: Position, active: Position): Selection => ({
  __range: true,
  start: anchor,
  end: active,
  anchor,
  active,
});
