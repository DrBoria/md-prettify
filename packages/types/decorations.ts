/** Decoration shapes mirroring the IDE's own render options. */
import type { Range } from './index';
import type { Disposable } from './config';

/** Mirrors vscode.DecorationRangeBehavior: how a decoration range reacts to movement. */
export type DecorationRangeBehaviorValue = 'OpenOpen' | 'ClosedClosed' | 'OpenClosed' | 'ClosedOpen';

/** One step of a dynamic rule's pretty form: a decoration for a literal part, or a line to log.
 *  It is shared by the engine that resolves the parts and the action that records them. */
export type PrettyPartResolution =
	{ kind: 'log'; log: string } | { kind: 'decoration'; part: string; partOriginalText: string; uglyRange: Range };

/** The members the two render-options shapes share (mirrors vscode). */
interface DecorationRenderOptionsBase {
	rangeBehavior?: DecorationRangeBehaviorValue;
	color?: string;
	letterSpacing?: string;
	fontStyle?: string;
	fontWeight?: string;
	backgroundColor?: string;
	outline?: string;
	border?: string;
	borderRadius?: string;
	textDecoration?: string;
	cursor?: string;
	iconPath?: string;
}

/** The inline `before`/`after` content block (mirrors vscode). */
interface DecorationContent {
	contentText?: string;
	contentIcon?: string;
	textDecoration?: string;
}

/** Render options for a decoration type, mirroring the IDE's own options. */
export interface DecorationRenderOptions extends DecorationRenderOptionsBase {
	before?: DecorationContent;
	after?: DecorationContent;
	dark?: Partial<DecorationRenderOptions>;
	light?: Partial<DecorationRenderOptions>;
}

/** A decoration type handle the adapter maps to a real IDE decoration type. */
export interface TextEditorDecorationType extends Disposable {
	readonly key: string;
	readonly options: DecorationRenderOptions;
	/** The IDE's own handle, so the adapter can paint without a lookup table. */
	readonly native?: unknown;
}

