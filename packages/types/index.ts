/**
 * The `@md-prettify/types` entry surface.
 *
 * The geometry primitives live here because every other type module builds on
 * them; the rest of the package is re-exported in one place so consumers have a
 * single import root.
 */

/** A single point in a document: a line index and a column within it. */
export interface Position {
	readonly line: number;
	readonly character: number;
}

/** A half-open span in a document between two positions. */
export interface Range {
	/** Brand: lets `isRange` tell a Range apart from a Position. */
	readonly __range: true;
	readonly start: Position;
	readonly end: Position;
}

/** A range plus the cursor's anchor and active ends. */
export interface Selection extends Range {
	readonly anchor: Position;
	readonly active: Position;
}

/** A document edit expressed as the range it replaces plus the deltas it produces. */
export interface RangeDelta {
	start: Position;
	end: Position;
	linesDelta: number;
	endCharactersDelta: number;
}

import type {
	CompiledRule,
	CompiledSubstitution,
	ConfigurationChangeEvent,
	DebounceFunction,
	LanguageEntry,
	LanguageEntryContext,
	LanguageMatcher,
	OnEnabledChangeHandler,
	OutputChannel,
	PredefinedConfig,
	PrettyCursor,
	PrettyStyle,
	PrettyStyleProperties,
	RawConfiguration,
	Settings,
	Substitution,
	SubstitutionCompileResult,
	UglyRevelation,
	mdPrettify,
} from './config';
import type {
	DecorationRangeBehaviorValue,
	DecorationRenderOptions,
	PrettyPartResolution,
	TextEditorDecorationType,
} from './decorations';
import type { DecorationListEntry, Disposable } from './config';
import type { ContentBlock, TextDocument, EditorSnapshot, TextEditorSelectionEvent } from './document';
import type {
	HideTextMethod,
	Ide,
	IdeExtension,
	IdeChangeEvent,
	IdeConfigurationChange,
	IdeDecorationApi,
	IdeDecorationOptions,
	IdeEventsApi,
	IdeGeometryApi,
	IdePosition,
	IdeRange,
	IdeSelectionEvent,
	IdeSelection,
	IdeTextDocument,
	IdeTextEditor,
	TextDocumentChange,
} from './ide';
import type { BackendApi } from './backend';
export type {
	BackendApi,
	CompiledRule,
	CompiledSubstitution,
	ConfigurationChangeEvent,
	DebounceFunction,
	DecorationListEntry,
	Disposable,
	LanguageEntry,
	LanguageEntryContext,
	LanguageMatcher,
	OnEnabledChangeHandler,
	OutputChannel,
	PredefinedConfig,
	PrettyCursor,
	PrettyPartResolution,
	PrettyStyle,
	PrettyStyleProperties,
	RawConfiguration,
	Settings,
	Substitution,
	SubstitutionCompileResult,
	UglyRevelation,
	mdPrettify,
	DecorationRangeBehaviorValue,
	DecorationRenderOptions,
	TextEditorDecorationType,
	ContentBlock,
	TextDocument,
	EditorSnapshot,
	TextEditorSelectionEvent,
	IdeExtension,
	HideTextMethod,
	Ide,
	IdeChangeEvent,
	IdeConfigurationChange,
	IdeDecorationApi,
	IdeDecorationOptions,
	IdeEventsApi,
	IdeGeometryApi,
	IdePosition,
	IdeRange,
	IdeSelectionEvent,
	IdeSelection,
	IdeTextDocument,
	IdeTextEditor,
	TextDocumentChange,
};
