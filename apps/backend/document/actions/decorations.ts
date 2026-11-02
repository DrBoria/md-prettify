import type { Selection, TextEditor } from "../../host";
import type { DocumentStore, UpdateDecorationEntry, UpdateDecorationInstanceEntry } from "../type";
import {
	renderPrettyCursor as withPrettyCursor,
	revealSelections as withRevealSelections,
} from "@md-prettify/utils";

/** Writes the reveal decoration for the given selections into the store. */
export const revealSelections = (state: DocumentStore, selections: Selection[]): UpdateDecorationEntry => {
	const entry = (!state.document ? null : withRevealSelections(state, selections)) ?? { decoration: undefined as never, ranges: [] };
	state.revealedRanges.clear();
	for (const range of entry.ranges) state.revealedRanges.push(range);
	state.revealedUglyDecoration = entry.decoration;
	return entry;
};

/** Writes the boxed-cursor decoration for the given selections into the store. */
export const renderPrettyCursor = (state: DocumentStore, selections: Selection[]): UpdateDecorationInstanceEntry | null => {
	const entry = (!state.document ? null : withPrettyCursor(state, selections)) ?? null;
	state.cursorRanges.clear();
	for (const range of entry?.ranges ?? []) state.cursorRanges.push(range);
	return entry;
};

/** Writes the adjusted selections back to the editor, falling back on failure. */
export const commitSelections = (state: DocumentStore, editor: TextEditor, adjustedSelections: Selection[]): Selection[] | null => {
	try {
		editor.selections = adjustedSelections;
	} catch (e) {
		console.error("Failed to set adjusted selections:", e);
		state.lastSelections.set(editor, editor.selections);
		return null;
	}
	return adjustedSelections;
};
