import { unprotect } from "mobx-state-tree";
import type { Host, Range, Selection, TextEditor, TextEditorDecorationType } from "../host";
import type { LanguageEntry } from "../store.d/type";
import { DocumentStoreModel } from "./store";
import type { DocumentStore, DocumentView, PrettyModelOptions } from "./type";
import { activeEditorDecorationTimeout, createDebounce, updateSelectionTimeout } from "@md-prettify/utils";
import { initializeController } from "./actions/lifecycle";
import {
	renderPrettyCursor,
	revealSelections,
} from "./actions/decorations";
import {
	documentDecorationEntries,
	findSymbolsOnLine,
	getDecoratedText,
	toggleLineDisabled,
} from "@md-prettify/utils";
import { applyChanges as applyStoreChanges, recomputeDecorations } from "../reparse/apply-changes";
import { getEditors, applyDecorations } from "./editor-decorations";
import { chunkedFullReparse } from "../reparse/chunked";

/** The store-backed pretty model: the engine state plus the operations the controller and tests use. */
export interface PrettyModel {
	getPrettySubstitutionsRanges(): Range[];
	getDecorationsList(): Set<{ decoration: TextEditorDecorationType; ranges: Range[] }>;
	getDecoratedText(range: Range): string;
	revealSelections(selections: Selection[]): ReturnType<typeof revealSelections>;
	renderPrettyCursor(selections: Selection[]): ReturnType<typeof renderPrettyCursor>;
	applyChanges(changes: { range: Range; text: string }[]): boolean;
	recomputeDecorations(): void;
	toggleLine(line: number): boolean;
	reparseViewportFirst(viewportRange?: Range, onChunkComplete?: (range: Range) => void, pushEvery?: number): Promise<void>;
	/** The underlying store instance. */
	readonly state: DocumentStore;
}

/** The scope the grammar itself covers (vscode-textmate grammars rarely expose it, so it is a best effort). */
const grammarScopeName = (grammar: object | null | undefined): string | undefined =>
	(grammar as { scopeName?: string } | null | undefined)?.scopeName;

/** Builds a document store for a free-standing pretty model. */
const createModelStore = (host: Host, document: DocumentView, settings: LanguageEntry, options: PrettyModelOptions): DocumentStore => {
	const state = DocumentStoreModel.create({
		document,
		textDocument: undefined,
		host,
		prettySubstitutions: new Set(),
		decorationCache: new Map(),
		hiddeDecorationsRanges: new Set(),
		lineIndex: new Map(),
		rangeKeyToCacheKey: new Map(),
		changedUglies: false,
		hiddenDecoration: null,
		revealedUglyDecoration: null,
		boxedSymbolDecoration: null,
		debug: options.debug,
		outputChannel: options.outputChannel,
		defaultScope: settings.textMateInitialScope ?? grammarScopeName(options.textMateGrammar) ?? options.textMateGrammarScope ?? "",
		excludedScopes: new Set(settings.excludedScopes ?? []),
		hideTextMethod: options.hideTextMethod,
		revealStrategy: settings.revealOn ?? "cursor",
		prettyCursor: settings.prettyCursor ?? "boxed",
		disabledLines: new Set(),
		subscriptions: [],
		currentDecorations: [],
		updateActiveEditor: createDebounce(activeEditorDecorationTimeout),
		updateSelection: createDebounce(updateSelectionTimeout),
		adjustCursorMovement: false,
		lastSelections: new Map(),
		revealedRanges: [],
		cursorRanges: [],
		grammar: options.textMateGrammar ?? null,
		grammarState: [],
	});
	unprotect(state);
	return state;
};

/**
 * Creates a pretty model for the given document: the document feature store
 * initialized with the language entry and grammar, exposed as plain operations.
 */
export const createPrettyModel = (
	host: Host,
	document: DocumentView,
	settings: LanguageEntry,
	options: PrettyModelOptions,
): PrettyModel => {
	const state = createModelStore(host, document, settings, options);

	initializeController(state, settings.substitutions ?? []);

	return {
		state,
		getPrettySubstitutionsRanges: () => Array.from(state.hiddeDecorationsRanges),
		getDecorationsList: () => new Set(
			documentDecorationEntries(state.disabledLines, state.decorationCache, state.hiddeDecorationsRanges, state.hiddenDecoration),
		),
		getDecoratedText: (range) => getDecoratedText(state, range),
		revealSelections: (selections) => revealSelections(state, selections),
		renderPrettyCursor: (selections) => renderPrettyCursor(state, selections),
		applyChanges: (changes) => applyStoreChanges(state, changes),
		recomputeDecorations: () => recomputeDecorations(state),
		toggleLine: (line) => {
			const disabled = toggleLineDisabled(state.disabledLines, line, (l) => findSymbolsOnLine(state, l).length > 0);
			if (disabled === null) return false;
			recomputeDecorations(state);
			return disabled;
		},
		reparseViewportFirst: (viewportRange, onChunkComplete, pushEvery) =>
			chunkedFullReparse(state, { viewportRange, onChunkComplete, pushEvery }),
	};
};

/** Reapplies the model's decorations to the editors showing its document. */
export const refreshModelDecorations = (model: PrettyModel): void => {
	applyDecorations(model.state, getEditors(model.state), Array.from(model.getDecorationsList()));
};

export type { TextEditor };
