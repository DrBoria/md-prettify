/** Half-open spans: building them, comparing them, and reading the text they address. */
import type { Position, Range, Selection, TextDocument, UglyRevelation } from '@md-prettify/types';
import { positionCompare, positionFrom } from './index';

/** rangeFrom: builds a span from four coordinates and refuses an inverted one,
 * @param {number} startLine the line the span starts on
 * @param {number} startCharacter the column the span starts at
 * @param {number} endLine the line the span ends on
 * @param {number} endCharacter the column the span ends at
 * @returns {Range} the checked span */
export function rangeFrom(startLine: number, startCharacter: number, endLine: number, endCharacter: number): Range {
	if (startLine > endLine || (startLine === endLine && startCharacter > endCharacter)) {
		throw new RangeError(`range start must not be after its end: ${startLine}:${startCharacter}-${endLine}:${endCharacter}`);
	}
	return {
		__range: true,
		start: { line: startLine, character: startCharacter },
		end: { line: endLine, character: endCharacter },
	};
}

/** rangeFromPositions: builds a span from two points and checks their order,
 * @param {Position} start the point the span starts at
 * @param {Position} end the point the span ends at
 * @returns {Range} the checked span */
export function rangeFromPositions(start: Position, end: Position): Range {
	if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
		throw new RangeError(`range start must not be after its end: ${start.line}:${start.character}-${end.line}:${end.character}`);
	}
	return {
		__range: true,
		start,
		end,
	};
}

/** rangeIsEqual: compares two spans by value, because the store keeps fresh copies of the same span.
 * @param {Range} a the first span
 * @param {Range} b the second span
 * @returns {boolean} true when both spans cover the same stretch
 */
export function rangeIsEqual(a: Range, b: Range): boolean {
	if (a === b) return true;
	return (
		a.start.line === b.start.line &&
		a.start.character === b.start.character &&
		a.end.line === b.end.line &&
		a.end.character === b.end.character
	);
}

/** selectionFrom: builds a selection from its two ends, refusing a negative point so a ide selection stays valid.
 * @param {Position} anchor the end the selection was started from
 * @param {Position} active the end the cursor sits at
 * @returns {Selection} the selection
 */
export function selectionFrom(anchor: Position, active: Position): Selection {
	if (anchor.line < 0 || anchor.character < 0 || active.line < 0 || active.character < 0) {
		throw new RangeError('selection endpoints must be non-negative positions');
	}
	return {
		__range: true,
		start: anchor,
		end: active,
		anchor,
		active,
	};
}

/** lineStartsOf: records where every line of a text begins.
 * @param {string} text the whole document text
 * @returns {number[]} the offset of the first character of each line
 */
export function lineStartsOf(text: string): number[] {
	const starts: number[] = [0];
	for (let index = 0; index < text.length; index++) {
		if (text[index] === '\n') starts.push(index + 1);
	}

	return starts;
}

/** offsetOf: the flat offset of a document position, clamped to the text.
 * @param {TextDocument} document the document the position belongs to
 * @param {Position} position the point to turn into an offset
 * @returns {number} the offset of that point
 */
export function offsetOf(document: TextDocument, position: Position): number {
	const lastLine = document.lineCount - 1;
	const line = Math.min(Math.max(position.line, 0), Math.max(lastLine, 0));
	const lineStart = document.lineStarts[line];
	if (lineStart === undefined) return document.text.length;

	return Math.min(lineStart + Math.max(position.character, 0), document.text.length);
}

/** lineTextAt: the text of one line, without its line break.
 * @param {TextDocument} document the document the line belongs to
 * @param {number} line a zero-based line index
 * @returns {string} that line's text
 */
function lineTextAt(document: TextDocument, line: number): string {
	const start = document.lineStarts[line];
	if (start === undefined) return '';
	const nextStart = document.lineStarts[line + 1];
	const end = nextStart === undefined ? document.text.length : nextStart - 1;

	return document.text.slice(start, Math.max(start, end)).replace(/\r$/, '');
}

/** revealSpanFor: the span a reveal strategy points at — a whole line, the selection, or the cursor point.
 * @param {TextDocument} document the document the selection lives in
 * @param {Selection} selection the selection to reveal
 * @param {UglyRevelation} strategy which part of the selection the reveal covers
 * @returns {Range} the span the reveal covers
 */
function revealSpanFor(document: TextDocument, selection: Selection, strategy: UglyRevelation): Range {
	if (strategy === 'active-line') {
		const line = selection.active.line;

		return rangeFromPositions(positionFrom(line, 0), positionFrom(line, lineTextAt(document, line).length));
	}
	if (strategy === 'selection') return rangeFromPositions(selection.start, selection.end);

	return rangeFromPositions(selection.active, selection.active);
}

/** revealedSpansOf: the spans the selection reveals, minus the lines the user disabled.
 * @param {Map<string, { pretty: string; ranges: Set<Range> }>} prettySpans every rule's spans
 * @param {TextDocument} document the document the spans belong to
 * @param {Selection[]} selections the selections that reveal their neighbourhood
 * @param {UglyRevelation} strategy how far around the cursor the ugly text shows
 * @param {Set<number>} disabledLines the lines the user switched back to pretty
 * @returns {Range[]} the spans that must stay ugly
 */
export function revealedSpansOf(
	prettySpans: Map<string, { pretty: string; ranges: Set<Range> }>,
	document: TextDocument,
	selections: readonly Selection[],
	strategy: UglyRevelation,
	disabledLines: Set<number>,
): Range[] {
	const spans = [...prettySpans.values()].flatMap((entry) => [...entry.ranges]);
	const revealed: Range[] = [];
	for (const selection of selections) {
		const window = revealSpanFor(document, selection, strategy);
		for (const span of spans) {
			if (positionCompare(span.start, window.end) <= 0 && positionCompare(span.end, window.start) >= 0) revealed.push(span);
		}
	}

	return revealed.filter((span) => !disabledLines.has(span.start.line));
}
