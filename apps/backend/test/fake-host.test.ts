import * as assert from "assert";
import * as backend from "../index";
import { createRootStore } from '../store';
import { positionFrom, positionIsEqual, positionCompare, rangeFrom, rangeFromPositions, rangeIsEqual, selectionFrom } from "../host";
import type {
  Host,
  TextEditorDecorationType,
  DecorationRenderOptions,
  OutputChannel,
  Disposable,
} from "../host";

/**
 * A fake host: the minimum Host implementation needed to run the backend
 * without an IDE. Proves the backend is IDE-agnostic (step-5 acceptance).
 */
class FakeHost implements Host {
  commands = new Map<string, (...args: unknown[]) => unknown>();
  textDocuments: never[] = [];
  visibleTextEditors: never[] = [];
  activeTextEditor = null;

  registerCommand(id: string, callback: (...args: unknown[]) => unknown): Disposable {
    this.commands.set(id, callback);
    return { dispose: () => this.commands.delete(id) };
  }

  getConfiguration(section: string): unknown {
    void section;
    return {};
  }

  matchLanguage(language: string | string[], document: { languageId: string }): number {
    const langs = Array.isArray(language) ? language : [language];
    return langs.includes(document.languageId) ? 1 : 0;
  }

  getGrammarFilePath(): string | null {
    return null;
  }

  getGrammarInjections(languageScopeName: string): { scopeName: string; path: string }[] {
    void languageScopeName;
    return [];
  }

  getLanguageScopeName(): string | null {
    return null;
  }

  copyToClipboard(text: string): Promise<void> {
    void text;
    return Promise.resolve();
  }

  createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
    return { key: `deco-${Math.random()}`, options, dispose: () => {} };
  }

  createOutputChannel(name: string): OutputChannel {
    void name;
    return { appendLine: () => {}, dispose: () => {} };
  }

  onDidOpenTextDocument(): Disposable {
    return { dispose: () => {} };
  }
  onDidCloseTextDocument(): Disposable {
    return { dispose: () => {} };
  }
  onDidChangeTextDocument(): Disposable {
    return { dispose: () => {} };
  }
  onDidChangeConfiguration(): Disposable {
    return { dispose: () => {} };
  }
  onDidChangeActiveTextEditor(): Disposable {
    return { dispose: () => {} };
  }
  onDidChangeTextEditorSelection(): Disposable {
    return { dispose: () => {} };
  }
}

suite("fake host", () => {
  test("the backend activates and registers its commands against a fake host", () => {
    createRootStore();
    const host = new FakeHost();
    backend.activate(host);
    backend.registerCommands(host);
    backend.registerListeners(host);

    assert.ok(host.commands.has("md-prettify.enablePrettySymbols"), "enable command registered");
    assert.ok(host.commands.has("md-prettify.disablePrettySymbols"), "disable command registered");
    assert.ok(host.commands.has("md-prettify.togglePrettySymbols"), "toggle command registered");
  });

  test("host geometry types work without an IDE", () => {
    const p1 = positionFrom(1, 2);
    const p2 = positionFrom(1, 2);
    const p3 = positionFrom(3, 4);
    assert.ok(positionIsEqual(p1, p2));
    assert.ok(!positionIsEqual(p1, p3));
    assert.ok(positionCompare(p1, p3) < 0);
    assert.ok(positionCompare(p3, p1) > 0);

    const r = rangeFrom(0, 1, 2, 3);
    assert.strictEqual(r.start.line, 0);
    assert.strictEqual(r.end.character, 3);
    assert.ok(rangeIsEqual(r, rangeFromPositions(positionFrom(0, 1), positionFrom(2, 3))));

    const s = selectionFrom(positionFrom(0, 0), positionFrom(1, 0));
    assert.strictEqual(s.anchor.line, 0);
    assert.strictEqual(s.active.line, 1);
  });
});
