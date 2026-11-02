import type { Substitution, DecorationRenderOptions, TextEditorDecorationType } from "@md-prettify/types";
import { DecorationRangeBehavior } from "@md-prettify/types";
import { assignStyleProperties } from "./style-properties";

export const makePrettyDecorationLetterSpacingHack = (host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType }, prettySubst: Substitution): TextEditorDecorationType => {
	const showAttachmentStyling = 'letter-spacing: normal; visibility: visible;';

	let styling: DecorationRenderOptions = {
		after: {},
		dark: { after: {} },
		light: { after: {} },
		rangeBehavior: DecorationRangeBehavior.ClosedClosed,
	};

	if (prettySubst.style) {
		styling.after = assignStyleProperties(styling.after, prettySubst.style);
		if (prettySubst.style.dark)
			styling.dark.after = assignStyleProperties(styling.dark.after, prettySubst.style.dark);
		if (prettySubst.style.light)
			styling.light.after = assignStyleProperties(styling.light.after, prettySubst.style.light);
	}
	styling.after.contentText = prettySubst.pretty;

	// Use a dirty hack to change the font size (code injection)
	styling.after.textDecoration = showAttachmentStyling + (styling.after.textDecoration || 'none;');
	// and make sure the user's textDecoration does not break our hack
	if (styling.light.after.textDecoration)
		styling.light.after.textDecoration = showAttachmentStyling + styling.light.after.textDecoration;
	if (styling.dark.after.textDecoration)
		styling.dark.after.textDecoration = showAttachmentStyling + styling.dark.after.textDecoration;

	return host.createDecorationType(styling);
};

export const makeDecorationsFontSizeHack = (host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType }) => {
	return {
		uglyDecoration: host.createDecorationType({
			textDecoration: 'none; font-size: 0.001em',
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
		}),
		revealedUglyDecoration: host.createDecorationType({
			textDecoration: 'none; font-size: inherit !important',
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				textDecoration: 'none; font-size: 0pt',
			}
		}),
		boxedSymbolDecoration: {
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				border: '0.1em solid',
				margin: '-0em -0.05em -0em -0.1em',
			}
		},
	};
};

export const makeDecorationsLetterSpacingHack = (host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType }) => {
	return {
		uglyDecoration: host.createDecorationType({
			letterSpacing: "-0.55em; font-size: 0.1em; visibility: hidden",
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
		}),
		revealedUglyDecoration: host.createDecorationType({
			letterSpacing: "normal !important; font-size: inherit !important; visibility: visible !important",
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				textDecoration: 'none !important; font-size: 0.1pt !important; visibility: hidden',
			}
		}),
		boxedSymbolDecoration: {
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				border: '0.1em solid',
				margin: '-0em -0.05em -0em -0.1em',
			}
		},
	};
};

export const makeDecorationsNone = (host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType }) => {
	return {
		uglyDecoration: host.createDecorationType({
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
		}),
		revealedUglyDecoration: host.createDecorationType({
			textDecoration: 'none; font-size: inherit !important',
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				textDecoration: 'none; font-size: 0pt',
			}
		}),
		boxedSymbolDecoration: {
			rangeBehavior: DecorationRangeBehavior.ClosedClosed,
			after: {
				border: '0.1em solid',
				margin: '-0em -0.05em -0em -0.1em',
			}
		},
	};
};

/** Whether any scope of the rule ends with `!` (a high-priority rule). */
export const hasPriorityScopes = (scopeArray?: string | string[]): boolean => {
	if (!scopeArray) return false;
	const scopes = Array.isArray(scopeArray) ? scopeArray : [scopeArray];
	for (const scope of scopes) {
		if (typeof scope === 'string' && scope.endsWith('!')) return true;
	}
	return false;
};

/** The hide/reveal decoration set for the configured hide-text method. */
export const makeHideTextDecorations = (
	host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType },
	hideTextMethod: 'hack-fontSize' | 'hack-letterSpacing' | 'none',
) => {
	if (hideTextMethod === 'hack-fontSize') return makeDecorationsFontSizeHack(host);
	if (hideTextMethod === 'hack-letterSpacing') return makeDecorationsLetterSpacingHack(host);
	return makeDecorationsNone(host);
};
