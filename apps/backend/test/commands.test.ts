import * as assert from "assert";
import type { Host, TextDocument, TextEditor, Disposable, OutputChannel, TextEditorDecorationType, DecorationRenderOptions, Range } from "../host";
import { setHost } from "../config/settings";
import {
  onEnabledChange,
  setEnabled,
  enablePrettySymbols,
  disablePrettySymbols,
  togglePrettySymbols,
} from "../commands/toggle";
import { refreshPage } from "../commands/refresh";
import { copyWithSubstitutions } from "../commands/copy";
import { createRootStore } from '../store';
import type { RootStore } from '../store';

const noop = (): Disposable => ({ dispose: () => {} });

const makeHost = (editor: TextEditor | null): Host => {
  const host: Host = {
    registerCommand: noop,
    textDocuments: [],
    visibleTextEditors: editor ? [editor] : [],
    activeTextEditor: editor,
    getConfiguration(): unknown { return {}; },
    matchLanguage(): number { return 0; },
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

const makeEditor = (): TextEditor => {
  const doc: TextDocument = {
    uri: "file:///unknown.ts",
    languageId: "typescript",
    fileName: "unknown.ts",
    isClosed: false,
    lineCount: 1,
    getText(): string { return ""; },
    lineAt: notNeeded,
    positionAt: notNeeded,
    offsetAt: notNeeded,
    validateRange(r: Range): Range { return r; },
  };
  const editor: TextEditor = {
    document: doc,
    selections: [],
    setDecorations(): void {},
  };
  return editor;
};

const reset = (): RootStore => {
  const root = createRootStore();
  root.host = makeHost(null);
  setHost(root.host);
  return root;
};

suite("commands", () => {
  suite("toggle", () => {
    test("setEnabled toggles state and notifies handlers", () => {
      const root = reset();
      const seen: boolean[] = [];
      const unsub = onEnabledChange((v) => seen.push(v));
      setEnabled(false);
      setEnabled(true);
      assert.strictEqual(root.enabled, true);
      assert.deepStrictEqual(seen, [false, true]);
      unsub.dispose();
      setEnabled(false);
      assert.deepStrictEqual(seen, [false, true], "unsubscribed handler not called");
    });

    test("setEnabled is a no-op when the value is unchanged", () => {
      reset();
      const seen: boolean[] = [];
      onEnabledChange((v) => seen.push(v));
      setEnabled(true); // already true
      assert.deepStrictEqual(seen, [], "no notification for unchanged value");
    });

    test("enable/disable drive the state", () => {
      const root = reset();
      disablePrettySymbols();
      assert.strictEqual(root.enabled, false);
      enablePrettySymbols();
      assert.strictEqual(root.enabled, true);
    });

    test("line toggle is a no-op without an active editor and does not touch global state", () => {
      const root = reset();
      togglePrettySymbols();
      assert.strictEqual(root.enabled, true);
      disablePrettySymbols();
      togglePrettySymbols();
      assert.strictEqual(root.enabled, false);
      enablePrettySymbols();
    });

    test("refreshPage ends with the symbols enabled", () => {
      const root = reset();
      disablePrettySymbols();
      assert.strictEqual(root.enabled, false);
      refreshPage();
      assert.strictEqual(root.enabled, true);
    });
  });

  suite("copyWithSubstitutions", () => {
    test("returns early when there is no active editor", async () => {
      reset();
      const host = makeHost(null);
      await copyWithSubstitutions(host); // must not throw
      assert.ok(true);
    });

    test("returns early when the document is not pretty", async () => {
      reset();
      const host = makeHost(makeEditor());
      await copyWithSubstitutions(host); // unknown doc -> not pretty
      assert.ok(true);
    });
  });
});
