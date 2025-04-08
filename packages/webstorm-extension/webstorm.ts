/**
 * Pure conversion utilities between webstorm types and the host geometry types.
 *
 * These are the only functions that know how to translate a webstorm Position /
 * Range / Selection into the host's own value types (and back). They take no
 * side effects and import nothing from the backend except the type definitions.
 */
import * as webstorm from 'webstorm';
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
// Geometry: host → webstorm
// ---------------------------------------------------------------------------

export const toWebstormPosition = (p: HostPosition): webstorm.Position =>
  new webstorm.Position(p.line, p.character);

export const toWebstormRange = (r: HostRange): webstorm.Range =>
  new webstorm.Range(toWebstormPosition(r.start), toWebstormPosition(r.end));

export const toWebstormSelection = (s: HostSelection): webstorm.Selection =>
  new webstorm.Selection(toWebstormPosition(s.anchor), toWebstormPosition(s.active));

// ---------------------------------------------------------------------------
// Geometry: webstorm → host
// ---------------------------------------------------------------------------

export const toHostPosition = (p: webstorm.Position): HostPosition =>
  positionFrom(p.line, p.character);

export const toHostRange = (r: webstorm.Range): HostRange =>
  rangeFromPositions(toHostPosition(r.start), toHostPosition(r.end));

export const toHostSelection = (s: webstorm.Selection): HostSelection =>
  selectionFrom(toHostPosition(s.anchor), toHostPosition(s.active));

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const toHostTextLine = (line: webstorm.TextLine): HostTextLine => ({
  text: line.text,
  range: toHostRange(line.range),
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

export const toHostTextDocument = (doc: webstorm.TextDocument): HostTextDocument => ({
  uri: doc.uri.toString(),
  languageId: doc.languageId,
  fileName: doc.fileName,
  isClosed: doc.isClosed,
  lineCount: doc.lineCount,
  getText: (range?: HostRange) =>
    range ? doc.getText(toWebstormRange(range)) : doc.getText(),
  lineAt: (line: number) => toHostTextLine(doc.lineAt(line)),
  positionAt: (offset: number) => toHostPosition(doc.positionAt(offset)),
  offsetAt: (position: HostPosition) => doc.offsetAt(toWebstormPosition(position)),
  validateRange: (range: HostRange) => toHostRange(doc.validateRange(toWebstormRange(range))),
});

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

export const toHostTextEditor = (
  editor: webstorm.TextEditor,
  decorationMap: Map<string, webstorm.TextEditorDecorationType>,
): HostTextEditor => ({
  document: toHostTextDocument(editor.document),
  get selections() {
    return editor.selections.map(toHostSelection);
  },
  set selections(value: HostSelection[]) {
    editor.selections = value.map(toWebstormSelection);
  },
  get visibleRanges() {
    return editor.visibleRanges.map(toHostRange);
  },
  setDecorations: (type: TextEditorDecorationType, ranges: HostRange[]) => {
    const real = decorationMap.get(type.key);
    if (real) {
      editor.setDecorations(real, ranges.map(toWebstormRange));
    }
  },
});

// ---------------------------------------------------------------------------
// Decoration options
// ---------------------------------------------------------------------------

const toWebstormRangeBehavior = (
  b?: string,
): webstorm.DecorationRangeBehavior | undefined => {
  switch (b) {
    case 'OpenOpen':
      return webstorm.DecorationRangeBehavior.OpenOpen;
    case 'ClosedClosed':
      return webstorm.DecorationRangeBehavior.ClosedClosed;
    case 'OpenClosed':
      return webstorm.DecorationRangeBehavior.OpenClosed;
    case 'ClosedOpen':
      return webstorm.DecorationRangeBehavior.ClosedOpen;
    default:
      return undefined;
  }
};

// String-valued options copied verbatim from the backend options to the
// webstorm ones (iconPath was removed from the modern webstorm API).
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
  target: webstorm.DecorationRenderOptions,
  key: 'before' | 'after',
) => {
  // Spread (rather than field-by-field copy) so unknown fields like
  // contentIcon pass through untouched, as before.
  if (source) target[key] = { ...source };
};

const copyThemeVariants = (
  opts: Partial<DecorationRenderOptions>,
  result: webstorm.DecorationRenderOptions,
) => {
  if (opts.dark !== undefined) result.dark = toWebstormDecorationOptions(opts.dark);
  if (opts.light !== undefined) result.light = toWebstormDecorationOptions(opts.light);
};

const toWebstormDecorationOptions = (
  opts: Partial<DecorationRenderOptions>,
): webstorm.DecorationRenderOptions => {
  const result: webstorm.DecorationRenderOptions = {};
  if (opts.rangeBehavior !== undefined) {
    const rb = toWebstormRangeBehavior(opts.rangeBehavior);
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

export { toWebstormDecorationOptions };
