import * as assert from "assert";
import { positionFrom, rangeFrom } from "../host";
import { offsetAt, relativeOffsetAtAbsolutePosition, positionAt } from "../utils/text-offsets";
import { toRangeDelta, rangeTranslate, rangeContains, maxPosition } from "../utils/text-deltas";

suite("text", () => {
  test("offsetAt maps a position to a character offset", () => {
    const text = "abc\ndef";
    assert.strictEqual(offsetAt(text, positionFrom(0, 1)), 1);
    assert.strictEqual(offsetAt(text, positionFrom(1, 2)), 6);
    assert.strictEqual(offsetAt(text, positionFrom(5, 0)), -1, "beyond end of text");
  });

  test("positionAt maps a character offset to a position", () => {
    const text = "abc\ndef";
    assert.deepStrictEqual([positionAt(text, 0).line, positionAt(text, 0).character], [0, 0]);
    assert.deepStrictEqual([positionAt(text, 4).line, positionAt(text, 4).character], [1, 0]);
    assert.deepStrictEqual([positionAt(text, 99).line, positionAt(text, 99).character], [1, 3], "clamped to text end");
  });

  test("relativeOffsetAtAbsolutePosition computes the offset within a text slice", () => {
    const text = "hello world";
    const start = positionFrom(0, 0);
    assert.strictEqual(relativeOffsetAtAbsolutePosition(text, start, positionFrom(0, 6)), 6);
    assert.strictEqual(relativeOffsetAtAbsolutePosition(text, positionFrom(0, 6), positionFrom(0, 9)), 3);
    assert.strictEqual(relativeOffsetAtAbsolutePosition(text, positionFrom(0, 6), positionFrom(0, 3)), -1, "before text start");
  });

  test("toRangeDelta reports line and character deltas for an insertion", () => {
    const delta = toRangeDelta(rangeFrom(0, 3, 0, 3), "x\ny");
    // The empty range end lands at (1,1): one line down, one character on the new line
    assert.strictEqual(delta.linesDelta, 1);
    assert.strictEqual(delta.endCharactersDelta, 1);
  });

  test("toRangeDelta reports deltas for a multi-line deletion", () => {
    const delta = toRangeDelta(rangeFrom(0, 0, 2, 4), "");
    assert.strictEqual(delta.linesDelta, -2);
    assert.strictEqual(delta.endCharactersDelta, -4);
  });

  test("rangeTranslate shifts ranges after and inside the changed line", () => {
    // Insert "ab" at (0, 5): characters on line 0 after col 5 shift right by 2,
    // later lines shift down by 0 lines but the end-column delta applies.
    const delta = toRangeDelta(rangeFrom(0, 5, 0, 5), "ab");
    const before = rangeTranslate(rangeFrom(0, 0, 0, 3), delta);
    assert.deepStrictEqual([before.start.line, before.start.character, before.end.line, before.end.character], [0, 0, 0, 3]);
    const after = rangeTranslate(rangeFrom(0, 8, 0, 11), delta);
    assert.deepStrictEqual([after.start.line, after.start.character, after.end.line, after.end.character], [0, 10, 0, 13]);
  });

  test("rangeTranslate shifts ranges on later lines down by the line delta", () => {
    const delta = toRangeDelta(rangeFrom(0, 0, 0, 0), "x\ny\n");
    const shifted = rangeTranslate(rangeFrom(2, 1, 2, 4), delta);
    assert.deepStrictEqual([shifted.start.line, shifted.start.character, shifted.end.line, shifted.end.character], [4, 1, 4, 4]);
  });

  test("rangeContains honors the start/end inclusivity flags", () => {
    const r = rangeFrom(0, 2, 0, 8);
    const mid = positionFrom(0, 5);
    assert.strictEqual(rangeContains(r, mid), true);
    assert.strictEqual(rangeContains(r, positionFrom(0, 2)), true, "start inclusive by default");
    assert.strictEqual(rangeContains(r, positionFrom(0, 2), true), false, "excludeStart");
    assert.strictEqual(rangeContains(r, positionFrom(0, 8)), false, "end exclusive by default");
    assert.strictEqual(rangeContains(r, positionFrom(0, 8), false, true), true, "includeEnd");
  });

  test("maxPosition returns the later line regardless of character", () => {
    // Regression: the old code compared x to itself, so a later line with a
    // smaller character was discarded (returned the earlier line instead).
    const a = positionFrom(5, 9);
    const b = positionFrom(2, 1);
    assert.deepStrictEqual(maxPosition(a, b), a, "later line wins");
    assert.deepStrictEqual(maxPosition(b, a), a, "argument order does not matter");
    assert.deepStrictEqual(maxPosition(positionFrom(5, 1), positionFrom(2, 9)), positionFrom(5, 1), "later line with smaller character still wins");
  });

  test("maxPosition compares characters on the same line", () => {
    assert.deepStrictEqual(maxPosition(positionFrom(3, 2), positionFrom(3, 7)), positionFrom(3, 7));
    assert.deepStrictEqual(maxPosition(positionFrom(3, 7), positionFrom(3, 2)), positionFrom(3, 7));
  });

  test("maxPosition returns either argument for equal positions", () => {
    const p = positionFrom(4, 4);
    assert.deepStrictEqual(maxPosition(p, p), p);
  });
});
