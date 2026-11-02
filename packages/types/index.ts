export type {
  Position,
  Range,
  Selection,
  RangeDelta,
  CursorMovementDocument,
  ContentBlock,
} from './geometry';
export type { TextLine, TextDocument, TextEditor, TextEditorSelectionEvent, DocumentView, DocumentModelData } from './ide-editor';
export {
  DecorationRangeBehavior,
  type DecorationRangeBehaviorValue,
  type DecorationRenderOptions,
  type DecorationInstanceRenderOptions,
  type TextEditorDecorationType,
} from './decorations';

/** The substitution settings for a language (or group of languages) */
export interface LanguageEntry {
	/** language(s) to apply these substitutions on */
	language:  string | string[];
	/** substitution rules */
	substitutions: Substitution[];
	/** A list of TextMate scope prefixes to completely ignore for all substitutions in this language entry. */
	excludedScopes?: string[];
	/** If `true`, combine adjacent tokens if they have the same scope name */
	combineIdenticalScopes: boolean;
	/** try to make pretty-symbol act like a single character */
	adjustCursorMovement?: boolean;
	/** when to unfold a symbol to reveal its underlying text; in response to cursors or selections */
	revealOn?: UglyRevelation;
	/** rendering tweaks to a symbol when in proximity to the cursor */
	prettyCursor?: PrettyCursor;
	/** The filename of the language's grammar. If specified, substitutions' scope entries refer to scope names in the given grammar. If undefined, then search for a grammar.*/
	textMateGrammar?: string;
	/** Override the TextMate scope for the language */
	textMateInitialScope?: string;
}

export type OnEnabledChangeHandler = (enabled: boolean) => void;

/** A configuration change event from the IDE. */
export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean;
}

/** Anything that can be disposed to release its resources. */
export interface Disposable {
  dispose(): void;
}

/** A logging sink. The adapter maps this to the IDE's output channel. */
export interface OutputChannel extends Disposable {
  appendLine(value: string): void;
}

/** Describes conditions in which a symbol may be temporarily revealed */
export type UglyRevelation =
  'cursor'        // the cursor reveals any ugly symbol it touches
  | 'cursor-inside' // the cursor reveals any symbol it enters
  | 'active-line'   // the cursor reveals all symbols on the same line
  | 'selection'     // the cursor reveals all symbols within a selection
  | 'none';         // the cursor does not reveal any symbol

/** Controls how a symbol is rendered when a cursor is on it */
export type PrettyCursor =
    'boxed' // render an outline around the symbol
	| 'none'  // do change to the symbol

/** Essentially mirrors DecorationRenderOptions, but restricted to the
 * properties that apply to both :before/:after decorations and plain decorations */
export interface PrettyStyleProperties {
  border?: string,
	textDecoration?: string,
	/** A theme color name (resolved by the IDE adapter) or a plain CSS color. */
	color?: string,
	backgroundColor?: string,
	hackCSS?: string,
}
export interface PrettyStyle extends PrettyStyleProperties {
	dark?: PrettyStyleProperties,
	light?: PrettyStyleProperties,
}

/** An individual substitution */
export interface Substitution {
	ugly: RegExp | string, // regular expression (source string or pre-compiled RegExp) describing the text to replace
	pretty: string,      // plain-text symbol to show instead
	pre?: string,        // regular expression guard on text before "ugly"
	post?: string,       // regular expression guard on text after "ugly"
	style?: PrettyStyle, // stylings to apply to the "pretty" text, if specified, or else the ugly text
	scope?: string | string[],      // TextMate scope; if specified, the ugly portion's range must be exactly within the given scope
}

/**
 * The public API surface exposed by the extension (see the `mdPrettify`
 * activation return value). The `LanguageEntry` type is the canonical one
 * from `apps/backend/config/configuration` — it is a superset of what
 * third-party extensions need, so no separate (narrower) copy is kept here.
 */
export interface mdPrettify {
  /** Register a handler to receive notifications when PSM is enabled or disabled.
   * @returns a disposable object to unregister the handler
   */
  onDidEnabledChange: (handler: (enabled: boolean) => void) => Disposable,
  /** Query whether PSM is "enabled" - this refers to the user's ability to
   * temporarily enable/disable the mode for an instance of the IDE.
   * @returns `true` iff PSM is currently enabled
   */
  isEnabled: () => boolean,
  /** Temporarily add more substitutions.
   * @returns a disposable object to remove the provided substitutions
   */
  registerSubstitutions: (substitutions: LanguageEntry) => Disposable,
}
