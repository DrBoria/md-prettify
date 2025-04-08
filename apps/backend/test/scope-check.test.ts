import * as assert from "assert";
import { classifyRuleScopes, isScopeApplicable } from '../reparse/tokenize';

suite("scope-check", () => {
  test("classifyRuleScopes sorts scopes into positive, negative and high-priority", () => {
    const { positiveScopes, negativeScopesByPrefix, highPriorityScopes } = classifyRuleScopes({
      ugly: /x/g,
      pretty: "y",
      scope: ["meta.function.ts", "!meta.block.ts", "meta.important!"],
    });
    assert.deepStrictEqual(positiveScopes, new Set(["meta.function.ts"]));
    assert.deepStrictEqual(negativeScopesByPrefix, new Set(["meta.block.ts"]));
    assert.deepStrictEqual(highPriorityScopes, new Set(["meta.important"]));
  });

  test("classifyRuleScopes handles a single string scope and no scope", () => {
    const single = classifyRuleScopes({ ugly: /x/g, pretty: "y", scope: "a.b" });
    assert.deepStrictEqual(single.positiveScopes, new Set(["a.b"]));
    const none = classifyRuleScopes({ ugly: /x/g, pretty: "y" });
    assert.strictEqual(none.positiveScopes.size, 0);
    assert.strictEqual(none.negativeScopesByPrefix.size, 0);
    assert.strictEqual(none.highPriorityScopes.size, 0);
  });

  test("a rule with no scopes never applies (no positive match possible)", () => {
    const c = classifyRuleScopes({ ugly: /x/g, pretty: "y" });
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["source.ts"])), false);
  });

  test("a positive scope applies when the token scope starts with it", () => {
    const c = classifyRuleScopes({ ugly: /x/g, pretty: "y", scope: "meta.function" });
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.function.ts"])), true);
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.arrow.ts"])), false);
  });

  test("a high-priority scope (trailing !) applies without a positive scope", () => {
    const c = classifyRuleScopes({ ugly: /x/g, pretty: "y", scope: "meta.important!" });
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.important.ts"])), true);
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["other.scope"])), false);
  });

  test("a negative scope (leading !) vetoes the rule even when a positive scope matches", () => {
    const c = classifyRuleScopes({ ugly: /x/g, pretty: "y", scope: ["meta.function", "!meta.block"] });
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.function.ts", "meta.block.ts"])), false);
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.function.ts"])), true);
  });

  test("high-priority match still respects negative scopes", () => {
    const c = classifyRuleScopes({ ugly: /x/g, pretty: "y", scope: ["meta.important!", "!meta.block"] });
    assert.strictEqual(isScopeApplicable(c.positiveScopes, c.negativeScopesByPrefix, c.highPriorityScopes, new Set(["meta.important.ts", "meta.block.ts"])), false);
  });
});
