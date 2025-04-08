/**
 * Pure conversion utilities between vscode types and the host geometry types.
 *
 * These are the only functions that know how to translate a vscode Position /
 * Range / Selection into the host's own value types (and back). They take no
 * side effects and import nothing from the backend except the type definitions.
 */
import * as vscode from 'vscode';
import type {
  Position as HostPosition,
  Range as HostRange,
  Selection as HostSelection,
  TextEditor as HostTextEditor,
  TextEditorDecorationType,
  DecorationRenderOptions,
  TextDocument as HostTextDocument,
  TextLine as HostTextLine,
} from '../../apps/backend/host';
import {
  positionFrom,
  rangeFromPositions,
  selectionFrom,
} from '../../apps/backend/host';

// ---------------------------------------------------------------------------
// Geometry: host → vscode
// ---------------------------------------------------------------------------

export const toVscodePosition = (p: HostPosition): vscode.Position =>
  new vscode.Position(p.line, p.character);

export const toVscodeRange = (r: HostRange): vscode.Range =>
  new vscode.Range(toVscodePosition(r.start), toVscodePosition(r.end));

export const toVscodeSelection = (s: HostSelection): vscode.Selection =>
  new vscode.Selection(toVscodePosition(s.anchor), toVscodePosition(s.active));

// ---------------------------------------------------------------------------
// Geometry: vscode → host
// ---------------------------------------------------------------------------

export const toHostPosition = (p: vscode.Position): HostPosition =>
  positionFrom(p.line, p.character);

export const toHostRange = (r: vscode.Range): HostRange =>
  rangeFromPositions(toHostPosition(r.start), toHostPosition(r.end));

export const toHostSelection = (s: vscode.Selection): HostSelection =>
  selectionFrom(toHostPosition(s.anchor), toHostPosition(s.active));

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const toHostTextLine = (line: vscode.TextLine): HostTextLine => ({
  text: line.text,
  range: toHostRange(line.range),
  // Modern vscode TextLine has no firstOrOnlyRange — it equals `range`.
  firstOrOnlyRange: toHostRange(line.range),
  rangeIncludingLineBreak: toHostRange(line.rangeIncludingLineBreak),
  lineNumber: line.lineNumber,
  rangeOfNonWhitespaceCharacters: () => {
    const start = line.range.start;
    const end = line.range.end;
    const nonWs = line.firstNonWhitespaceCharacterIndex;
    return rangeFromPositions(
      positionFrom(start.line, start.character + nonWs),
      positionFrom(end.line, end.character),
    );
  },
  offsetAt: (character: number) => line.range.start.character + character,
  positionAt: (offset: number) =>
    positionFrom(line.range.start.line, line.range.start.character + offset),
});

export const toHostTextDocument = (doc: vscode.TextDocument): HostTextDocument => ({
  uri: doc.uri.toString(),
  languageId: doc.languageId,
  fileName: doc.fileName,
  isClosed: doc.isClosed,
  lineCount: doc.lineCount,
  getText: (range?: HostRange) =>
    range ? doc.getText(toVscodeRange(range)) : doc.getText(),
  lineAt: (line: number) => toHostTextLine(doc.lineAt(line)),
  positionAt: (offset: number) => toHostPosition(doc.positionAt(offset)),
  offsetAt: (position: HostPosition) => doc.offsetAt(toVscodePosition(position)),
  validateRange: (range: HostRange) => toHostRange(doc.validateRange(toVscodeRange(range))),
});

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

export const toHostTextEditor = (
  editor: vscode.TextEditor,
  decorationMap: Map<string, vscode.TextEditorDecorationType>,
): HostTextEditor => ({
  document: toHostTextDocument(editor.document),
  get selections() {
    return editor.selections.map(toHostSelection);
  },
  set selections(value: HostSelection[]) {
    editor.selections = value.map(toVscodeSelection);
  },
  get visibleRanges() {
    return editor.visibleRanges.map(toHostRange);
  },
  setDecorations: (type: TextEditorDecorationType, ranges: HostRange[]) => {
    const real = decorationMap.get(type.key);
    if (real) {
      editor.setDecorations(real, ranges.map(toVscodeRange));
    }
  },
});

// ---------------------------------------------------------------------------
// Decoration options
// ---------------------------------------------------------------------------

const toVscodeRangeBehavior = (
  b?: string,
): vscode.DecorationRangeBehavior | undefined => {
  switch (b) {
    case 'OpenOpen':
      return vscode.DecorationRangeBehavior.OpenOpen;
    case 'ClosedClosed':
      return vscode.DecorationRangeBehavior.ClosedClosed;
    case 'OpenClosed':
      return vscode.DecorationRangeBehavior.OpenClosed;
    case 'ClosedOpen':
      return vscode.DecorationRangeBehavior.ClosedOpen;
    default:
      return undefined;
  }
};

// String-valued options copied verbatim from the backend options to the
// vscode ones (iconPath was removed from the modern vscode API).
const stringOptionKeys = [
  'color',
  'letterSpacing',
  'fontStyle',
  'fontWeight',
  'backgroundColor',
  'outline',
  'border',
  'borderRadius',
  'textDecoration',
  'cursor',
] as const;

type ContentBlock = NonNullable<Partial<DecorationRenderOptions>['before']>;

const copyContentBlock = (
  source: ContentBlock | undefined,
  target: vscode.DecorationRenderOptions,
  key: 'before' | 'after',
) => {
  // Spread (rather than field-by-field copy) so unknown fields like
  // contentIcon pass through untouched, as before.
  if (source) target[key] = { ...source };
};

const copyThemeVariants = (
  opts: Partial<DecorationRenderOptions>,
  result: vscode.DecorationRenderOptions,
) => {
  if (opts.dark !== undefined) result.dark = toVscodeDecorationOptions(opts.dark);
  if (opts.light !== undefined) result.light = toVscodeDecorationOptions(opts.light);
};

const toVscodeDecorationOptions = (
  opts: Partial<DecorationRenderOptions>,
): vscode.DecorationRenderOptions => {
  const result: vscode.DecorationRenderOptions = {};
  if (opts.rangeBehavior !== undefined) {
    const rb = toVscodeRangeBehavior(opts.rangeBehavior);
    if (rb !== undefined) result.rangeBehavior = rb;
  }
  for (const key of stringOptionKeys) {
    const value = opts[key];
    if (value !== undefined) result[key] = value;
  }
  copyContentBlock(opts.before, result, 'before');
  copyContentBlock(opts.after, result, 'after');
  copyThemeVariants(opts, result);
  return result;
};

export { toVscodeDecorationOptions };
