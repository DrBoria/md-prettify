import type { Disposable } from "../../host";
import type { DocumentStore } from "../type";
import type { Substitution } from "../../store.d/type";
import { loadDecorationsAction, unloadDecorationsAction } from "./load-decorations";
import { getEditors, onChangeDocument } from "../editor-decorations";
import { recomputeDecorations } from "../../reparse/apply-changes";

/** Loads the decorations and subscribes the store to the document's changes. */
export const initializeController = (state: DocumentStore, substitutions: Substitution[] = []): void => {
	state.grammarState = [];
	state.subscriptions = [
		...(state.subscriptions ?? []),
		state.host.onDidChangeTextDocument(function (changed, changes) {
			onChangeDocument(state, changed, changes);
		}),
	];
	loadDecorationsAction(state, substitutions);
	recomputeDecorations(state);
};

/** Disposes the controller: unloads decorations, clears subscriptions, resets the store fields. */
export const disposeController = (state: DocumentStore): void => {
	unloadDecorationsAction(state);

	for (const sub of state.subscriptions) sub.dispose();
	(state as DocumentStore & { subscriptions: Disposable[] }).subscriptions = [];

	for (const entry of state.currentDecorations) {
		for (const editor of getEditors(state)) editor.setDecorations(entry.decoration, []);
	}
	state.currentDecorations.clear();

	state.prettySubstitutions.clear();
	state.lineIndex.clear();
	state.rangeKeyToCacheKey.clear();
	state.revealedRanges.clear();
	state.cursorRanges.clear();
	state.lastSelections.clear();
	state.grammar = null;
	state.grammarState = [];
};
