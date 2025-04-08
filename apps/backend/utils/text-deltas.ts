import type { Position, Range } from '../host';

// 'sticky' flag is not yet supported :(
export interface RangeDelta {
  start: Position;
  end: Position;
  linesDelta: number;
  endCharactersDelta: number; // delta for positions on the same line as the end position
}

/**
 * @returns the lines and characters represented by the text
 */
export function toRangeDelta(oldRange: Range, text: string): RangeDelta {
  // position of the end of `text`
  let newEndLine = 0;
  let newEndCharacter = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n') { newEndLine++; newEndCharacter = 0; i++; }
    else if (ch === '\r') {
      newEndLine++; newEndCharacter = 0; i++;
      if (text[i] === '\n') i++;
    }
    else { newEndCharacter++; i++; }
  }
  let charsDelta;
  if (oldRange.start.line == oldRange.end.line)
    charsDelta = newEndCharacter - (oldRange.end.character - oldRange.start.character);
  else
    charsDelta = newEndCharacter - oldRange.end.character;

  return {
    start: oldRange.start,
    end: oldRange.end,
    linesDelta: newEndLine - (oldRange.end.line - oldRange.start.line),
    endCharactersDelta: charsDelta,
  };
}

export function rangeDeltaNewRange(delta: RangeDelta): Range {
  let x: number;
  if (delta.linesDelta > 0)
    x = delta.endCharactersDelta;
  else if (delta.linesDelta < 0 && delta.start.line == delta.end.line + delta.linesDelta)
    x = delta.end.character + delta.endCharactersDelta + delta.start.character;
  else
    x = delta.end.character + delta.endCharactersDelta;
  return { __range: true, start: delta.start, end: { line: delta.end.line + delta.linesDelta, character: x } };
}

/** Adjusts a character offset for a delta that ends on the same line. */
const adjustSameLineCharacter = (character: number, delta: RangeDelta): number => {
  let x = character + delta.endCharactersDelta;
  if (delta.linesDelta > 0) {
    x = x - delta.end.character;
  } else if (delta.start.line == delta.end.line + delta.linesDelta && delta.linesDelta < 0) {
    x = x + delta.start.character;
  }
  return x;
};

/** Translates one end of a range by a delta, given whether it sits before, on, or after the delta end. */
const translatePosition = (p: Position, delta: RangeDelta, onEndLine: boolean, beforeEnd: boolean): Position => {
  if (beforeEnd) {
    return { line: p.line, character: p.character };
  }
  if (onEndLine) {
    return { line: p.line + delta.linesDelta, character: adjustSameLineCharacter(p.character, delta) };
  }
  return { line: p.line + delta.linesDelta, character: p.character };
};

export function rangeTranslate(range: Range, delta: RangeDelta): Range {
  const startOnEndLine = delta.end.line == range.start.line;
  const startBeforeEnd = range.start.line < delta.end.line || (startOnEndLine && range.start.character < delta.end.character);
  const endOnEndLine = delta.end.line == range.end.line;
  const endBeforeEnd = range.end.line < delta.end.line || (endOnEndLine && range.end.character <= delta.end.character);
  return {
    __range: true,
    start: translatePosition(range.start, delta, startOnEndLine, startBeforeEnd),
    end: translatePosition(range.end, delta, endOnEndLine, endBeforeEnd),
  };
}

const isAtRangeStart = (range: Range, pos: Position): boolean =>
  range.start.line === pos.line && range.start.character === pos.character;
const isAtOrAfterRangeStart = (range: Range, pos: Position): boolean =>
  range.start.line < pos.line || (range.start.line === pos.line && range.start.character <= pos.character);
const isAtRangeEnd = (range: Range, pos: Position): boolean =>
  range.end.line === pos.line && range.end.character === pos.character;
const isBeforeRangeEnd = (range: Range, pos: Position): boolean =>
  pos.line < range.end.line || (pos.line === range.end.line && pos.character < range.end.character);

export function rangeContains(range: Range, pos: Position, exclStart = false, inclEnd = false): boolean {
  if (!isAtOrAfterRangeStart(range, pos)) return false;
  if (exclStart && isAtRangeStart(range, pos)) return false;
  if (inclEnd && isAtRangeEnd(range, pos)) return true;
  return isBeforeRangeEnd(range, pos);
}

export function maxPosition(x: Position, y: Position): Position {
  if (x.line < y.line)
    return y;
  if (x.line > y.line)
    return x;
  if (x.character < y.character)
    return y;
  else
    return x;
}
