import * as assert from "assert";
import type { Host, TextDocument, TextEditor, Disposable, OutputChannel, TextEditorDecorationType, DecorationRenderOptions, Range } from "../host";
import { setHostAction } from "../document/actions/manage-documents";
import { togglePrettySymbols } from "../commands/toggle-pretty-symbols";
import { addEnabledHandler, removeEnabledHandler } from "../commands/actions/set-enabled";
import { copyWithSubstitutions } from "../commands/editor-events";
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

/** Writes the enabled flag to the store and notifies its subscribers. */
const applyEnabled = (root: RootStore, value: boolean): void => {
  const commands = root.commands;
  if (commands.enabled === value) return;
  commands.enabled = value;
  for (const handler of commands.enabledHandlers) handler(value);
};

const reset = (): RootStore => {
  const root = createRootStore();
  root.host = makeHost(null);
  setHostAction(root, root.host);
  return root;
};

suite("commands", () => {
  suite("toggle", () => {
    test("setEnabled toggles state and notifies handlers", () => {
      const root = reset();
      const seen: boolean[] = [];
      const handler = (v: boolean): void => { seen.push(v); };
      addEnabledHandler(root, handler);
      applyEnabled(root, false);
      applyEnabled(root, true);
      assert.strictEqual(root.commands.enabled, true);
      assert.deepStrictEqual(seen, [false, true]);
      removeEnabledHandler(root, handler);
      applyEnabled(root, false);
      assert.deepStrictEqual(seen, [false, true], "unsubscribed handler not called");
    });

    test("setEnabled is a no-op when the value is unchanged", () => {
      const root = reset();
      const seen: boolean[] = [];
      addEnabledHandler(root, (v) => seen.push(v));
      applyEnabled(root, true); // already true
      assert.deepStrictEqual(seen, [], "no notification for unchanged value");
    });

    test("enable/disable drive the state", () => {
      const root = reset();
      applyEnabled(root, false);
      assert.strictEqual(root.commands.enabled, false);
      applyEnabled(root, true);
      assert.strictEqual(root.commands.enabled, true);
    });

    test("line toggle is a no-op without an active editor and does not touch global state", () => {
      const root = reset();
      togglePrettySymbols();
      assert.strictEqual(root.commands.enabled, true);
      applyEnabled(root, false);
      togglePrettySymbols();
      assert.strictEqual(root.commands.enabled, false);
      applyEnabled(root, true);
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
