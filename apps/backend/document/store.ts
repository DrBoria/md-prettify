/**
 * The document store: a mobx-state-tree model holding all state of the
 * document feature — the engine state plus the per-document controller state.
 * Object literal, no classes.
 *
 * Fields that hold mutable structures (Set/Map/sparse arrays/objects whose
 * properties are reassigned) use a `passthrough` custom type: mst stores the
 * value as-is, so the native methods and in-place mutations keep working.
 *
 * Actions live in `./actions/`; import them from there.
 */
import { types as t, unprotect } from "mobx-state-tree";
import type { DebounceFunction } from "@md-prettify/utils";
import { activeEditorDecorationTimeout, createDebounce, createDocumentModel, updateSelectionTimeout } from "@md-prettify/utils";
import type { Disposable, OutputChannel, Range, Selection, TextDocument, TextEditor, TextEditorDecorationType, DecorationInstanceRenderOptions, IGrammar, StackElement, Host } from "../host";
import type { HideTextMethod, LanguageEntry, PrettyCursor, UglyRevelation } from "../store.d/type";
import type { ControllerOptions, DocumentStore, DocumentView, UpdateDecorationEntry, DecorationCacheEntry } from "./type";
import { passthrough } from "@md-prettify/utils";

/** The private state of one debounced callback runner. */
export interface DebounceState {
	timer: ReturnType<typeof setTimeout> | null;
	callback: (() => void) | null;
	timeout: number;
}

/** The engine state the controller delegates to; opaque here to avoid an import cycle. */
export interface PrettyModelHandle {
	getPrettySubstitutionsRanges(): Range[];
	renderPrettyCursor(selections: Selection[]): { ranges: Set<Range> } | null;
	revealSelections(selections: Selection[]): { decoration: TextEditorDecorationType, ranges: Range[] };
	getDecorationsList(): Set<{ decoration: TextEditorDecorationType, ranges: Range[] }>;
	getDecoratedText(range: Range): string;
	applyChanges(changes: { range: Range, text: string }[]): boolean;
	recomputeDecorations(): void;
}

export const DocumentStoreModel = t.model("DocumentStore", {
	/** The engine's view of the document: text, line offsets, version. */
	document: passthrough<DocumentView>("document"),
	/** The vscode TextDocument, when the feature is attached to one. */
	textDocument: t.optional(passthrough<TextDocument>("textDocument"), undefined),
	/** The host abstraction over the vscode API. */
	host: passthrough<Host>("host"),
	/** The per-document engine model that computes substitutions and decorations. */
	prettyModel: t.maybeNull(passthrough<PrettyModelHandle>("prettyModel")),

	// --- engine state (formerly DocumentStore) ---
	prettySubstitutions: t.frozen(),
	decorationCache: passthrough<Map<string, DecorationCacheEntry>>("decorationCache"),
	hiddeDecorationsRanges: passthrough<Set<Range>>("hiddeDecorationsRanges"),
	lineIndex: passthrough<Map<number, Range[]>>("lineIndex"),
	rangeKeyToCacheKey: passthrough<Map<string, string>>("rangeKeyToCacheKey"),
	changedUglies: t.boolean,
	hiddenDecoration: t.maybeNull(passthrough<TextEditorDecorationType>("hiddenDecoration")),
	revealedUglyDecoration: t.maybeNull(passthrough<TextEditorDecorationType>("revealedUglyDecoration")),
	boxedSymbolDecoration: t.maybeNull(passthrough<DecorationInstanceRenderOptions>("boxedSymbolDecoration")),
	debug: t.boolean,
	outputChannel: passthrough<OutputChannel>("outputChannel"),
	defaultScope: t.string,
	excludedScopes: passthrough<Set<string>>("excludedScopes"),
	hideTextMethod: t.enumeration<HideTextMethod>(["hack-fontSize", "hack-letterSpacing", "none"]),
	revealStrategy: t.enumeration<UglyRevelation>(["cursor", "cursor-inside", "active-line", "selection", "none"]),
	prettyCursor: t.enumeration<PrettyCursor>(["boxed", "none"]),
	disabledLines: passthrough<Set<number>>("disabledLines"),

	// --- per-document controller state ---
	subscriptions: passthrough<Disposable[]>("subscriptions"),
	currentDecorations: t.array(t.frozen<UpdateDecorationEntry>()),
	updateActiveEditor: passthrough<DebounceFunction>("updateActiveEditor"),
	updateSelection: passthrough<DebounceFunction>("updateSelection"),
	adjustCursorMovement: t.boolean,
	lastSelections: passthrough<Map<TextEditor, Selection[]>>("lastSelections"),
	revealedRanges: t.array(t.frozen<Range>()),
	cursorRanges: t.array(t.frozen<Range>()),

	// --- non-serializable live state (vscode-textmate mutates the grammar in place) ---
	grammar: t.maybeNull(passthrough<IGrammar>("grammar")),
	grammarState: passthrough<StackElement[]>("grammarState"),
});

/** The store for one document, filled with the values the caller passes. */
export const createDocumentStore = (host: Host, doc: TextDocument, settings: LanguageEntry, options: ControllerOptions): DocumentStore => {
	const state = DocumentStoreModel.create({
		document: createDocumentModel({ document: doc }),
		textDocument: doc,
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
		defaultScope: settings.textMateInitialScope ?? options.textMateGrammarScope ?? "",
		excludedScopes: new Set(settings.excludedScopes ?? []),
		hideTextMethod: options.hideTextMethod,
		revealStrategy: settings.revealOn ?? "cursor",
		prettyCursor: settings.prettyCursor ?? "boxed",
		disabledLines: new Set(),
		prettyModel: null,
		subscriptions: [],
		currentDecorations: [],
		updateActiveEditor: createDebounce(activeEditorDecorationTimeout),
		updateSelection: createDebounce(updateSelectionTimeout),
		adjustCursorMovement: false,
		lastSelections: new Map(),
		revealedRanges: [],
		cursorRanges: [],
		grammar: null,
		grammarState: [],
	});
	unprotect(state);
	return state;
};

/** The controller facade: a state bag plus the operations that delegate to the store actions. */
export interface PrettyDocumentController extends Disposable {
	/** The document's store, read by the feature's actions. */
	readonly state: DocumentStore;
	gotFocus(editor: TextEditor): void;
	copyDecorated(editor: TextEditor): Promise<void>;
	refresh(): void;
	adjustCursor(editor: TextEditor): null | Selection[];
	selectionChanged(editor: TextEditor): void;
	toggleLine(line: number): boolean;
	revealSelections(selections: Selection[]): { decoration: TextEditorDecorationType, ranges: Range[] };
	renderPrettyCursor(selections: Selection[]): { decoration: DecorationInstanceRenderOptions, ranges: Set<Range> } | null;
}
