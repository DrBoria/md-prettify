/**
 * Choosing the language entry a document is decorated with: the user's rules, the
 * selected predefined configuration and the programmatic ones merged over the
 * defaults, each read from a narrow context object so no store is needed here.
 */
import type {
	CompiledRule,
	DecorationRenderOptions,
	LanguageEntry,
	LanguageEntryContext,
	LanguageMatcher,
	PrettyStyleProperties,
	RawConfiguration,
	Settings,
	TextDocument,
} from '@md-prettify/types';

/** findBestUserEntry: the user's entry that matches a document best, if any,
 * @param {TextDocument} doc the document the entry has to serve
 * @param {LanguageEntryContext} ctx the substitutions the user registered
 * @param {LanguageMatcher} matchLanguage the ide's own language matcher
 * @returns {LanguageEntry | undefined} the best entry, or undefined when none matches */
function findBestUserEntry(doc: TextDocument, ctx: LanguageEntryContext, matchLanguage: LanguageMatcher): LanguageEntry | undefined {
	const userRankings = [];
	for (const entry of ctx.substitutions ?? []) {
		const rank = matchLanguage(entry.language, doc);
		if (rank > 0) userRankings.push({ rank, entry });
	}
	userRankings.sort((x, y) => y.rank - x.rank);

	return userRankings.length > 0 ? userRankings[0].entry : undefined;
}

/** resolveSelectedPredefinedEntry: the selected predefined entry if it fits the doc,
 * @param {TextDocument} doc the document the entry has to serve
 * @param {LanguageEntryContext} ctx the predefined configs the user picked from
 * @param {LanguageMatcher} matchLanguage the ide's own language matcher
 * @returns {LanguageEntry | undefined} the entry, or undefined when none was picked or it does not fit */
function resolveSelectedPredefinedEntry(
	doc: TextDocument,
	ctx: LanguageEntryContext,
	matchLanguage: LanguageMatcher,
): LanguageEntry | undefined {
	const name = ctx.predefinedConfig;
	if (!name || !ctx.predefined.has(name)) return undefined;
	const entry = ctx.predefined.get(name);
	if (!entry || matchLanguage(entry.language, doc) <= 0) return undefined;

	return entry;
}

/** mergedWith: the user's entry wins for the fields it names, its rules appended,
 * @param {LanguageEntry} base the entry the predefined configuration produced
 * @param {LanguageEntry | undefined} userEntry the user's own entry, when it matched
 * @returns {LanguageEntry} the entry with the user's fields on top of the base one */
function mergedWith(base: LanguageEntry, userEntry: LanguageEntry | undefined): LanguageEntry {
	if (!userEntry) return base;
	const overrides: Partial<LanguageEntry> = {};
	for (const key of Object.keys(userEntry) as (keyof LanguageEntry)[]) {
		if (userEntry[key] !== undefined) Object.assign(overrides, { [key]: userEntry[key] });
	}

	return {
		...base,
		...overrides,
		substitutions: [...(base.substitutions ?? []), ...(userEntry.substitutions ?? [])],
		excludedScopes: [...(base.excludedScopes ?? []), ...(userEntry.excludedScopes ?? [])],
	};
}

/** getPredefinedEntry: the predefined entry with every unset field defaulted and the
 * @param {TextDocument} doc the document the entry has to serve
 * @param {LanguageEntry | undefined} userEntry the user's own entry, when it matched
 * @param {LanguageEntryContext} ctx the settings the defaults come from
 * @param {LanguageMatcher} matchLanguage the ide's own language matcher
 * @returns {LanguageEntry | undefined} the merged entry, or undefined when no predefined config fits */
function getPredefinedEntry(
	doc: TextDocument,
	userEntry: LanguageEntry | undefined,
	ctx: LanguageEntryContext,
	matchLanguage: LanguageMatcher,
): LanguageEntry | undefined {
	const predefinedEntry = resolveSelectedPredefinedEntry(doc, ctx, matchLanguage);
	if (!predefinedEntry) return undefined;
	const base: LanguageEntry = JSON.parse(JSON.stringify(predefinedEntry)); // deep clone
	base.revealOn ??= ctx.revealOn;
	base.adjustCursorMovement ??= ctx.adjustCursorMovement;
	base.prettyCursor ??= ctx.prettyCursor;
	base.combineIdenticalScopes ??= true;

	return mergedWith(base, userEntry);
}

/** getAdditionalOnlyEntry: an entry built from the programmatic rules alone, so an
 * @param {TextDocument} doc the document the entry has to serve
 * @param {LanguageEntryContext} ctx the registered per-language substitutions
 * @param {LanguageMatcher} matchLanguage the ide's own language matcher
 * @returns {LanguageEntry | undefined} the entry, or undefined when nothing was registered */
function getAdditionalOnlyEntry(doc: TextDocument, ctx: LanguageEntryContext, matchLanguage: LanguageMatcher): LanguageEntry | undefined {
	if (ctx.additionalSubstitutions.size === 0) return undefined;
	const matches = [...ctx.additionalSubstitutions].filter((language) => matchLanguage(language.language, doc) > 0);
	const substitutions = matches.flatMap((language) => language.substitutions);

	return {
		language: doc.languageId,
		substitutions,
		combineIdenticalScopes: true,
		adjustCursorMovement: ctx.adjustCursorMovement,
		revealOn: ctx.revealOn,
		prettyCursor: ctx.prettyCursor,
	};
}

/** getLanguageEntry: the entry a document is decorated with — the predefined config
 * @param {TextDocument} doc the document the entry is resolved for
 * @param {LanguageEntryContext} ctx the substitutions, predefined configs and defaults
 * @param {LanguageMatcher} matchLanguage the ide's own language matcher
 * @returns {LanguageEntry | undefined} the entry, or undefined when nothing applies */
export function getLanguageEntry(doc: TextDocument, ctx: LanguageEntryContext, matchLanguage: LanguageMatcher): LanguageEntry | undefined {
	const userEntry = findBestUserEntry(doc, ctx, matchLanguage);
	const clonedUser = userEntry ? JSON.parse(JSON.stringify(userEntry)) : undefined;

	return getPredefinedEntry(doc, userEntry, ctx, matchLanguage) ?? clonedUser ?? getAdditionalOnlyEntry(doc, ctx, matchLanguage);
}

/** settingsFromConfiguration: the raw configuration with every default applied, so a
 * @param {RawConfiguration} configuration the settings the ide handed over
 * @returns {Settings} the settings with an explicit value for every field */
export function settingsFromConfiguration(configuration: RawConfiguration): Settings {
	if (!configuration) throw new Error('settingsFromConfiguration requires a configuration object');
	const defaults: Settings = {
		substitutions: [],
		revealOn: 'cursor',
		adjustCursorMovement: false,
		prettyCursor: 'boxed',
		hideTextMethod: 'hack-letterSpacing',
		predefinedConfig: '',
		debug: false,
	};
	// Only the keys the settings declare are read: an ide configuration object also
	// carries its own api (`get`, `has`, `update`), and spreading it copied those into
	// the store. The values are copied as plain JSON because the ide hands them out as
	// proxies, and mobx-state-tree freezes whatever it is given.
	const provided: Partial<Settings> = {};
	for (const key of Object.keys(defaults) as (keyof Settings)[]) {
		const value = (configuration as Record<string, unknown>)[key];
		if (value !== undefined) Object.assign(provided, { [key]: value });
	}

	return JSON.parse(JSON.stringify({ ...defaults, ...provided })) as Settings;
}

/** decorationOptionsFor: the ide render options of one substitution rule, with the
 * @param {string} pretty the text the rule shows instead of the ugly match
 * @param {PrettyStyleProperties} style the decoration the rule asks for, when it asks
 * @returns {DecorationRenderOptions} the options the ide paints the pretty text with */
export function decorationOptionsFor(pretty: string, style?: PrettyStyleProperties): DecorationRenderOptions {
	// The hack that shrinks the ugly text, so only the pretty `after` text is read.
	const hack = 'letter-spacing: normal; visibility: visible;';
	const { color, backgroundColor, border, textDecoration, hackCSS } = style ?? {};
	const parts = [textDecoration, hackCSS].filter((part) => part !== undefined);
	const painted = parts.length > 0 ? parts.join('; ') + ';' : 'none;';

	return {
		rangeBehavior: 'ClosedClosed',
		color,
		backgroundColor,
		border,
		after: { contentText: pretty, textDecoration: hack + painted },
	};
}

/** toGlobalPattern: a user rule's pattern as a global RegExp, or null when it is
 * @param {string | RegExp} ugly the pattern the rule declares
 * @returns {RegExp | null} the global pattern, or null when it is invalid or matches nothing */
function toGlobalPattern(ugly: string | RegExp): RegExp | null {
	let pattern: RegExp;
	try {
		pattern = new RegExp(ugly, 'g');
	} catch {
		console.warn(`Substitution ignored because its regex is invalid: "${ugly}"`);

		return null;
	}
	if (pattern.test('')) {
		console.warn(`Substitution ignored because it matches the empty string: "${ugly}"`);

		return null;
	}

	return pattern;
}

/** compiledRulesOf: the entry's rules compiled for matching, with their scope
 * @param {LanguageEntry} entry the entry whose rules are compiled
 * @param {string} languageId the language the entry was resolved for
 * @returns {CompiledRule[]} the rules with a global pattern and a defaulted scope */
export function compiledRulesOf(entry: LanguageEntry, languageId: string): CompiledRule[] {
	const scope = entry.textMateInitialScope ?? languageId;
	const rules: CompiledRule[] = [];
	for (const subst of entry.substitutions ?? []) {
		const pattern = toGlobalPattern(subst.ugly);
		if (!pattern) continue;
		rules.push({ ugly: pattern, pretty: subst.pretty, scope: subst.scope ?? (scope ? [scope] : undefined), style: subst.style });
	}

	return rules;
}
