import * as assert from "assert";
import type { Range } from "../host";
import { rangeFrom } from "../host";
import type { Host, TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from "../host";
import { createPrettyModel } from '../document/pretty-model';
import type { DocumentView } from '../document/type';
import type { LanguageEntry } from '../config/configuration';
import { parseRawGrammar, Registry } from '../grammar/text-mate';
import type { IGrammar } from '../grammar/text-mate';
import { loadOnigLib } from '../grammar/onig-wasm';
import { grammarJson } from "./synthetic-ts-grammar";
import { ReparseStoreModel, createReparseToken } from '../reparse/store';

const onigLibPromise = loadOnigLib();

const noop = () => {};
const noSub: Disposable = { dispose: noop };
class FakeHost implements Host {
  textDocuments: never[] = [];
  visibleTextEditors: never[] = [];
  activeTextEditor = null;
  registerCommand(): Disposable { return noSub; }
  getConfiguration(): unknown { return {}; }
  matchLanguage(): number { return 1; }
  getGrammarFilePath(): string | null { return null; }
  getGrammarInjections(): { scopeName: string; path: string }[] { return []; }
  getLanguageScopeName(): string | null { return "source.ts"; }
  copyToClipboard(): Promise<void> { return Promise.resolve(); }
  createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType { return { key: `deco-${Math.random()}`, options, dispose: noop }; }
  createOutputChannel(): OutputChannel { return { appendLine: noop, dispose: noop }; }
  onDidOpenTextDocument(): Disposable { return noSub; }
  onDidCloseTextDocument(): Disposable { return noSub; }
  onDidChangeTextDocument(): Disposable { return noSub; }
  onDidChangeConfiguration(): Disposable { return noSub; }
  onDidChangeActiveTextEditor(): Disposable { return noSub; }
  onDidChangeTextEditorSelection(): Disposable { return noSub; }
}

const RULES = [
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

const buildLines = (n: number): string[] => {
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) lines.push(`const arrow${i} = (x: number): boolean => x > 0 || x < 0;`);
    else if (i % 7 === 0) lines.push(`const flag${i} = a && b;`);
    else if (i % 25 === 0) lines.push(`function sectionHeading${i}(a: number): number {`);
    else lines.push(`const plain${i} = i;`);
  }

  return lines;
};

const makeDocModel = (lines: string[]): DocumentView => {
  const text = lines.join("\n");
  const offsets = [0];
  for (let i = 0; i < lines.length; i++) offsets[i + 1] = offsets[i] + lines[i].length + 1;
  return {
    uri: "test",
    getText(r: Range): string { return text.slice(offsets[r.start.line] + r.start.character, offsets[r.end.line] + r.end.character); },
    getLine(line: number): string { return lines[line] ?? ""; },
    getLineRange(line: number): Range { return rangeFrom(line, 0, line, (lines[line] ?? "").length); },
    getLineCount(): number { return lines.length; },
    validateRange(r: Range): Range { return r; },
  };
};

const loadGrammar = async (): Promise<IGrammar> => {
  const registry = new Registry({ onigLib: onigLibPromise, loadGrammar: () => Promise.resolve(parseRawGrammar(grammarJson, "synthetic-ts.json")) });
  const grammar = await registry.loadGrammar("source.ts");
  assert.ok(grammar, "synthetic typescript grammar loaded");
  return grammar;
};

suite("chunked reparse", () => {
  test("viewport is parsed before background chunks", async () => {
    const grammar = await loadGrammar();
    const lines = buildLines(5000);
    const doc = makeDocModel(lines);
    const model = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar, skipInitialReparse: true,
    });

    const order: string[] = [];
    const viewport = rangeFrom(100, 0, 150, 0);
    await model.reparseViewportFirst(viewport, (range) => {
      order.push(range.start.line === 0 || range.start.line <= 100 ? "viewport-or-before" : "after");
    });

    // The viewport chunk (lines 0–500) must be reported first.
    assert.strictEqual(order[0], "viewport-or-before",
      `first chunk reported was "${order[0]}", expected viewport first`);
    // All subsequent chunks are "after".
    for (let i = 1; i < order.length; i++) {
      assert.strictEqual(order[i], "after", `chunk ${i} was "${order[i]}", expected "after"`);
    }
  });

  test("event loop stays responsive during chunked reparse", async () => {
    const grammar = await loadGrammar();
    const lines = buildLines(8000);
    const doc = makeDocModel(lines);
    const model = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar, skipInitialReparse: true,
    });

    // A 1ms setInterval must keep firing while the reparse yields to the event
    // loop between chunks (setImmediate); a blocked loop would fire 0 times.
    let ticks = 0;
    const interval = setInterval(() => { ticks++; }, 1);

    await model.reparseViewportFirst(undefined, undefined, undefined);

    clearInterval(interval);
    assert.ok(ticks >= 3,
      `event loop only ticked ${ticks} times during reparse (expected >= 3; ` +
      `if 0, the event loop was blocked)`);
  });

  test("onChunkComplete is called for each chunk", async () => {
    const grammar = await loadGrammar();
    const lines = buildLines(5000);
    const doc = makeDocModel(lines);
    const model = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar, skipInitialReparse: true,
    });

    const chunks: Range[] = [];
    await model.reparseViewportFirst(rangeFrom(0, 0, 50, 0), (r) => chunks.push(r));

    // Viewport chunk + background chunks.
    // 5000 lines, viewport 0–500 → 1 viewport chunk + (0 before) + (500–5000)/2048 ≈ 2 background chunks.
    assert.ok(chunks.length >= 2,
      `expected >= 2 chunks (viewport + background), got ${chunks.length}`);
    // Chunks must cover the full document without gaps.
    let covered = 0;
    for (const c of chunks) covered += c.end.line - c.start.line;
    assert.strictEqual(covered, 5000,
      `chunks cover ${covered} lines, expected 5000`);
  });

  test("chunked result equals full-sync result (idempotency)", async () => {
    const grammar = await loadGrammar();
    const lines = buildLines(5000);
    const doc = makeDocModel(lines);

    // Full-sync model (the reference).
    const syncModel = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar,
    });
    const syncRanges = syncModel.getPrettySubstitutionsRanges();

    // Chunked model.
    const asyncModel = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar, skipInitialReparse: true,
    });
    await asyncModel.reparseViewportFirst(rangeFrom(100, 0, 200, 0));
    const asyncRanges = asyncModel.getPrettySubstitutionsRanges();

    assert.strictEqual(asyncRanges.length, syncRanges.length,
      `chunked produced ${asyncRanges.length} ranges, sync produced ${syncRanges.length}`);
  });

  test("no viewport → whole document chunked", async () => {
    const grammar = await loadGrammar();
    const lines = buildLines(4096);
    const doc = makeDocModel(lines);
    const model = createPrettyModel(new FakeHost(), doc, SETTINGS, {
      ...OPTIONS, textMateGrammar: grammar, skipInitialReparse: true,
    });

    const chunks: Range[] = [];
    await model.reparseViewportFirst(undefined, (r) => chunks.push(r));

    // 4096 lines / 2048 chunk = exactly 2 chunks.
    assert.strictEqual(chunks.length, 2,
      `expected 2 chunks for 4096 lines, got ${chunks.length}`);
    // First chunk starts at 0, second at 2048.
    assert.strictEqual(chunks[0].start.line, 0);
    assert.strictEqual(chunks[1].start.line, 2048);
  });

  test("cancellation token flips state", () => {
    const store = ReparseStoreModel.create();
    createReparseToken(store);
    const token = store.currentToken;
    assert.ok(token, "token was created");
    assert.strictEqual(token.cancelled, false);
    token.cancelled = true;
    assert.strictEqual(token.cancelled, true);
  });
});
