import type { Range, Selection, TextEditorDecorationType, DecorationRenderOptions, DecorationInstanceRenderOptions } from "@md-prettify/types";
import { mapSet, rangeFromPositions } from "./range";
import { findSymbolAt, findSymbolsIn } from "./lookup";

/** Normalizes a single getRanges result into an iterable of ranges. */
const rangeList = (r: Range | Set<Range>): Iterable<Range> => (r instanceof Set ? r : [r]);

/** The ranges found for one selection, skipping disabled lines. */
const selectionRanges = (
	state: { disabledLines: Set<number> },
	selection: Selection,
	getRanges: (sel: Selection) => Range | Set<Range> | undefined,
): Set<Range> => {
	const r = getRanges(selection);
	if (!r) return new Set<Range>();

	return mapSet(new Set(rangeList(r)), (range) => (state.disabledLines.has(range.start.line) ? undefined : range));
};

/** Collects all ranges found by `getRanges` across the given selections, skipping disabled lines. */
const collectRanges = (
	state: { disabledLines: Set<number> },
	selections: Selection[],
	getRanges: (sel: Selection) => Range | Set<Range> | undefined,
): Set<Range> => {
	const found: Range[] = [];
	for (const selection of selections) found.push(...selectionRanges(state, selection, getRanges));
	return new Set(found);
};

const revealRangesForCursor = (
	state: { hiddeDecorationsRanges: Set<Range> },
	sel: Selection,
	options: { includeEnd?: boolean, excludeStart?: boolean },
): Range | undefined => findSymbolAt(state, sel.active, options);

const revealRangesForActiveLine = (
	state: { hiddeDecorationsRanges: Set<Range>; document: { getLineRange: (line: number) => Range } },
	sel: Selection,
): Range | Set<Range> | undefined => findSymbolsIn(state, state.document.getLineRange(sel.active.line));

const revealRangesForSelection = (
	state: { hiddeDecorationsRanges: Set<Range> },
	sel: Selection,
): Range | Set<Range> | undefined => findSymbolsIn(state, rangeFromPositions(sel.start, sel.end));

const boxRangesForCursor = (
	state: { hiddeDecorationsRanges: Set<Range> },
	sel: Selection,
): Range | undefined => findSymbolAt(state, sel.active);

/** Builds the reveal decoration entry for the ranges collected across the selections. */
const reveal = (
	state: {
		revealedUglyDecoration: TextEditorDecorationType | null;
		host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType };
		disabledLines: Set<number>;
	},
	selections: Selection[],
	getRanges: (sel: Selection) => Range | Set<Range> | undefined,
): { decoration: TextEditorDecorationType; ranges: Range[] } => {
	const decoration = state.revealedUglyDecoration || state.host.createDecorationType({});
	return {
		decoration,
		ranges: Array.from(collectRanges(state, selections, getRanges)),
	};
};

/**
 * Computes the decoration entry that reveals the ugly text under the given selections,
 * depending on the configured reveal strategy.
 */
export const revealSelections = (
	state: {
		revealStrategy: string;
		revealedUglyDecoration: TextEditorDecorationType | null;
		host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType };
		disabledLines: Set<number>;
		hiddeDecorationsRanges: Set<Range>;
		document: { getLineRange: (line: number) => Range };
	},
	selections: Selection[],
): { decoration: TextEditorDecorationType; ranges: Range[] } => {
	switch (state.revealStrategy) {
		case 'cursor':
		case 'cursor-inside': {
			const cursorOptions = state.revealStrategy === 'cursor' ? { includeEnd: true } : { excludeStart: true };
			return reveal(state, selections, function (sel) { return revealRangesForCursor(state, sel, cursorOptions); });
		}
		case 'active-line':
			return reveal(state, selections, function (sel) { return revealRangesForActiveLine(state, sel); });
		case 'selection':
			return reveal(state, selections, function (sel) { return revealRangesForSelection(state, sel); });
		default:
			return { decoration: state.revealedUglyDecoration || state.host.createDecorationType({}), ranges: [] };
	}
};

/**
 * Finds all pretty symbols on the given line; used by the per-line toggle.
 */
export const findSymbolsOnLine = (
	state: { hiddeDecorationsRanges: Set<Range>; document: { getLineRange: (line: number) => Range } },
	line: number,
): Range[] => {
	return Array.from(findSymbolsIn(state, state.document.getLineRange(line)));
};

/** Builds the boxed-cursor decoration entry around the pretty symbol under the cursor. */
const boxPretty = (
	state: { boxedSymbolDecoration: DecorationInstanceRenderOptions; disabledLines: Set<number> },
	selections: Selection[],
	getRange: (sel: Selection) => Range | undefined,
): { decoration: DecorationInstanceRenderOptions; ranges: Set<Range> } | null => {
	try {
		return {
			decoration: state.boxedSymbolDecoration || {},
			ranges: collectRanges(state, selections, getRange),
		};
	} catch (err) {
		console.error(err);
		console.error('\n');
		return null;
	}
};

/**
 * Computes the decoration entry that draws a box around the pretty symbol
 * under the cursor, depending on the configured pretty cursor style.
 */
export const renderPrettyCursor = (
	state: {
		prettyCursor: string;
		boxedSymbolDecoration: DecorationInstanceRenderOptions;
		disabledLines: Set<number>;
		hiddeDecorationsRanges: Set<Range>;
	},
	selections: Selection[],
): { decoration: DecorationInstanceRenderOptions; ranges: Set<Range> } | null => {
	switch (state.prettyCursor) {
		case 'boxed': {
			return boxPretty(state, selections, function (sel) { return boxRangesForCursor(state, sel); });
		}
		default:
			return null;
	}
};
