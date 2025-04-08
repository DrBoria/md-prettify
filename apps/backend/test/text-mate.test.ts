import * as assert from "assert";
import { combineIdenticalTokenScopes, groupAndMergeTokensByScope, matchScope, groupSubstitutionsByScope } from '../grammar/text-mate';
import type { IToken } from "../host";

const tok = (startIndex: number, endIndex: number, ...scopes: string[]): IToken => ({ startIndex, endIndex, scopes });

suite("text-mate pure helpers", () => {
  test("combineIdenticalTokenScopes merges adjacent tokens with identical scopes", () => {
    const tokens = [tok(0, 3, "a"), tok(3, 6, "a"), tok(6, 9, "b")];
    assert.deepStrictEqual(combineIdenticalTokenScopes(tokens), [tok(0, 6, "a"), tok(6, 9, "b")]);
  });

  test("combineIdenticalTokenScopes keeps tokens with gaps or differing scopes", () => {
    const gap = [tok(0, 3, "a"), tok(5, 8, "a")];
    assert.deepStrictEqual(combineIdenticalTokenScopes(gap), gap);
    const diff = [tok(0, 3, "a"), tok(3, 6, "b")];
    assert.deepStrictEqual(combineIdenticalTokenScopes(diff), diff);
    assert.deepStrictEqual(combineIdenticalTokenScopes([]), []);
  });

  test("combineIdenticalTokenScopes does not mutate the source tokens", () => {
    const first = tok(0, 3, "a");
    const second = tok(3, 6, "a");
    const out = combineIdenticalTokenScopes([first, second]);
    assert.strictEqual(first.endIndex, 3, "source token unchanged");
    assert.strictEqual(out[0].endIndex, 6);
  });

  test("groupAndMergeTokensByScope merges touching ranges but keeps gapped ones separate", () => {
    const tokens = [
      tok(0, 4, "a", "x"),
      tok(4, 8, "a"),
      tok(10, 14, "a"),
    ];
    const grouped = groupAndMergeTokensByScope(tokens);
    // (0,4) and (4,8) touch and merge to (0,8); (10,14) has a gap (8..10) and stays separate
    assert.deepStrictEqual(grouped["a"], [{ startIndex: 0, endIndex: 8 }, { startIndex: 10, endIndex: 14 }]);
    assert.deepStrictEqual(grouped["x"], [{ startIndex: 0, endIndex: 4 }]);
    assert.deepStrictEqual(groupAndMergeTokensByScope([]), {});
  });

  test("matchScope matches when any token scope contains the scope", () => {
    const scopes = ["source.ts", "meta.function.ts"];
    assert.strictEqual(matchScope("meta.function.ts", scopes), true);
    assert.strictEqual(matchScope(["meta.function.ts", "other"], scopes), true);
    assert.strictEqual(matchScope("meta.arrow.ts", scopes), false);
    assert.strictEqual(matchScope("", scopes), true, "empty scope matches everything");
  });

  test("matchScope falls back to per-part matching for multi-part scopes", () => {
    const scopes = ["source.ts", "meta.paragraph.ts"];
    assert.strictEqual(matchScope("meta.paragraph.ts", scopes), true);
    assert.strictEqual(matchScope("meta.paragraph.foobar", scopes), false, "one missing part fails");
  });

  test("groupSubstitutionsByScope buckets substitutions by scope, defaulting to defaultScope", () => {
    const withScope = { ugly: /a/g, pretty: "A", scope: "s1" };
    const multi = { ugly: /b/g, pretty: "B", scope: ["s1", "s2"] };
    const bare = { ugly: /c/g, pretty: "C" };
    const grouped = groupSubstitutionsByScope([withScope, multi, bare], "default");
    assert.deepStrictEqual(grouped["s1"], [withScope, multi]);
    assert.deepStrictEqual(grouped["s2"], [multi]);
    assert.deepStrictEqual(grouped["default"], [bare]);
  });
});
