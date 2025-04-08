import * as assert from "assert";
import type { Range } from "../host";
import { rangeFrom, rangeTranslate } from "../host";
import {
  rangeKey,
  buildLineIndex,
  indexInsert,
  indexRemove,
  overlapCandidates,
  rebuildRangeKeyMap,
  shiftKeyMapForSet,
  keyMapRemove,
} from '../resolve/range-index';

suite("range-index", () => {
  test("rangeKey encodes start and end positions", () => {
    assert.strictEqual(rangeKey(rangeFrom(1, 2, 3, 4)), "1:2-3:4");
    assert.strictEqual(rangeKey(rangeFrom(0, 0, 0, 5)), "0:0-0:5");
  });

  test("buildLineIndex buckets ranges by start line", () => {
    const a = rangeFrom(0, 1, 0, 4);
    const b = rangeFrom(2, 0, 2, 3);
    const c = rangeFrom(0, 9, 0, 12);
    const index = buildLineIndex(new Set([a, b, c]));
    assert.deepStrictEqual([...index.keys()].sort(), [0, 2]);
    assert.deepStrictEqual(index.get(0), [a, c]);
    assert.deepStrictEqual(index.get(2), [b]);
  });

  test("indexInsert and indexRemove maintain the index incrementally", () => {
    const index = new Map<number, Range[]>();
    const a = rangeFrom(1, 0, 1, 3);
    const b = rangeFrom(1, 5, 1, 8);
    indexInsert(index, a);
    indexInsert(index, b);
    assert.deepStrictEqual(index.get(1), [a, b]);
    indexRemove(index, a);
    assert.deepStrictEqual(index.get(1), [b]);
    indexRemove(index, b);
    assert.strictEqual(index.has(1), false, "empty bucket is deleted");
  });

  test("overlapCandidates returns ranges on overlapping lines only", () => {
    const l0 = rangeFrom(0, 0, 0, 3);
    const l1 = rangeFrom(1, 0, 1, 3);
    const l5 = rangeFrom(5, 0, 5, 3);
    const set = new Set([l0, l1, l5]);
    const index = buildLineIndex(set);
    assert.deepStrictEqual(overlapCandidates(index, set, rangeFrom(0, 0, 1, 9)), [l0, l1]);
    assert.deepStrictEqual(overlapCandidates(index, set, rangeFrom(5, 0, 5, 1)), [l5]);
    assert.deepStrictEqual(overlapCandidates(index, set, rangeFrom(2, 0, 2, 1)), []);
  });

  test("overlapCandidates falls back to the full set for wide spans", () => {
    const a = rangeFrom(0, 0, 0, 3);
    const b = rangeFrom(100, 0, 100, 3);
    const set = new Set([a, b]);
    const index = buildLineIndex(set);
    const wide = rangeFrom(0, 0, 70, 0);
    assert.deepStrictEqual(overlapCandidates(index, set, wide).sort(), [a, b].sort());
  });

  test("rebuildRangeKeyMap maps only active ranges to their cache key", () => {
    const active = rangeFrom(0, 1, 0, 3);
    const stale = rangeFrom(1, 1, 1, 3);
    const entry = (ranges: Range[]) => ({ decorationType: null, ranges: new Set(ranges), pretty: "" });
    const state = {
      decorationCache: new Map([
        ["keyA", entry([active, stale])],
        ["keyB", entry([stale])],
      ]),
      hiddeDecorationsRanges: new Set([active]),
    };
    const map = rebuildRangeKeyMap(state);
    assert.deepStrictEqual(map, new Map([[rangeKey(active), "keyA"]]));
  });

  test("shiftKeyMapForSet remaps keys of shifted ranges", () => {
    const r = rangeFrom(0, 2, 0, 5);
    const map = new Map([[rangeKey(r), "k"]]);
    shiftKeyMapForSet(map, new Set([r]), (x) => rangeTranslate(x, 0, 1));
    assert.deepStrictEqual(map, new Map([[rangeKey(rangeFrom(0, 3, 0, 6)), "k"]]));
  });

  test("keyMapRemove deletes the given ranges' keys", () => {
    const a = rangeFrom(0, 0, 0, 1);
    const b = rangeFrom(1, 0, 1, 1);
    const map = new Map([[rangeKey(a), "a"], [rangeKey(b), "b"]]);
    keyMapRemove(map, [a]);
    assert.deepStrictEqual(map, new Map([[rangeKey(b), "b"]]));
  });
});
