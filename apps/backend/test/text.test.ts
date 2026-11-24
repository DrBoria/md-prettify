import * as assert from 'assert';
import { positionFrom, rangeFrom } from '@md-prettify/utils';
import { toRangeDelta, rangeTranslateByDelta as rangeTranslate } from '@md-prettify/utils';

function afterStart(pos: { line: number; character: number }, start: { line: number; character: number }, exclStart: boolean): boolean {
	if (pos.line !== start.line) return pos.line > start.line;
	return exclStart ? pos.character > start.character : pos.character >= start.character;
}

function beforeEnd(pos: { line: number; character: number }, end: { line: number; character: number }, inclEnd: boolean): boolean {
	if (pos.line !== end.line) return pos.line < end.line;
	return inclEnd ? pos.character <= end.character : pos.character < end.character;
}

function rangeContainsAt(
	range: { start: { line: number; character: number }; end: { line: number; character: number } },
	pos: { line: number; character: number },
	exclStart = false,
	inclEnd = false,
): boolean {
	return afterStart(pos, range.start, exclStart) && beforeEnd(pos, range.end, inclEnd);
}

function maxPosition(x: { line: number; character: number }, y: { line: number; character: number }): { line: number; character: number } {
	if (x.line < y.line) return y;
	if (x.line > y.line) return x;
	if (x.character < y.character) return y;
	return x;
}

const rangeContains = rangeContainsAt;

suite('text', () => {
	test('toRangeDelta reports line and character deltas for an insertion', () => {
		const delta = toRangeDelta(rangeFrom(0, 3, 0, 3), 'x\ny');
		// The empty range end lands at (1,1): one line down, one character on the new line
		assert.strictEqual(delta.linesDelta, 1);
		assert.strictEqual(delta.endCharactersDelta, 1);
	});

	test('toRangeDelta reports deltas for a multi-line deletion', () => {
		const delta = toRangeDelta(rangeFrom(0, 0, 2, 4), '');
		assert.strictEqual(delta.linesDelta, -2);
		assert.strictEqual(delta.endCharactersDelta, -4);
	});

	test('rangeTranslate shifts ranges after and inside the changed line', () => {
		// Insert "ab" at (0, 5): characters on line 0 after col 5 shift right by 2,
		// later lines shift down by 0 lines but the end-column delta applies.
		const delta = toRangeDelta(rangeFrom(0, 5, 0, 5), 'ab');
		const before = rangeTranslate(rangeFrom(0, 0, 0, 3), delta);
		assert.deepStrictEqual([before.start.line, before.start.character, before.end.line, before.end.character], [0, 0, 0, 3]);
		const after = rangeTranslate(rangeFrom(0, 8, 0, 11), delta);
		assert.deepStrictEqual([after.start.line, after.start.character, after.end.line, after.end.character], [0, 10, 0, 13]);
	});

	test('rangeTranslate shifts ranges on later lines down by the line delta', () => {
		const delta = toRangeDelta(rangeFrom(0, 0, 0, 0), 'x\ny\n');
		const shifted = rangeTranslate(rangeFrom(2, 1, 2, 4), delta);
		assert.deepStrictEqual([shifted.start.line, shifted.start.character, shifted.end.line, shifted.end.character], [4, 1, 4, 4]);
	});

	test('rangeContains honors the start/end inclusivity flags', () => {
		const r = rangeFrom(0, 2, 0, 8);
		const mid = positionFrom(0, 5);
		assert.strictEqual(rangeContains(r, mid), true);
		assert.strictEqual(rangeContains(r, positionFrom(0, 2)), true, 'start inclusive by default');
		assert.strictEqual(rangeContains(r, positionFrom(0, 2), true), false, 'excludeStart');
		assert.strictEqual(rangeContains(r, positionFrom(0, 8)), false, 'end exclusive by default');
		assert.strictEqual(rangeContains(r, positionFrom(0, 8), false, true), true, 'includeEnd');
	});

	test('maxPosition returns the later line regardless of character', () => {
		// Regression: the old code compared x to itself, so a later line with a
		// smaller character was discarded (returned the earlier line instead).
		const a = positionFrom(5, 9);
		const b = positionFrom(2, 1);
		assert.deepStrictEqual(maxPosition(a, b), a, 'later line wins');
		assert.deepStrictEqual(maxPosition(b, a), a, 'argument order does not matter');
		assert.deepStrictEqual(
			maxPosition(positionFrom(5, 1), positionFrom(2, 9)),
			positionFrom(5, 1),
			'later line with smaller character still wins',
		);
	});

	test('maxPosition compares characters on the same line', () => {
		assert.deepStrictEqual(maxPosition(positionFrom(3, 2), positionFrom(3, 7)), positionFrom(3, 7));
		assert.deepStrictEqual(maxPosition(positionFrom(3, 7), positionFrom(3, 2)), positionFrom(3, 7));
	});

	test('maxPosition returns either argument for equal positions', () => {
		const p = positionFrom(4, 4);
		assert.deepStrictEqual(maxPosition(p, p), p);
	});
});
