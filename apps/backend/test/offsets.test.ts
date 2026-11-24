import * as assert from 'assert';
import { positionFrom } from '@md-prettify/utils';
import type { Position } from '@md-prettify/types';

function nextLineEnd(text: string, from: number): number {
	let index = 0;
	for (index = from; index < text.length; index++) {
		if (text[index] === '\n' || text[index] === '\r') break;
	}
	if (index >= text.length) return text.length;
	if (text[index] === '\r' && text[index + 1] === '\n') return index + 2;
	return index + 1;
}

/** offsetAt: converts a point to a character offset, so a caller can slice raw text.
 * @param {string} text the text the point belongs to
 * @param {Position} pos the point whose offset is wanted
 * @returns {number} the offset, or -1 when the point is past the end of the text
 */
function offsetAt(text: string, pos: Position): number {
	let line = pos.line;
	let lastIndex = 0;
	while (line > 0) {
		let i = lastIndex;
		let found = false;
		while (i < text.length) {
			const ch = text[i];
			if (ch === '\n') {
				i++;
				found = true;
				break;
			}
			if (ch === '\r') {
				i++;
				if (text[i] === '\n') i++;
				found = true;
				break;
			}
			i++;
		}
		if (!found) return -1;
		lastIndex = i;
		line--;
	}
	return lastIndex + pos.character;
}

function skipLines(text: string, offset: number, count: number): number {
	for (let n = 0; n < count; n++) {
		offset = nextLineEnd(text, offset);
		if (offset >= text.length) return -1;
	}
	return offset;
}

/** relativeOffsetAtAbsolutePosition: measures a point from the start of a text, ignoring the text's own line origin.
 * @param {string} text the caller's text, already starting at `textStart`
 * @param {Position} textStart the document point the text starts at
 * @param {Position} pos the document point whose relative offset is wanted
 * @returns {number} the relative offset, or -1 when `pos` lies before the text
 */
function relativeOffsetAtAbsolutePosition(text: string, textStart: Position, pos: Position): number {
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

function positionFromLineStart(text: string, offset: number, startLine: number, startCharacter: number): Position {
	let lastIndex = 0;
	let lineEnd = nextLineEnd(text, lastIndex);
	let crossed = 0;
	while (lineEnd <= offset && lineEnd < text.length) {
		lastIndex = lineEnd;
		crossed += 1;
		lineEnd = nextLineEnd(text, lastIndex);
	}

	const line = startLine + crossed;
	const character = crossed === 0 ? startCharacter + (offset - lastIndex) : offset - lastIndex;

	return { line, character };
}

/** positionAt: converts a character offset back to a point, so callers can report where a match sits.
 * @param {string} text the text the offset indexes into
 * @param {number} offset the character offset to convert
 * @returns {Position} the point at that offset, clamped to the end of the text
 */
function positionAt(text: string, offset: number): Position {
	if (offset > text.length) offset = text.length;
	return positionFromLineStart(text, offset, 0, 0);
}

suite('text offsets', () => {
	test('offsetAt maps a position to a character offset', () => {
		const text = 'abc\ndef';
		assert.strictEqual(offsetAt(text, positionFrom(0, 1)), 1);
		assert.strictEqual(offsetAt(text, positionFrom(1, 2)), 6);
		assert.strictEqual(offsetAt(text, positionFrom(5, 0)), -1, 'beyond end of text');
	});

	test('positionAt maps a character offset to a position', () => {
		const text = 'abc\ndef';
		const p0 = positionAt(text, 0);
		const p4 = positionAt(text, 4);
		const p99 = positionAt(text, 99);
		assert.deepStrictEqual([p0.line, p0.character], [0, 0]);
		assert.deepStrictEqual([p4.line, p4.character], [1, 0]);
		assert.deepStrictEqual([p99.line, p99.character], [1, 3], 'clamped to text end');
	});

	test('relativeOffsetAtAbsolutePosition computes the offset within a text slice', () => {
		const text = 'hello world';
		const start = positionFrom(0, 0);
		assert.strictEqual(relativeOffsetAtAbsolutePosition(text, start, positionFrom(0, 6)), 6);
		assert.strictEqual(relativeOffsetAtAbsolutePosition(text, positionFrom(0, 6), positionFrom(0, 9)), 3);
		assert.strictEqual(relativeOffsetAtAbsolutePosition(text, positionFrom(0, 6), positionFrom(0, 3)), -1, 'before text start');
	});
});
