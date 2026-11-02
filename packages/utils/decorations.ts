import type { Range, TextEditorDecorationType } from '@md-prettify/types';
import { rangeIntersection } from './range';

/** One decoration entry: a decoration type and the ranges to apply to it. */
export type DecorationListEntry = { decoration: TextEditorDecorationType; ranges: Range[] };

/** Keeps only the ranges whose start line is not in the disabled set. */
export const filterEnabledRanges = (disabled: Set<number>, ranges: Iterable<Range>): Range[] => {
  const out: Range[] = [];
  for (const r of ranges) {
    if (!disabled.has(r.start.line)) out.push(r);
  }
  return out;
};

/** The decoration entries from the cache, skipping lines with pretty symbols disabled. */
export const collectCacheDecorationEntries = <T extends { decorationType: TextEditorDecorationType; ranges: Set<Range> }>(
  disabled: Set<number>,
  decorationCache: Map<string, T>,
): DecorationListEntry[] => {
  const entries: DecorationListEntry[] = [];
  for (const entry of decorationCache.values()) {
    const ranges = filterEnabledRanges(disabled, entry.ranges);
    if (ranges.length > 0) entries.push({ decoration: entry.decorationType, ranges });
  }
  return entries;
};

/** The hidden-decoration entry, or null when there is nothing hidden to draw. */
export const collectHiddenDecorationEntry = (
  disabled: Set<number>,
  hiddenRanges: Set<Range>,
  hiddenDecoration: TextEditorDecorationType | null,
): DecorationListEntry | null => {
  const ranges = filterEnabledRanges(disabled, hiddenRanges);
  if (hiddenDecoration && ranges.length > 0) return { decoration: hiddenDecoration, ranges };
  return null;
};

/** The full decoration list to apply: cache entries first, the hidden entry last. */
export const buildDecorationsList = <T extends { decorationType: TextEditorDecorationType; ranges: Set<Range> }>(
  disabled: Set<number>,
  decorationCache: Map<string, T>,
  hiddenRanges: Set<Range>,
  hiddenDecoration: TextEditorDecorationType | null,
): DecorationListEntry[] => {
  const entries = collectCacheDecorationEntries(disabled, decorationCache);
  const hidden = collectHiddenDecorationEntry(disabled, hiddenRanges, hiddenDecoration);
  if (hidden) entries.push(hidden);
  return entries;
};

/** Every decoration type currently owned, for clearing on dispose. */
export const collectDecorationTypes = <T extends { decorationType: TextEditorDecorationType; ranges: Set<Range> }>(
  hiddenDecoration: TextEditorDecorationType | null,
  revealedUglyDecoration: TextEditorDecorationType | null,
  decorationCache: Map<string, T>,
): TextEditorDecorationType[] => {
  const types: TextEditorDecorationType[] = [];
  if (hiddenDecoration) types.push(hiddenDecoration);
  if (revealedUglyDecoration) types.push(revealedUglyDecoration);
  for (const entry of decorationCache.values()) types.push(entry.decorationType);
  return types;
};

/** The ranges that remain visible after removing every range that intersects a revealed range. */
export const visibleRanges = (ranges: Range[], reveal: Range[]): Range[] => {
  const visible: Range[] = [];
  for (const r of ranges) {
    let intersects = false;
    for (const s of reveal) {
      if (rangeIntersection(s, r) !== null) { intersects = true; break; }
    }
    if (!intersects) visible.push(r);
  }
  return visible;
};

/**
 * Switches pretty symbols on the given line and reports the state before the
 * switch. Returns false without switching when the line has no pretty symbol.
 */
export const switchedLineDisabled = (
  disabledLines: Set<number>,
  line: number,
  hasSymbolsOnLine: (line: number) => boolean,
): boolean | null => {
  const disabled = disabledLines.has(line);
  if (disabled) {
    disabledLines.delete(line);
  } else {
    if (!hasSymbolsOnLine(line)) return null;
    disabledLines.add(line);
  }
  return disabled;
};

/** The decoration entries for the given store state, skipping disabled lines. */
export const documentDecorationEntries = <T extends { decorationType: TextEditorDecorationType; ranges: Set<Range> }>(
  disabledLines: Set<number>,
  decorationCache: Map<string, T>,
  hiddenRanges: Set<Range>,
  hiddenDecoration: TextEditorDecorationType | null,
): DecorationListEntry[] => buildDecorationsList(disabledLines, decorationCache, hiddenRanges, hiddenDecoration);

/** Switches pretty symbols on the given line, skipping it when it has none. */
export const toggleLineDisabled = (
  disabledLines: Set<number>,
  line: number,
  hasSymbolsOnLine: (line: number) => boolean,
): boolean | null => switchedLineDisabled(disabledLines, line, hasSymbolsOnLine);
