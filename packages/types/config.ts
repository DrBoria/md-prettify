/** Language configuration, public API and substitution shapes. */
import type { Range } from './index';
import type { TextDocument } from './document';
import type { TextEditorDecorationType } from './decorations';

/** A predefined substitution configuration (a named language entry). */
export interface PredefinedConfig {
	substitutions: Substitution[];
	settings: Partial<LanguageEntry>;
}

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

/** A handler notified when the extension is enabled or disabled. */
export type OnEnabledChangeHandler = (enabled: boolean) => void;

/** A debounced callback runner: `call` reschedules, `dispose` cancels. */
export interface DebounceFunction extends Disposable {
	call: (callback: () => void) => void;
}

/** One decoration entry to apply to an editor. */
export interface DecorationListEntry {
	decoration: TextEditorDecorationType;
	ranges: Range[];
}

/** The substitution settings for a language (or group of languages). */
export interface LanguageEntry {
	/** language(s) to apply these substitutions on */
	language: string | string[];

	/** substitution rules */
	substitutions: Substitution[];

	/** A list of TextMate scope prefixes to completely ignore for all substitutions in this language entry. */
	excludedScopes?: string[];

	/** If `true`, combine adjacent tokens if they have the same scope name */
	combineIdenticalScopes: boolean;

	/** try to make pretty-symbol act as a single character */
	adjustCursorMovement?: boolean;

	/** when to unfold a symbol to reveal its underlying text */
	revealOn?: UglyRevelation;

	/** rendering tweaks to a symbol when in proximity to the cursor */
	prettyCursor?: PrettyCursor;

	/** The filename of the language's grammar. */
	textMateGrammar?: string;

	/** Override the TextMate scope for the language */
	textMateInitialScope?: string;
}

/** Describes conditions in which a symbol may be temporarily revealed. */
export type UglyRevelation =
	| 'cursor' // the cursor reveals any ugly symbol it touches
	| 'cursor-inside' // the cursor reveals any symbol it enters
	| 'active-line' // the cursor reveals all symbols on the same line
	| 'selection' // the cursor reveals all symbols within a selection
	| 'none'; // the cursor does not reveal any symbol

/** Controls how a symbol is rendered when a cursor is on it. */
export type PrettyCursor =
	| 'boxed' // render an outline around the symbol
	| 'none'; // do change to the symbol

/** Style properties that apply to both :before/:after decorations and plain decorations. */
export interface PrettyStyleProperties {
	border?: string;
	textDecoration?: string;

	/** A theme color name (resolved by the IDE adapter) or a plain CSS color. */
	color?: string;
	backgroundColor?: string;
	hackCSS?: string;
}

/** A pretty style together with its theme-specific overrides. */
export interface PrettyStyle extends PrettyStyleProperties {
	dark?: PrettyStyleProperties;
	light?: PrettyStyleProperties;
}

/** An individual substitution. */
export interface Substitution {
	ugly: RegExp | string;
	pretty: string;
	pre?: string;
	post?: string;
	style?: PrettyStyle;
	scope?: string | string[];
}

/** The four facts of a substitution that name it in the decoration cache. */
/** A substitution whose `ugly` pattern has already been compiled. */
export type CompiledRule = Substitution & { ugly: RegExp };

/** The public API surface exposed by the extension. */
export interface mdPrettify {
	/** @param {Function} handler receives the enabled/disabled changes */
	onDidEnabledChange: (handler: (enabled: boolean) => void) => void;

	/** @returns `true` iff PSM is currently enabled */
	isEnabled: () => boolean;

	/** @param {LanguageEntry} substitutions the substitutions to add temporarily */
	registerSubstitutions: (substitutions: LanguageEntry) => void;
}

/** The ide's language matcher: a positive rank means the entry applies. */
export type LanguageMatcher = (language: string | string[], doc: TextDocument) => number;

/** Narrow context the pure language-entry functions read instead of the store. */
export type LanguageEntryContext = Pick<
	Settings,
	'substitutions' | 'revealOn' | 'adjustCursorMovement' | 'prettyCursor' | 'predefinedConfig'
> & {
	predefined: Map<string, LanguageEntry>;
	additionalSubstitutions: Set<LanguageEntry>;
};

/** The settings the backend stores on the root store: every default applied. */
export interface Settings {
	substitutions: LanguageEntry[];
	adjustCursorMovement: boolean;
	revealOn: UglyRevelation;
	prettyCursor: PrettyCursor;
	hideTextMethod: 'hack-fontSize' | 'hack-letterSpacing' | 'none';
	predefinedConfig: string;
	debug: boolean;
}

/** The raw `mdPrettify` configuration as read from the ide: any key may be absent. */
export type RawConfiguration = Partial<Settings> & {
	predefinedConfigurations?: { [key: string]: LanguageEntry };
};

/** A substitution compiled into a live rule, plus the priority-cache key. */
export interface CompiledSubstitution {
	rule: {
		ugly: RegExp;
		pretty: string;
		style?: unknown;
		scope?: string | string[];
	};
	priorityKey: string | null;
}

/** The outcome of compiling one substitution rule. */
export interface SubstitutionCompileResult {
	compiled: CompiledSubstitution | null;
	reason?: 'empty' | 'invalid';
}

// ---------------------------------------------------------------------------
// Ide-like structural shapes the adapters convert from
// ---------------------------------------------------------------------------
