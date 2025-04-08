import type { Position } from '../host';

/** Index just past the line ending at or after `from`, or text.length when there is none. */
const nextLineEnd = (text: string, from: number): number => {
  let index = 0;
  for (index = from; index < text.length; index++) {
    if (text[index] === '\n' || text[index] === '\r') break;
  }
  if (index >= text.length) return text.length;
  if (text[index] === '\r' && text[index + 1] === '\n') return index + 2;
  return index + 1;
};

export function offsetAt(text: string, pos: Position): number {
  let line = pos.line;
  let lastIndex = 0;
  while (line > 0) {
    let i = lastIndex;
    let found = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\n') { i++; found = true; break; }
      if (ch === '\r') {
        i++;
        if (text[i] === '\n') i++;
        found = true;
        break;
      }
      i++;
    }
    if (!found) return -1; // the position is beyond the length of text
    lastIndex = i;
    line--;
  }
  return lastIndex + pos.character;
}

/** Calculates the offset into text of pos, where textStart is the position where text starts and both pos and textStart are absolute positions.
 * @return the offset into text indicated by pos, or -1 if pos is out of range
 *
 * 'abc\ndef'
 * 'acbX\ndef'
 * +++*** --> +++_***
 * */
/** Advances `offset` past `count` line endings, or returns -1 if the text runs out first. */
const skipLines = (text: string, offset: number, count: number): number => {
  for (let n = 0; n < count; n++) {
    offset = nextLineEnd(text, offset);
    if (offset >= text.length) return -1;
  }
  return offset;
};

export function relativeOffsetAtAbsolutePosition(text: string, textStart: Position, pos: Position): number {
  if (textStart.line > pos.line) return -1;
  if (textStart.line === pos.line) {
    const d = pos.character - textStart.character;
    return d < 0 ? -1 : d;
  }
  const lineOffset = skipLines(text, 0, pos.line - textStart.line);
  if (lineOffset < 0) return -1;
  const d = pos.character + lineOffset;
  return d < 0 ? -1 : d;
}

/**
 * @returns the Position (line, column) for the location (character position), assuming that text begins at start
 */
/** Walks line endings in `text` until the line containing `offset`, then builds the position. */
const positionFromLineStart = (text: string, offset: number, startLine: number, startCharacter: number): Position => {
  let lastIndex = 0;
  let lineEnd = nextLineEnd(text, lastIndex);
  let crossed = 0;
  while (lineEnd < offset) {
    lastIndex = lineEnd;
    crossed += 1;
    lineEnd = nextLineEnd(text, lastIndex);
  }

  const line = startLine + crossed;
  const character = crossed === 0 ? startCharacter + (offset - lastIndex) : offset - lastIndex;

  return { line, character };
};

export function positionAtRelative(start: Position, text: string, offset: number): Position {
  if (offset > text.length) offset = text.length;
  return positionFromLineStart(text, offset, start.line, start.character);
}

/**
 * @returns the Position (line, column) for the location (character position)
 */
export function positionAt(text: string, offset: number): Position {
  if (offset > text.length) offset = text.length;
  return positionFromLineStart(text, offset, 0, 0);
}
