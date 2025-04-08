/**
 * The host's editor value types: the visible editor surface the backend can
 * read and write (selections), the document line/document views, and the
 * selection-change event.
 */
import type { Position, Range, Selection } from './range';
import type { TextEditorDecorationType } from './ide-types';

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
