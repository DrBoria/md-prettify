import type { Range } from "@md-prettify/types";
import { findSymbolsIn } from "./lookup";

/** Converts a document position to an offset within `originalText`, using the line-offset table. */
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

/** Builds a line-offset table: offsetOfLine[i] = character offset where line (range.start.line + i) begins. */
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
	state: { decorationCache: Map<string, { ranges: Set<Range>; pretty: string }> },
	range: Range,
	originalText: string,
	offsetOfLine: number[],
	activeHiddenRanges: Set<Range>,
): { start: number; end: number; subst: string }[] => {
	const lineCount = range.end.line - range.start.line + 1;
	const subs: { start: number; end: number; subst: string }[] = [];

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

	subs.sort(compareSubstitutionSpans);
	return subs;
};

/** Sorts by start offset ascending; for equal starts, longer range first. */
const compareSubstitutionSpans = (a: { start: number; end: number }, b: { start: number; end: number }): number =>
	a.start - b.start || (b.end - b.start) - (a.end - a.start);

/** Single forward pass: appends unchanged text segments + substitution text. */
const decoratedTextParts = (originalText: string, subs: { start: number; end: number; subst: string }[]): string[] => {
	const parts: string[] = [];
	let cursor = 0;
	for (const s of subs) {
		if (s.start < cursor) continue;
		if (s.start > cursor) parts.push(originalText.slice(cursor, s.start));
		parts.push(s.subst);
		cursor = s.end;
	}
	if (cursor < originalText.length) parts.push(originalText.slice(cursor));

	return parts;
};

/** The substitution spans for the text of the given range. */
const substitutionSpans = (
	state: { decorationCache: Map<string, { ranges: Set<Range>; pretty: string }>; hiddeDecorationsRanges: Set<Range> },
	range: Range,
	originalText: string,
): { start: number; end: number; subst: string }[] =>
	collectSubstitutionSpans(state, range, originalText, lineOffsetTable(range, originalText), findSymbolsIn(state, range));

/** Assembles the decorated text from the original text and its substitution spans. */
const decoratedTextFor = (originalText: string, subs: { start: number; end: number; subst: string }[]): string =>
	decoratedTextParts(originalText, subs).join('');

export const getDecoratedText = (
	state: {
		document: { validateRange: (r: Range) => Range; getText: (r: Range) => string } | null;
		decorationCache: Map<string, { ranges: Set<Range>; pretty: string }>;
		hiddeDecorationsRanges: Set<Range>;
	},
	range: Range,
): string => {
	if (!state.document) return '';
	range = state.document.validateRange(range);
	const originalText = state.document.getText(range);

	return decoratedTextFor(originalText, substitutionSpans(state, range, originalText));
};
