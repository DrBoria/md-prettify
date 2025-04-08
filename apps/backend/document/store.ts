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
import { types as t } from "mobx-state-tree";
import type { Disposable, OutputChannel, Range, Selection, TextDocument, TextEditor, TextEditorDecorationType, DecorationInstanceRenderOptions, IGrammar, StackElement, Host } from "../host";
import type { HideTextMethod, PrettyCursor, UglyRevelation } from "../config/configuration";
import type { DebounceFunction } from "./debounce";
import type { DocumentView, PrettySubstitution, UpdateDecorationEntry, DecorationCacheEntry } from "./type";
import { passthrough } from "../utils/mst-passthrough";

export const DocumentStoreModel = t.model("DocumentStore", {
	/** The engine's view of the document: text, line offsets, version. */
	document: passthrough<DocumentView>("document"),
	/** The vscode TextDocument, when the feature is attached to one. */
	textDocument: t.optional(passthrough<TextDocument>("textDocument"), undefined),
	/** The host abstraction over the vscode API. */
	host: passthrough<Host>("host"),

	// --- engine state (formerly DocumentStore) ---
	prettySubstitutions: passthrough<Set<PrettySubstitution>>("prettySubstitutions"),
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
