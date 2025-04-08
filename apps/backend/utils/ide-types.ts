/**
 * Decoration types for the host contract: range behavior, render options,
 * and the decoration type handle the adapter maps to a real IDE decoration.
 */
import type { Disposable } from '../config/host-events';

/**
 * Mirrors vscode.DecorationRangeBehavior: how the decoration range reacts
 * to cursor movement. A const object (usable as a value) plus the string
 * union type of the same name.
 */
export const DecorationRangeBehavior = {
  OpenOpen: 'OpenOpen',
  ClosedClosed: 'ClosedClosed',
  OpenClosed: 'OpenClosed',
  ClosedOpen: 'ClosedOpen',
} as const;

export type DecorationRangeBehaviorValue =
  (typeof DecorationRangeBehavior)[keyof typeof DecorationRangeBehavior];

// The members the two render-options shapes share (mirrors vscode).
interface DecorationRenderOptionsBase {
  readonly rangeBehavior?: DecorationRangeBehaviorValue;
  readonly color?: string;
  readonly letterSpacing?: string;
  readonly fontStyle?: string;
  readonly fontWeight?: string;
  readonly backgroundColor?: string;
  readonly outline?: string;
  readonly border?: string;
  readonly borderRadius?: string;
  readonly textDecoration?: string;
  readonly cursor?: string;
  readonly iconPath?: string;
}

// The inline `before`/`after` content block (mirrors vscode).
interface DecorationContent {
  contentText?: string;
  contentIcon?: string;
  textDecoration?: string;
}

export interface DecorationRenderOptions extends DecorationRenderOptionsBase {
  before?: DecorationContent;
  after?: DecorationContent;
  dark?: Partial<DecorationRenderOptions>;
  light?: Partial<DecorationRenderOptions>;
}

export interface DecorationInstanceRenderOptions extends DecorationRenderOptionsBase {
  readonly before?: DecorationContent & { border?: string; margin?: string };
  readonly after?: DecorationContent & { border?: string; margin?: string };
}

/**
 * A decoration type handle. The backend creates these via
 * `Host.createDecorationType` and passes them to `TextEditor.setDecorations`.
 * The adapter maps the `key` to a real IDE decoration type.
 */
export interface TextEditorDecorationType extends Disposable {
  readonly key: string;
  readonly options: DecorationRenderOptions;
}
