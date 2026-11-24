/**
 * The document feature's types: the compiled substitution rules and the list of
 * decorations the painter hands to the ide.
 */
import type { Range, Substitution, TextEditorDecorationType } from '@md-prettify/types';

/** Parameters used to build a decoration cache key. */
export interface DecorationKeyParams extends Substitution {
	ugly: RegExp | string;
}

/** A parsed substitution rule: the ugly regex and the pretty replacement. */
export interface PrettySubstitution extends DecorationKeyParams {
	ugly: RegExp;
}

/** One decoration type with the ranges it is currently painted on. */
export interface UpdateDecorationEntry {
	decoration: TextEditorDecorationType;
	ranges: Range[];
}
