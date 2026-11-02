import type { Host, Selection, TextDocument, TextEditor } from "../../../host";
import type { LanguageEntry, Substitution } from "../../../store.d/type";
import type { ControllerOptions, DocumentStore, UpdateDecorationEntry, UpdateDecorationInstanceEntry } from "../../type";
import type { PrettyDocumentController } from "../../store";
import { applyDecorations, getEditors, refresh } from "../../editor-decorations";
import { copyDecoratedAction } from "../../../commands/copy-decorated";
import { commitSelections, revealSelections, renderPrettyCursor } from "../decorations";
import { disposeController, initializeController } from "../lifecycle";
import { toggleLineAction } from "../toggle-line";
import { getRoot } from "../../../store";
import { createDocumentStore } from "../../store";
import { registerDocumentStoreAction } from "../create-store";

/** The controller facade over one document store: every call runs one store action. */
export const createControllerAction = (state: DocumentStore): PrettyDocumentController => {
	const reveal = (selections: Selection[]): UpdateDecorationEntry => revealSelections(state, selections);
	const boxCursor = (selections: Selection[]): UpdateDecorationInstanceEntry | null => renderPrettyCursor(state, selections);
	const adjustCursor = (editor: TextEditor): null | Selection[] => {
		state.lastSelections.set(editor, editor.selections);
		return commitSelections(state, editor, editor.selections);
	};
	const toggleLine = (line: number): boolean => {
		const disabled = toggleLineAction(state, line);
		if (disabled) refresh(state);
		return disabled;
	};
	return {
		dispose(): void {
			disposeController(state);
		},
		gotFocus(_editor): void {
			if (!state.prettyModel || !state.document) return;
			applyDecorations(state, getEditors(state), state.currentDecorations);
		},
		copyDecorated: (editor) => copyDecoratedAction(state, editor),
		refresh(): void {
			refresh(state);
		},
		adjustCursor: (editor) => adjustCursor(editor),
		selectionChanged(editor): void {
			state.updateSelection.call(function () {
				if (state.adjustCursorMovement) adjustCursor(editor);
			});
		},
		toggleLine,
		revealSelections: reveal,
		renderPrettyCursor: boxCursor,
		state,
	};
};

/**
 * Creates the pretty-document controller: the store for one document, its
 * engine model, and the operations the IDE adapter calls.
 */
export const createPrettyDocumentController = (
	host: Host,
	doc: TextDocument,
	settings: LanguageEntry,
	options: ControllerOptions,
	substitutions: Substitution[] = [],
): PrettyDocumentController => {
	const state = createDocumentStore(host, doc, settings, options);
	registerDocumentStoreAction(state, host, doc, settings, options);
	const controller = createControllerAction(state);
	initializeController(state, substitutions);
	getRoot().documents.set(doc.uri, controller);
	return controller;
};
