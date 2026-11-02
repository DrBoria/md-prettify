/**
 * The host's editor value types: the visible editor surface the backend can
 * read and write (selections), the document line/document views, and the
 * selection-change event.
 */
import type { Position, Range, Selection } from './geometry';
import type { TextEditorDecorationType } from './decorations';

export interface TextLine {
  readonly text: string;
  readonly range: Range;
  readonly firstOrOnlyRange: Range;
  readonly rangeIncludingLineBreak: Range;
  readonly lineNumber: number;
  rangeOfNonWhitespaceCharacters(): Range;
  offsetAt(character: number): number;
  positionAt(offset: number): Position;
}

export interface TextDocument {
  readonly uri: string;
  readonly languageId: string;
  readonly fileName: string;
  readonly isClosed: boolean;
  readonly lineCount: number;
  getText(range?: Range): string;
  lineAt(line: number): TextLine;
  positionAt(offset: number): Position;
  offsetAt(position: Position): number;
  validateRange(range: Range): Range;
}

export interface TextEditor {
  readonly document: TextDocument;
  /** Readable and writable — the controller adjusts cursors by writing here. */
  selections: Selection[];
  /** The currently visible portion of the document (viewport). Optional —
   *  adapters that cannot determine the viewport omit this. */
  readonly visibleRanges?: Range[];
  setDecorations(decorationType: TextEditorDecorationType, ranges: Range[]): void;
}

export interface TextEditorSelectionEvent {
  readonly editor: TextEditor;
  readonly selections: Selection[];
}

/** A read-only view over a text document, as the engine operates on it. */
export interface DocumentView {
  uri: string;
  getText: (range: Range) => string;
  getLine: (line: number) => string;
  getLineRange: (line: number) => Range;
  getLineCount: () => number;
  validateRange: (range: Range) => Range;
}

/** Data needed to build a read-only document view. */
export interface DocumentModelData {
  document: TextDocument | null;
}
