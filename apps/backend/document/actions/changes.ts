import type { DocumentStore } from "../type";
import type { Range } from "../../host";
import {
	applyChanges as applyChangesEngine,
	recomputeDecorations as recomputeDecorationsEngine,
} from "../../reparse/apply-changes";

/** Applies the document changes to the model. Returns whether anything changed. */
export const applyChanges = (state: DocumentStore, changes: { range: Range, text: string }[]): boolean => {
	if (!state.document) return false;
	return applyChangesEngine(state, changes);
};

/** Rebuilds the decoration ranges from the cached substitutions. */
export const recomputeDecorations = (state: DocumentStore): void => {
	if (!state.document) return;
	recomputeDecorationsEngine(state);
};
