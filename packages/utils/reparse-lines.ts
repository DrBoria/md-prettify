import type { Range } from "@md-prettify/types";
import { positionCompare } from "./range";

/** True when a range starts outside the given line span. */
export const outsideLineRange = (r: Range, startLine: number, endLine: number): boolean =>
	r.start.line < startLine || r.start.line > endLine;

/** Sort document changes by start position, earliest first. */
export const compareChangeStart = (change1: { range: Range }, change2: { range: Range }): number =>
	-positionCompare(change1.range.start, change2.range.start);

/** Computes the line range to reparse after a bulk edit, clamped to the document. */
export const reparseLineSpan = (minLine: number, maxLine: number, totalLinesDelta: number, docLineCount: number): [number, number] => {
	const finalMinLine = Math.max(0, minLine);
	const estimatedFinalMaxLine = maxLine + totalLinesDelta;
	const finalEndLine = Math.min(Math.max(0, docLineCount - 1), Math.max(estimatedFinalMaxLine, finalMinLine));
	return [finalMinLine, finalEndLine];
};

/** Returns a new set holding only the ranges that start inside the given line span. */
export const rangesOutsideLineRange = (ranges: Set<Range>, minLine: number, maxLine: number): Set<Range> => {
	const kept = new Set<Range>();
	for (const r of ranges) {
		if (!outsideLineRange(r, minLine, maxLine)) kept.add(r);
	}
	return kept;
};
