import type { Instance } from "mobx-state-tree";
import type { DocumentStoreModel } from "../store";
import type { Range, Selection, TextEditor, TextEditorDecorationType } from "../../host";
import type { UpdateDecorationEntry, UpdateDecorationInstanceEntry } from "../type";
import {
	revealSelections as revealSelectionsEngine,
	renderPrettyCursor as renderPrettyCursorEngine,
	findSymbolsOnLine as findSymbolsOnLineEngine,
} from "../../resolve/reveal";
import { getDecoratedText as getDecoratedTextEngine } from "../../resolve/decorated-text";
import { recomputeDecorations as recomputeDecorationsEngine } from "../../reparse/apply-changes";
import { logError } from "../../config/logger";

type DocumentStore = Instance<typeof DocumentStoreModel>;

/** Keeps only the ranges whose start line is not in the disabled set. */
const filterEnabledRanges = (disabled: Set<number>, ranges: Iterable<Range>): Range[] => {
	const out: Range[] = [];
	for (const r of ranges) {
		if (!disabled.has(r.start.line)) out.push(r);
	}
	return out;
};

/** The decoration entries to apply, skipping lines with pretty symbols disabled. */
export const getDecorationsList = (state: DocumentStore): Set<UpdateDecorationEntry> => {
	const disabled = state.disabledLines;
	const decs = new Set<UpdateDecorationEntry>();
	for (const cacheEntry of state.decorationCache.values()) {
		const ranges = filterEnabledRanges(disabled, cacheEntry.ranges);
		if (ranges.length > 0) {
			decs.add({ decoration: cacheEntry.decorationType, ranges });
		}
	}
	const hiddenRanges = filterEnabledRanges(disabled, state.hiddeDecorationsRanges);
	if (state.hiddenDecoration && hiddenRanges.length > 0) {
		decs.add({ decoration: state.hiddenDecoration, ranges: hiddenRanges });
	}
	return decs;
};

/** Every decoration type the model currently owns (for clearing on dispose). */
export const getAllDecorationTypes = (state: DocumentStore): TextEditorDecorationType[] => {
	const types: TextEditorDecorationType[] = [];
	if (state.hiddenDecoration) types.push(state.hiddenDecoration);
	if (state.revealedUglyDecoration) types.push(state.revealedUglyDecoration);
	for (const cacheEntry of state.decorationCache.values()) types.push(cacheEntry.decorationType);
	return types;
};

/** Toggles pretty symbols on the given line (0-based). */
export const toggleLine = (state: DocumentStore, line: number): boolean => {
	const disabledLines = state.disabledLines;
	const disabled = disabledLines.has(line);
	if (disabled) {
		disabledLines.delete(line);
	} else {
		if (findSymbolsOnLineEngine(state, line).length === 0) return false;
		disabledLines.add(line);
	}
	recomputeDecorationsEngine(state);
	return disabled;
};

/** The decoration entry that reveals the pretty symbol under the given selections. */
export const revealSelections = (state: DocumentStore, selections: Selection[]): UpdateDecorationEntry => {
	if (!state.document) return { decoration: undefined as never, ranges: [] };
	return revealSelectionsEngine(state, selections);
};

/** The boxed-cursor decoration entry for the pretty symbol under the cursor, if any. */
export const renderPrettyCursor = (state: DocumentStore, selections: Selection[]): UpdateDecorationInstanceEntry | null => {
	if (!state.document) return null;
	return renderPrettyCursorEngine(state, selections);
};

/** All pretty symbols on the given line; used by the per-line toggle. */
export const findSymbolsOnLine = (state: DocumentStore, line: number): Range[] => {
	if (!state.document) return [];
	return findSymbolsOnLineEngine(state, line);
};

/** The ranges currently hidden by a pretty substitution. */
export const getPrettySubstitutionsRanges = (state: DocumentStore): Range[] => {
	return Array.from(state.hiddeDecorationsRanges);
};

/** The text of the given range with pretty substitutions applied (for copy). */
export const getDecoratedText = (state: DocumentStore, range: Range): string => {
	if (!state.document) return "";
	return getDecoratedTextEngine(state, range);
};

/** Writes the adjusted selections back to the editor, falling back on failure. */
export const commitSelections = (state: DocumentStore, editor: TextEditor, adjustedSelections: Selection[]): Selection[] | null => {
	try {
		editor.selections = adjustedSelections;
	} catch (e) {
		logError("Failed to set adjusted selections:", e);
		state.lastSelections.set(editor, editor.selections);
		return null;
	}
	return adjustedSelections;
};
