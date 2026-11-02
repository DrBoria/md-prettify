/**
 * The config feature's declared types: the settings, the language entries and
 * the public extension API surface.
 */
import type { Range } from '../utils/range';

/**
 * The public API surface exposed by the extension (see the `mdPrettify`
 * activation return value). The `LanguageEntry` type is the canonical one
 * — it is a superset of what third-party extensions need, so no separate
 * (narrower) copy is kept here.
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

export type HideTextMethod = "hack-fontSize" | "hack-letterSpacing" | "none";

/** A predefined substitution configuration (a named language entry) */
export type PredefinedConfig = {
	substitutions: Substitution[];
	settings: Partial<LanguageEntry>;
};

/** The settings for `mdPrettify.substitutions`. Every field is optional in
 * the raw host configuration; `reloadConfiguration` fills in defaults before
 * the settings are stored on the root store. */
export interface Settings {
	/** Main substitution settings, each targetting a different set of languages.
	 * If more than one entry matches a document, we will pick the one with the
	 * highest match-score, as determined by vscode.languages.match()
	*/
  substitutions?: LanguageEntry[],
  // Defaults loaded from the top-level settings; applied to language entries that do not specify each property */
	/** try to make pretty-symbol act like a single character */
  adjustCursorMovement?: boolean, 
	/** when to unfold a symbol to reveal its underlying text; in response to cursors or selections */
  revealOn?: UglyRevelation,
	/** rendering tweaks to a symbol when in proximity to the cursor */
  prettyCursor?: PrettyCursor,
	/** */
	hideTextMethod?: HideTextMethod,
	predefinedConfig?: string,
	debug?: boolean,
}

/** Raw `mdPrettify` host configuration: the (all-optional) `Settings` fields
 *  plus the predefined configurations map that only the raw config carries. */
export interface RawConfiguration extends Settings {
  predefinedConfigurations?: { [key: string]: LanguageEntry };
}

// --- host event and service types ---

export interface TextDocumentChange {
  readonly range: Range;
  readonly text: string;
}

export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean;
}

export interface Disposable {
  dispose(): void;
}

/** A logging sink. The adapter maps this to the IDE's output channel. */
export interface OutputChannel extends Disposable {
  appendLine(value: string): void;
}
