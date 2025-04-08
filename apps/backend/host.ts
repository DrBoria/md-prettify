/**
 * The host interface — the ONLY surface the backend talks to.
 *
 * The backend is IDE-agnostic: it never imports `vscode` (or any other IDE
 * SDK). It depends on this interface alone. An IDE adapter (e.g.
 * `packages/vscode-extension` for VS Code) implements `Host` by delegating to the
 * IDE's API, converting between IDE types and the geometry/document types
 * defined here. The same backend can therefore run inside VS Code, WebStorm,
 * PyCharm, or a plain test fake.
 *
 * The contract is split into cohesive modules by feature:
 *  - `decorations/host-geometry`    — Position, Range, Selection value types + free functions
 *  - `decorations/host-types` — decoration behavior + render options
 *  - `stores/document/text`    — TextLine, TextDocument interfaces
 *  - `stores/document/editor`  — TextEditor, TextEditorSelectionEvent
 *  - `config/host-events`           — changes, Disposable, OutputChannel
 *  - `stores/document/textmate` — TextMate registry + token types
 *
 * This file is the facade: it holds the `Host` interface itself and
 * re-exports everything above so existing `import ... from './host'` sites
 * keep working unchanged.
 */
import type { TextDocument, TextEditor, TextEditorSelectionEvent } from './utils/ide-editor';
import type { TextEditorDecorationType, DecorationRenderOptions } from './utils/ide-types';
import type {
  TextDocumentChange,
  ConfigurationChangeEvent,
  Disposable,
  OutputChannel,
} from './config/host-events';

export type { Position, Range, Selection } from './utils/range';
export {
  positionFrom,
  positionCompare,
  positionIsEqual,
  positionIsNull,
  positionTranslate,
  positionWith,
  rangeFrom,
  rangeFromPositions,
  isRange,
  rangeIsEmpty,
  rangeIsEqual,
  rangeIsSingleLine,
  rangeIsValid,
  rangeContains,
  rangeIntersection,
  rangeUnion,
  rangeEndIsAt,
  rangeTranslate,
  rangeWith,
  selectionFrom,
} from './utils/range';
export {
  DecorationRangeBehavior,
  type DecorationRangeBehaviorValue,
  type DecorationRenderOptions,
  type DecorationInstanceRenderOptions,
  type TextEditorDecorationType,
} from './utils/ide-types';
export type { TextLine, TextDocument, TextEditor, TextEditorSelectionEvent } from './utils/ide-editor';
export type {
  TextDocumentChange,
  ConfigurationChangeEvent,
  Disposable,
  OutputChannel,
} from './config/host-events';
export type {
  IGrammar,
  IToken,
  ITokenizeLineResult,
  StateStack,
  StackElement,
  ITextMateRegistry,
} from './document/type';

export interface Host {
  /** Register a command handler. Returns a Disposable. */
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;

  /** All currently open text documents. */
  readonly textDocuments: TextDocument[];

  /** All visible editors. */
  readonly visibleTextEditors: TextEditor[];

  /** The active editor, or null. */
  readonly activeTextEditor: TextEditor | null;

  /** Read configuration for the given extension section. */
  getConfiguration(section: string): unknown;

  /** Match a language selector against a document; higher score = better match. */
  matchLanguage(language: string | string[], document: TextDocument): number;

  /**
   * Discover the file path of an installed grammar for the given language
   * scope, or null if not found. IDE-specific (e.g. VS Code's
   * `extensions.all` scan).
   */
  getGrammarFilePath(languageScopeName: string): string | null;

  /**
   * Discover the injections contributed by installed grammars for the given
   * scope, or an empty array.
   */
  getGrammarInjections(languageScopeName: string): { scopeName: string; path: string }[];

  /**
   * Resolve the TextMate language scope name for a language id (e.g.
   * `source.markdown`), or null.
   */
  getLanguageScopeName(languageId: string): string | null;

  /** Copy text to the system clipboard. */
  copyToClipboard(text: string): Promise<void>;

  /** Create a TextMate decoration type. */
  createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;

  /** Create an output channel for logging. */
  createOutputChannel(name: string): OutputChannel;

  // --- events ---
  onDidOpenTextDocument(listener: (document: TextDocument) => void): Disposable;
  onDidCloseTextDocument(listener: (document: TextDocument) => void): Disposable;
  onDidChangeTextDocument(
    listener: (document: TextDocument, changes: TextDocumentChange[]) => void,
  ): Disposable;
  onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable;
  onDidChangeActiveTextEditor(listener: (editor: TextEditor | null) => void): Disposable;
  onDidChangeTextEditorSelection(
    listener: (event: TextEditorSelectionEvent) => void,
  ): Disposable;
}
