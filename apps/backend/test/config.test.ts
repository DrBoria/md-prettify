import * as assert from "assert";
import type { Host, TextDocument, Disposable, OutputChannel, TextEditorDecorationType, DecorationRenderOptions, Range } from "../host";
import { assignStyleProperties } from "../config/configuration";
import type { PrettyStyleProperties } from "../config/configuration";
import { getLanguageEntry, getAdditionalSubstitutions } from "../config/language-entry";
import { setHost, reloadConfiguration, getSettings } from "../config/settings";
import { createRootStore } from '../store';

// A host whose configuration and language matching are driven by test data.
const makeHost = (config: unknown, match: (lang: string | string[], doc: TextDocument) => number): Host => {
  const noop = (): Disposable => ({ dispose: () => {} });
  const host: Host = {
    registerCommand: noop,
    textDocuments: [],
    visibleTextEditors: [],
    activeTextEditor: null,
    getConfiguration(): unknown { return config; },
    matchLanguage: match,
    getGrammarFilePath(): string | null { return null; },
    getGrammarInjections(): { scopeName: string; path: string }[] { return []; },
    getLanguageScopeName(): string | null { return null; },
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

const notNeeded = (): never => { throw new Error("not needed"); };

const makeDoc = (languageId: string): TextDocument => {
  const doc: TextDocument = {
    uri: `file:///${languageId}.ts`,
    languageId,
    fileName: `${languageId}.ts`,
    isClosed: false,
    lineCount: 1,
    getText(): string { return ""; },
    lineAt: notNeeded,
    positionAt: notNeeded,
    offsetAt: notNeeded,
    validateRange(r: Range): Range { return r; },
  };
  return doc;
};

suite("config", () => {
  suite("assignStyleProperties", () => {
    test("copies all defined properties", () => {
      const target: { border?: string; textDecoration?: string; color?: string; backgroundColor?: string } = {};
      const source: PrettyStyleProperties = { border: "1px solid red", color: "blue", backgroundColor: "green" };
      const result = assignStyleProperties(target, source);
      assert.strictEqual(result.border, "1px solid red");
      assert.strictEqual(result.color, "blue");
      assert.strictEqual(result.backgroundColor, "green");
      assert.strictEqual(result.textDecoration, undefined);
    });

    test("combines textDecoration with hackCSS", () => {
      const target: { textDecoration?: string } = {};
      const result = assignStyleProperties(target, { textDecoration: "underline", hackCSS: "letter-spacing: 2px" });
      assert.strictEqual(result.textDecoration, "underline; letter-spacing: 2px");
    });

    test("hackCSS without textDecoration becomes 'none; ...'", () => {
      const target: { textDecoration?: string } = {};
      const result = assignStyleProperties(target, { hackCSS: "letter-spacing: 2px" });
      assert.strictEqual(result.textDecoration, "none; letter-spacing: 2px");
    });

    test("is a no-op for undefined arguments", () => {
      const target: { border?: string } = {};
      const result = assignStyleProperties(target, undefined);
      assert.strictEqual(result.border, undefined);
    });
  });

  const noMatch = (): number => 0;

suite("settings", () => {
    const reset = (): void => {
      getAdditionalSubstitutions().clear();
      const root = createRootStore();
      root.host = makeHost({}, noMatch);
      setHost(root.host);
      reloadConfiguration();
    };

    test("reloadConfiguration applies defaults from an empty config", () => {
      reset();
      const root = createRootStore();
      root.host = makeHost({}, () => 0);
      setHost(root.host);
      reloadConfiguration();
      const s = getSettings();
      assert.strictEqual(s.revealOn, "cursor");
      assert.strictEqual(s.adjustCursorMovement, false);
      assert.strictEqual(s.prettyCursor, "boxed");
      assert.strictEqual(s.hideTextMethod, "hack-letterSpacing");
      assert.deepStrictEqual(s.substitutions, []);
    });

    test("getLanguageEntry returns the best-matching user entry", () => {
      reset();
      const config = {
        substitutions: [
          { language: "typescript", substitutions: [{ ugly: "\\*", pretty: "x" }], combineIdenticalScopes: true },
          { language: "plaintext", substitutions: [{ ugly: "#", pretty: "y" }], combineIdenticalScopes: true },
        ],
      };
      const root = createRootStore();
      root.host = makeHost(config, (lang) => (lang === "typescript" ? 1 : 0));
      setHost(root.host);
      reloadConfiguration();
      const entry = getLanguageEntry(makeDoc("typescript"));
      assert.ok(entry);
      assert.strictEqual(entry.language, "typescript");
      assert.strictEqual(entry.substitutions.length, 1);
    });

    test("getLanguageEntry merges a predefined config with user substitutions", () => {
      reset();
      const config = {
        predefinedConfig: "custom",
        predefinedConfigurations: {
          custom: { language: "typescript", substitutions: [{ ugly: "a", pretty: "A" }], combineIdenticalScopes: true },
        },
        substitutions: [
          { language: "typescript", substitutions: [{ ugly: "b", pretty: "B" }], combineIdenticalScopes: true },
        ],
      };
      const root = createRootStore();
      root.host = makeHost(config, (lang) => (lang === "typescript" ? 1 : 0));
      setHost(root.host);
      reloadConfiguration();
      const entry = getLanguageEntry(makeDoc("typescript"));
      assert.ok(entry);
      assert.strictEqual(entry.substitutions.length, 2, "predefined + user substitutions concatenated");
    });

    test("getLanguageEntry falls back to additionalSubstitutions", () => {
      reset();
      const root = createRootStore();
      root.host = makeHost({}, (lang) => (lang === "typescript" ? 1 : 0));
      setHost(root.host);
      getAdditionalSubstitutions().add({
        language: "typescript",
        substitutions: [{ ugly: "c", pretty: "C" }],
        combineIdenticalScopes: true,
      });
      reloadConfiguration();
      const entry = getLanguageEntry(makeDoc("typescript"));
      assert.ok(entry);
      assert.strictEqual(entry.language, "typescript");
      assert.strictEqual(entry.substitutions.length, 1);
    });

    test("getLanguageEntry returns undefined when nothing matches", () => {
      reset();
      const root = createRootStore();
      root.host = makeHost({}, () => 0);
      setHost(root.host);
      reloadConfiguration();
      assert.strictEqual(getLanguageEntry(makeDoc("rust")), undefined);
    });
  });
});
