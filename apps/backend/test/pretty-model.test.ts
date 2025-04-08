import * as assert from "assert";
import { rangeFrom } from "../host";
import type { Range } from "../host";
import type { Host, TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from "../host";
import { createPrettyModel } from '../document/pretty-model';
import type { DocumentView } from '../document/type';
import { parseRawGrammar, Registry } from '../grammar/text-mate';
import type { IGrammar } from '../grammar/text-mate';
import { loadOnigLib } from '../grammar/onig-wasm';
import { grammarJson } from "./synthetic-ts-grammar";

const onigLibPromise = loadOnigLib();

const noop = (): Disposable => ({ dispose: () => {} });

const makeFakeHost = (): Host => {
  const host: Host = {
    textDocuments: [],
    visibleTextEditors: [],
    activeTextEditor: null,
    registerCommand: noop,
    getConfiguration(): unknown { return {}; },
    matchLanguage(): number { return 1; },
    getGrammarFilePath(): string | null { return null; },
    getGrammarInjections(): { scopeName: string; path: string }[] { return []; },
    getLanguageScopeName(): string | null { return "source.ts"; },
    copyToClipboard(): Promise<void> { return Promise.resolve(); },
    createDecorationType(o: DecorationRenderOptions): TextEditorDecorationType { return { key: "k", options: o, dispose: () => {} }; },
    createOutputChannel(): OutputChannel { return { appendLine: () => {}, dispose: () => {} }; },
    onDidOpenTextDocument: noop,
    onDidCloseTextDocument: noop,
    onDidChangeTextDocument: noop,
    onDidChangeConfiguration: noop,
    onDidChangeActiveTextEditor: noop,
    onDidChangeTextEditorSelection: noop,
  };
  return host;
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

// A document model whose backing lines can be mutated to simulate an IDE edit.
const makeMutableDocModel = (initial: string[]): { doc: DocumentView; setLines: (l: string[]) => void } => {
  let lines = initial;
  const textOf = () => lines.join("\n");
  const sliceRange = (r: Range) => {
    const text = textOf();
    const offsets = new Array<number>(lines.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < lines.length; i++) offsets[i + 1] = offsets[i] + lines[i].length + 1;
    return text.slice(offsets[r.start.line] + r.start.character, offsets[r.end.line] + r.end.character);
  };
  const doc: DocumentView = {
    uri: "test",
    getText: sliceRange,
    getLine: (line) => lines[line] ?? "",
    getLineRange: (line) => rangeFrom(line, 0, line, (lines[line] ?? "").length),
    getLineCount: () => lines.length,
    validateRange: (r) => r,
  };
  return { doc, setLines: (l) => { lines = l; } };
};

const OPTIONS = {
  hideTextMethod: "hack-letterSpacing" as const,
  debug: false,
  outputChannel: { appendLine: () => {}, dispose: () => {} },
  languageId: "typescript",
};

const loadGrammar = async (): Promise<IGrammar> => {
  const registry = new Registry({ onigLib: onigLibPromise, loadGrammar: () => Promise.resolve(parseRawGrammar(grammarJson, "synthetic-ts.json")) });
  const grammar = await registry.loadGrammar("source.ts");
  assert.ok(grammar, "grammar loaded");
  return grammar;
};

const rangeAt = (r: Range): [number, number, number, number] => [r.start.line, r.start.character, r.end.line, r.end.character];

suite("PrettyModel (synthetic TypeScript grammar)", () => {
  test("finds substitution ranges in plain source scope", async () => {
    const grammar = await loadGrammar();
    const lines = ["const r = a && b;"];
    const doc = makeDocModel(lines);
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "&&", pretty: "AND" }],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    const ranges = model.getPrettySubstitutionsRanges();
    assert.strictEqual(ranges.length, 1);
    // "const r = a " = 12 chars; "&&" spans indices 12..14
    assert.deepStrictEqual(rangeAt(ranges[0]), [0, 12, 0, 14]);
    assert.strictEqual(model.getDecoratedText(rangeFrom(0, 0, 0, 18)), "const r = a AND b;");
  });

  test("scope-restricted rules only match inside their scope", async () => {
    const grammar = await loadGrammar();
    const lines = [
      "function alpha() {",
      "\treturn 1;",
      "}",
      "const x = 1;",
    ];
    const doc = makeDocModel(lines);
    // `function` -> fun is restricted to meta.function.ts, so the keyword
    // only matches where the grammar actually opened that scope.
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "function", pretty: "fun", scope: "meta.function.ts" }],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    const ranges = model.getPrettySubstitutionsRanges();
    assert.strictEqual(ranges.length, 1, "only the in-scope `function` keyword matches");
    assert.strictEqual(ranges[0].start.line, 0);
    // "function alpha() {" (18 chars) decorates to "fun alpha() {" (shorter).
    assert.strictEqual(model.getDecoratedText(rangeFrom(0, 0, 0, 18)), "fun alpha() {");
  });

  test("a scope that never appears in the grammar matches nothing", async () => {
    const grammar = await loadGrammar();
    const lines = ["const r = a && b;"];
    const doc = makeDocModel(lines);
    // A scope the synthetic grammar never produces: no match.
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "&&", pretty: "AND", scope: "meta.arrow.ts" }],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    assert.strictEqual(model.getPrettySubstitutionsRanges().length, 0, "scope never present in this grammar");
  });

  test("excludedScopes skip substitution on excluded segments", async () => {
    const grammar = await loadGrammar();
    const lines = ["// && in a comment"];
    const doc = makeDocModel(lines);
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "&&", pretty: "AND" }],
      excludedScopes: ["comment.line.double-slash.ts"],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    assert.strictEqual(model.getPrettySubstitutionsRanges().length, 0, "comment segment excluded");
  });

  test("applyChanges shifts ranges after an insertion and reparses", async () => {
    const grammar = await loadGrammar();
    const { doc, setLines } = makeMutableDocModel(["const a = x && y;", "const b = p && q;"]);
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "&&", pretty: "AND" }],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    assert.strictEqual(model.getPrettySubstitutionsRanges().length, 2, "one marker per line");

    // Insert a new blank line at the very top of the document.
    const change = { range: rangeFrom(0, 0, 0, 0), text: "inserted\n" };
    setLines(["inserted", "const a = x && y;", "const b = p && q;"]);
    const changed = model.applyChanges([change]);
    assert.strictEqual(changed, true, "changes reported");
    const after = model.getPrettySubstitutionsRanges();
    assert.strictEqual(after.length, 2, "same number of markers after the shift");
    for (const r of after) assert.ok(r.start.line >= 1, `range not shifted: ${r.start.line}:${r.start.character}`);
  });

  test("recomputeDecorations is idempotent", async () => {
    const grammar = await loadGrammar();
    const lines = ["const a = x && y;", "plain"];
    const doc = makeDocModel(lines);
    const settings = {
      language: "typescript",
      substitutions: [{ ugly: "&&", pretty: "AND" }],
      combineIdenticalScopes: true,
    };
    const model = createPrettyModel(makeFakeHost(), doc, settings, { ...OPTIONS, textMateGrammar: grammar });
    const first = model.getPrettySubstitutionsRanges().length;
    model.recomputeDecorations();
    const second = model.getPrettySubstitutionsRanges().length;
    assert.strictEqual(first, 1);
    assert.strictEqual(second, first, "recompute is stable");
  });
});
