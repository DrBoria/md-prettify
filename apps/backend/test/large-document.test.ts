import * as assert from "assert";
import { rangeFrom } from "../host";
import type { Host, TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from "../host";
import { createPrettyModel } from '../document/pretty-model';
import type { DocumentView } from '../document/type';
import type { LanguageEntry } from '../config/configuration';
import { parseRawGrammar, Registry } from '../grammar/text-mate';
import type { IGrammar } from '../grammar/text-mate';
import { loadOnigLib } from '../grammar/onig-wasm';
import { grammarJson } from "./synthetic-ts-grammar";

const onigLibPromise = loadOnigLib();

// C3 regression test: the O(M^2) decoration-cache scan (pre-fix: ~15.6 s for
// 5k lines, ~73 s for 10k) must stay bounded. The document is a synthetic
// TypeScript file (functions, arrows, &&/||, try/catch) tokenized by the
// shared synthetic TS grammar (source.ts) — the same scopes the
// typescript-to-python predefined config targets.
//
// 10k lines: at 5k the regressed full-set scan (~2.7 s on a fast machine) can
// slip under the budget; at 10k it is unambiguously over it (~15 s) while the
// fixed path stays ~10x under budget. The budget covers the FIRST (cold) model
// construction — the user-visible "open file" path. No warmup run: a prior
// construction would JIT-warm the hot loop and let a regressed run slip under.

const LINE_COUNT = 10000;
const BUDGET_MS = 5000; // ~12x the fixed path; only fails if the O(M^2) regression returns.

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
    return { key: `deco-${Math.random()}`, options, dispose: () => {} };
  }
  createOutputChannel(): OutputChannel { return { appendLine: () => {}, dispose: () => {} }; }
  onDidOpenTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidCloseTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidChangeTextDocument(): Disposable { return { dispose: () => {} }; }
  onDidChangeConfiguration(): Disposable { return { dispose: () => {} }; }
  onDidChangeActiveTextEditor(): Disposable { return { dispose: () => {} }; }
  onDidChangeTextEditorSelection(): Disposable { return { dispose: () => {} }; }
}

// The dynamic rule ($1$2 substitution) is what drives the O(M^2) cache path.
const RULES = [
  { ugly: "([a-z]{4,})([a-z]{4,})([a-z]{4,})", pretty: "$1$2$1$2$1$2$1$2$1$2" },
  { ugly: "(&&)", pretty: "AND", scope: "source.ts" },
  { ugly: "(\\|\\|)", pretty: "OR", scope: "source.ts" },
  { ugly: "function\\s+([A-Za-z_]\\w*)", pretty: "fun $1", scope: "meta.function.ts" },
];
const SETTINGS: LanguageEntry = { language: "typescript", substitutions: RULES, combineIdenticalScopes: false };
const OPTIONS = {
  hideTextMethod: "hack-letterSpacing" as const,
  debug: false,
  outputChannel: { appendLine: () => {}, dispose: () => {} },
  languageId: "typescript",
};

const HOT_LINE_IDX = 500;
const HOT_WORD = "abc".repeat(667); // ~2000-char match -> worst-case part-by-part

const buildDocument = (n: number): string[] => {
  const lines = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    if (i === HOT_LINE_IDX) {
      lines[i] = `const hot = ${HOT_WORD};`;
    } else if (i % 25 === 0) {
      lines[i] = `function sectionHeading${i}(a: number): number {`;
    } else if (i % 3 === 0) {
      lines[i] = `const arrow${i} = (x: number): boolean => x > 0 || x < 0;`;
    } else if (i % 7 === 0) {
      lines[i] = `const flag${i} = a && b;`;
    } else {
      lines[i] = i % 10 === 4
        ? `try { const v${i} = 1; } catch (e) { throw e; }`
        : `const plain${i} = i;`;
    }
  }
  return lines;
};

const makeDocModel = (lines: string[]): DocumentView => {
  const text = lines.join("\n");
  const offsets = new Array<number>(lines.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < lines.length; i++) offsets[i + 1] = offsets[i] + lines[i].length + 1;
  return {
    uri: "test",
    getText: (r) => text.slice(offsets[r.start.line] + r.start.character, offsets[r.end.line] + r.end.character),
    getLine: (line) => lines[line] ?? "",
    getLineRange: (line) => rangeFrom(line, 0, line, (lines[line] ?? "").length),
    getLineCount: () => lines.length,
    validateRange: (r) => r,
  };
};

const loadGrammar = async (): Promise<IGrammar> => {
  assert.ok(Registry && parseRawGrammar, "vscode-textmate available");
  const registry = new Registry({
    onigLib: onigLibPromise,
    loadGrammar: () => Promise.resolve(parseRawGrammar(grammarJson, "synthetic-ts.json")),
  });
  const grammar = await registry.loadGrammar("source.ts");
  assert.ok(grammar, "synthetic typescript grammar loaded");
  return grammar;
};

suite("large document", () => {
  test("computes all decorations on a 10k-line typescript document within budget", async () => {
    const grammar = await loadGrammar();
    const lines = buildDocument(LINE_COUNT);
    const doc = makeDocModel(lines);
    const makeModel = () => createPrettyModel(new FakeHost(), doc, SETTINGS, { ...OPTIONS, textMateGrammar: grammar });

    const t0 = process.hrtime.bigint();
    const model = makeModel();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;

    assert.ok(
      ms < BUDGET_MS,
      `decoration computation for ${LINE_COUNT} lines took ${ms.toFixed(0)}ms (budget ${BUDGET_MS}ms; ` +
        `the pre-fix O(M^2) cache scan took ~15600ms)`
    );

    // Correctness invariant: ranges were actually produced, and a second
    // recompute from scratch yields the identical count (idempotency).
    const firstCount = model.getPrettySubstitutionsRanges().length;
    assert.ok(firstCount > 0, `expected decoration ranges, got ${firstCount}`);

    const second = makeModel();
    const secondCount = second.getPrettySubstitutionsRanges().length;
    assert.strictEqual(secondCount, firstCount, `recompute produced ${secondCount} ranges, expected ${firstCount}`);
  });
});
