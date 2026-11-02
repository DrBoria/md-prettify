/**
 * The host's own geometry value types: Position, Range, Selection.
 *
 * The backend owns its geometry — an IDE adapter converts IDE geometry to
 * these via the `*From` factories and back.
 */
import type { DecorationRenderOptions } from './decorations';

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  /** Brand: lets `isRange` tell a Range apart from a Position. */
  readonly __range: true;
  readonly start: Position;
  readonly end: Position;
}

export interface Selection extends Range {
  readonly anchor: Position;
  readonly active: Position;
}

/** A content block of a decoration: the `before`/`after` render options. */
export type ContentBlock = NonNullable<Partial<DecorationRenderOptions>['before']>;

/**
 * A document edit expressed as the range it replaces plus the line/character
 * deltas the replacement text produces.
 */
export interface RangeDelta {
  start: Position;
  end: Position;
  linesDelta: number;
  endCharactersDelta: number; // delta for positions on the same line as the end position
}

/**
 * The minimal document surface cursor adjustment needs. The backend's
 * `DocumentView` satisfies this structurally; keeping the dependency on this
 * small shape lets the function stay in the pure-function package.
 */
export interface CursorMovementDocument {
  getText(range: Range): string;
  getLineCount(): number;
}
