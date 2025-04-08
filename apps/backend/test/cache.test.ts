import * as assert from "assert";
import { rangeFrom } from "../host";
import type { Host, TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from "../host";
import { getDecorationCacheKey, hasPriorityScopes, getCacheKeyPriority, addOrUpdatePrettyRange } from '../resolve/cache';
import { DocumentStoreModel } from '../document/store';
import type { DocumentView, PrettySubstitution } from '../document/type';
import type { DocumentStore } from '../document/type';
import type { DebounceFunction } from '../document/debounce';

class FakeHost implements Host {
  textDocuments: never[] = [];
  visibleTextEditors: never[] = [];
  activeTextEditor = null;
  registerCommand(): Disposable { return { dispose: () => {} }; }
  getConfiguration(): unknown { return {}; }
  matchLanguage(): number { return 1; }
  getGrammarFilePath(): string | null { return null; }
  getGrammarInjections(): { scopeName: string; path: string }[] { return []; }
  getLanguageScopeName(): string | null { return "source.ts"; }
  copyToClipboard(): Promise<void> { return Promise.resolve(); }
  createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
    return { key: "deco", options, dispose: () => {} };
  }
  createOutputChannel(): OutputChannel { return { appendLine: () => {}, dispose: () => {} }; }
  onDidOpenTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidCloseTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidChangeTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidChangeConfiguration(): Disposable { return { dispose: () => {} }; }
  onDidChangeActiveTextEditor(): Disposable { return { dispose: () => {} }; }
  onDidChangeTextEditorSelection(): Disposable { return { dispose: () => {} }; }
}

const rule = (ugly: RegExp, pretty: string, scope?: string | string[]): PrettySubstitution => ({ ugly, pretty, scope });

const keyOf = (r: PrettySubstitution) => getDecorationCacheKey(r);

const noopDebounce: DebounceFunction = { call: () => {}, dispose: () => {} };

/** An empty document view: the cache tests only exercise the engine's
 *  range/cache bookkeeping, never the text. */
const emptyDocument: DocumentView = {
  uri: "",
  getText: () => "",
  getLine: () => "",
  getLineRange: (line: number) => rangeFrom(line, 0, line, 0),
  getLineCount: () => 0,
  validateRange: (r) => r,
};

const makeState = (rules: PrettySubstitution[]): DocumentStore =>
  DocumentStoreModel.create({
    document: emptyDocument,
    host: new FakeHost(),
    prettySubstitutions: new Set(rules),
    decorationCache: new Map(),
    hiddeDecorationsRanges: new Set(),
    lineIndex: new Map(),
    rangeKeyToCacheKey: new Map(),
    changedUglies: false,
    hiddenDecoration: null,
    revealedUglyDecoration: null,
    boxedSymbolDecoration: null,
    debug: false,
    outputChannel: { appendLine: () => {}, dispose: () => {} },
    defaultScope: '',
    excludedScopes: new Set(),
    hideTextMethod: 'none',
    revealStrategy: 'none',
    prettyCursor: 'none',
    disabledLines: new Set(),
    subscriptions: [],
    currentDecorations: [],
    updateActiveEditor: noopDebounce,
    updateSelection: noopDebounce,
    adjustCursorMovement: false,
    lastSelections: new Map(),
    revealedRanges: [],
    cursorRanges: [],
  });

suite("cache", () => {
  test("getDecorationCacheKey formats regex ugly, sorted scopes, and sorted style entries", () => {
    // key = `${ugly}|${flags}:::${pretty}:::${scopeStr}:::${styleStr}` (empty scope/style still keep their separators)
    assert.strictEqual(getDecorationCacheKey(rule(/a/g, "A")), "a|g:::A::::::");
    assert.strictEqual(getDecorationCacheKey(rule(/a/g, "A", ["s2", "s1"])), "a|g:::A:::s1,s2:::");
    assert.strictEqual(getDecorationCacheKey({ ugly: /a/g, pretty: "A", style: { color: "red" } }), "a|g:::A::::::[[\"color\",\"red\"]]");
  });

  test("hasPriorityScopes and getCacheKeyPriority recognize the trailing ! suffix", () => {
    assert.strictEqual(hasPriorityScopes(["s1"]), false);
    assert.strictEqual(hasPriorityScopes(["s1", "s2!"]), true);
    const low = rule(/a/g, "A", "s1");
    const high = rule(/b/g, "B", "s1!");
    const state = makeState([low, high]);
    assert.strictEqual(getCacheKeyPriority(state, keyOf(low)), 1);
    assert.strictEqual(getCacheKeyPriority(state, keyOf(high)), 2);
    assert.strictEqual(getCacheKeyPriority(state, "unknown:::key::::::"), 1, "no matching rule defaults to 1");
  });

  test("addOrUpdatePrettyRange adds a range and creates a cache entry from the rule", () => {
    const r = rule(/ab/g, "AB", "s1");
    const state = makeState([r]);
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 2), keyOf(r));
    assert.strictEqual(state.hiddeDecorationsRanges.size, 1);
    const entry = state.decorationCache.get(keyOf(r));
    assert.ok(entry, "cache entry created");
    assert.strictEqual(entry.ranges.size, 1);
    assert.strictEqual(entry.pretty, "AB");
    assert.strictEqual(state.rangeKeyToCacheKey.size, 1);
  });

  test("a lower-priority range contained in a higher-priority range is rejected", () => {
    const high = rule(/abcd/g, "ABCD", "!s1");
    const low = rule(/bc/g, "BC", "s1");
    const state = makeState([high, low]);
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 4), keyOf(high));
    addOrUpdatePrettyRange(state, rangeFrom(0, 1, 0, 3), keyOf(low));
    assert.strictEqual(state.hiddeDecorationsRanges.size, 1, "new range not added");
  });

  test("a higher-priority range replaces the lower-priority range that contains it", () => {
    const high = rule(/bc/g, "BC", "s1!");
    const low = rule(/abcd/g, "ABCD", "s1");
    const state = makeState([high, low]);
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 4), keyOf(low));
    addOrUpdatePrettyRange(state, rangeFrom(0, 1, 0, 3), keyOf(high));
    assert.strictEqual(state.hiddeDecorationsRanges.size, 1);
    const [only] = [...state.hiddeDecorationsRanges];
    assert.deepStrictEqual([only.start.character, only.end.character], [1, 3]);
  });

  test("a new range containing an existing one at equal priority replaces the existing one", () => {
    const wide = rule(/abcd/g, "ABCD", "s1");
    const narrow = rule(/ab/g, "AB", "s1");
    const state = makeState([wide, narrow]);
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 2), keyOf(narrow));
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 4), keyOf(wide));
    assert.strictEqual(state.hiddeDecorationsRanges.size, 1);
    const [only] = [...state.hiddeDecorationsRanges];
    assert.strictEqual(only.end.character, 4);
  });

  test("partial overlaps are won by the higher-priority range regardless of order", () => {
    const high = rule(/cdef/g, "CDEF", "s1!");
    const low = rule(/abc/g, "ABC", "s1");
    const first = makeState([high, low]);
    addOrUpdatePrettyRange(first, rangeFrom(0, 0, 0, 3), keyOf(low));
    addOrUpdatePrettyRange(first, rangeFrom(0, 2, 0, 6), keyOf(high));
    assert.strictEqual(first.hiddeDecorationsRanges.size, 1);
    const [winner] = [...first.hiddeDecorationsRanges];
    assert.strictEqual(winner.start.character, 2, "high-priority range wins");

    const second = makeState([high, low]);
    addOrUpdatePrettyRange(second, rangeFrom(0, 2, 0, 6), keyOf(high));
    addOrUpdatePrettyRange(second, rangeFrom(0, 0, 0, 3), keyOf(low));
    assert.strictEqual(second.hiddeDecorationsRanges.size, 1, "lower-priority partial overlap rejected");
  });

  test("re-adding an equal range under another key replaces the previous owner", () => {
    const a = rule(/ab/g, "AB", "s1");
    const b = rule(/ab/g, "CD", "s1");
    const state = makeState([a, b]);
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 2), keyOf(a));
    addOrUpdatePrettyRange(state, rangeFrom(0, 0, 0, 2), keyOf(b));
    assert.strictEqual(state.hiddeDecorationsRanges.size, 1);
    assert.strictEqual(state.rangeKeyToCacheKey.get("0:0-0:2"), keyOf(b), "index points at the newest key");
    assert.strictEqual(state.decorationCache.get(keyOf(a))?.ranges.size, 0, "old entry emptied");
    assert.strictEqual(state.decorationCache.get(keyOf(b))?.ranges.size, 1);
  });
});
