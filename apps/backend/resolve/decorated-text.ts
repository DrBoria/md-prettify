import type { Range } from '../host';
import type { DocumentStore } from '../document/type';
import { findSymbolsIn } from './lookup';

/**
 * Returns what the contents of the document would appear to be after decorations
 * (i.e. with substitutions applied to the text) for the given range.
 *
 * Linear algorithm: builds a line-offset table by scanning newlines in
 * originalText (O(totalTextLength)), computes each substitution's offsets
 * in O(1), then assembles the result in a single forward pass.
 * Total: O(M log M + totalTextLength) where M = number of active ranges.
 */
/**
 * Converts a document position to an offset within `originalText`, using the
 * precomputed line-offset table. Returns -1 when the position is outside the
 * range or beyond the text.
 */
const toOffset = (range: Range, lineCount: number, offsetOfLine: number[], textLength: number, line: number, character: number): number => {
  const relLine = line - range.start.line;
  if (relLine < 0 || relLine > lineCount - 1) return -1;
  if (relLine === 0) {
    const offset = character - range.start.character;
    return offset >= 0 ? offset : -1;
  }
  const offset = offsetOfLine[relLine] + character;
  return offset <= textLength ? offset : -1;
};

type SubstitutionSpan = { start: number, end: number, subst: string };

/**
 * Builds a line-offset table: offsetOfLine[i] = character offset within
 * originalText where line (range.start.line + i) begins.
 */
const lineOffsetTable = (range: Range, originalText: string): number[] => {
  const lineCount = range.end.line - range.start.line + 1;
  const offsetOfLine = new Array<number>(lineCount + 1);
  offsetOfLine[0] = 0;
  let scanPos = 0;
  for (let i = 0; i < lineCount; i++) {
    const nlIdx = originalText.indexOf('\n', scanPos);
    if (nlIdx === -1) {
      offsetOfLine[i + 1] = originalText.length;
      for (let j = i + 2; j <= lineCount; j++) offsetOfLine[j] = originalText.length;
      break;
    }
    scanPos = nlIdx + 1;
    offsetOfLine[i + 1] = scanPos;
  }

  return offsetOfLine;
};

/** Collects the spans of the active substitutions, sorted by start (longer first on ties). */
const collectSubstitutionSpans = (
  state: DocumentStore,
  range: Range,
  originalText: string,
  offsetOfLine: number[],
  activeHiddenRanges: Set<Range>,
): SubstitutionSpan[] => {
  const lineCount = range.end.line - range.start.line + 1;
  const subs: SubstitutionSpan[] = [];

  for (const cacheEntry of state.decorationCache.values()) {
    for (const sr of cacheEntry.ranges) {
      if (!activeHiddenRanges.has(sr)) continue;
      const start = toOffset(range, lineCount, offsetOfLine, originalText.length, sr.start.line, sr.start.character);
      const end = toOffset(range, lineCount, offsetOfLine, originalText.length, sr.end.line, sr.end.character);
      if (start !== -1 && end !== -1 && start < end) {
        subs.push({ start, end, subst: cacheEntry.pretty });
      }
    }
  }

  // Sort by start offset ascending; for equal starts, longer range first
  // (outer range wins in the overlap skip below).
  subs.sort(compareSubstitutionSpans);

  return subs;
};

/** Sorts by start offset ascending; for equal starts, longer range first. */
const compareSubstitutionSpans = (a: SubstitutionSpan, b: SubstitutionSpan): number =>
  a.start - b.start || (b.end - b.start) - (a.end - a.start);

/** Single forward pass: appends unchanged text segments + substitution text. */
const decoratedTextParts = (originalText: string, subs: SubstitutionSpan[]): string[] => {
  const parts: string[] = [];
  let cursor = 0;
  for (const s of subs) {
    if (s.start < cursor) continue; // overlaps previous — skip
    if (s.start > cursor) parts.push(originalText.slice(cursor, s.start));
    parts.push(s.subst);
    cursor = s.end;
  }
  if (cursor < originalText.length) parts.push(originalText.slice(cursor));

  return parts;
};

/** The active hidden ranges (pretty symbols) intersecting the given range. */
const activeHiddenRanges = (state: DocumentStore, range: Range): Set<Range> => findSymbolsIn(state, range);

/** The substitution spans for the text of the given range. */
const substitutionSpans = (state: DocumentStore, range: Range, originalText: string): SubstitutionSpan[] =>
  collectSubstitutionSpans(state, range, originalText, lineOffsetTable(range, originalText), activeHiddenRanges(state, range));

/** Assembles the decorated text from the original text and its substitution spans. */
const decoratedTextFor = (originalText: string, subs: SubstitutionSpan[]): string =>
  decoratedTextParts(originalText, subs).join('');

export const getDecoratedText = (state: DocumentStore, range: Range): string => {
  if (!state.document) return '';
  range = state.document.validateRange(range);
  const originalText = state.document.getText(range);

  return decoratedTextFor(originalText, substitutionSpans(state, range, originalText));
};
