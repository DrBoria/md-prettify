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

/** Build the `textDecoration` value, appending the hack CSS if present */
const buildTextDecoration = (textDecoration: string | undefined, hackCSS: string | undefined): string | undefined => {
	if (textDecoration)
		return textDecoration + (hackCSS ? '; ' + hackCSS : "");
	if (hackCSS)
		return 'none; ' + hackCSS;
	return undefined;
};

/** Pick only the defined styling properties from a source style */
const definedStyleProperties = (source: PrettyStyleProperties): PrettyStyleProperties => {
	const decoration = buildTextDecoration(source.textDecoration, source.hackCSS);
	const properties: PrettyStyleProperties = {};
	if (source.backgroundColor) properties.backgroundColor = source.backgroundColor;
	if (source.border) properties.border = source.border;
	if (source.color) properties.color = source.color;
	if (decoration) properties.textDecoration = decoration;

	return properties;
};

/** Merge all defined styling properties from the source onto the target, returning a new object */
export function assignStyleProperties<T extends PrettyStyleProperties>(target: T, source: PrettyStyleProperties | undefined): T {
	const defined = source ? definedStyleProperties(source) : {};

	return { ...target, ...defined } as T;
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
