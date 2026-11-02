import type { LanguageEntry, PrettyCursor, Substitution, TextDocument, UglyRevelation } from '@md-prettify/types';

/** Narrow context the pure language-entry functions read from instead of the store. */
export interface LanguageEntryContext {
  substitutions?: LanguageEntry[];
  revealOn?: UglyRevelation;
  adjustCursorMovement?: boolean;
  prettyCursor?: PrettyCursor;
  predefinedConfig?: string;
  predefined: Map<string, LanguageEntry>;
  additionalSubstitutions: Set<LanguageEntry>;
  matchLanguage: (language: string | string[], doc: TextDocument) => number;
  logInfo: (message: string) => void;
}

/** Rank a language entry against the document (0 = no match). */
export const rankLanguageEntry = (entry: LanguageEntry, doc: TextDocument, ctx: LanguageEntryContext): { rank: number; entry: LanguageEntry } => ({
  rank: ctx.matchLanguage(entry.language, doc),
  entry,
});

export const compareByRankDesc = (x: { rank: number }, y: { rank: number }): number => (x.rank > y.rank ? -1 : x.rank == y.rank ? 0 : 1);

/** Find the best-matching user-defined language entry for the document. */
const findBestUserEntry = (doc: TextDocument, ctx: LanguageEntryContext): LanguageEntry | undefined => {
  const userRankings = [];
  for (const entry of ctx.substitutions ?? []) {
    const ranked = rankLanguageEntry(entry, doc, ctx);
    if (ranked.rank > 0) userRankings.push(ranked);
  }
  userRankings.sort(compareByRankDesc);

  return userRankings.length > 0 ? userRankings[0].entry : undefined;
};

/** Return a copy of the entry with defaults filled in (used by settings reload). */
export const applyDefaultsToEntry = (entry: LanguageEntry, ctx: LanguageEntryContext): LanguageEntry => ({
  ...entry,
  revealOn: entry.revealOn ?? ctx.revealOn,
  adjustCursorMovement: entry.adjustCursorMovement ?? ctx.adjustCursorMovement,
  prettyCursor: entry.prettyCursor ?? ctx.prettyCursor,
  combineIdenticalScopes: entry.combineIdenticalScopes ?? true,
});

/** Append `values` to an optional array, treating `undefined` as empty. */
export const appendArray = <T,>(target: T[] | undefined, values: T[]): T[] => [...(target ?? []), ...values];

/** Merge the user entry's settings onto a predefined entry, returning a new entry. */
export const mergeUserEntry = (baseEntry: LanguageEntry, userEntry: LanguageEntry): LanguageEntry => ({
  ...baseEntry,
  substitutions: userEntry.substitutions?.length ? appendArray(baseEntry.substitutions, userEntry.substitutions) : baseEntry.substitutions,
  revealOn: userEntry.revealOn ?? baseEntry.revealOn,
  adjustCursorMovement: userEntry.adjustCursorMovement ?? baseEntry.adjustCursorMovement,
  prettyCursor: userEntry.prettyCursor ?? baseEntry.prettyCursor,
  combineIdenticalScopes: userEntry.combineIdenticalScopes ?? baseEntry.combineIdenticalScopes,
  excludedScopes: userEntry.excludedScopes ? appendArray(baseEntry.excludedScopes, userEntry.excludedScopes) : baseEntry.excludedScopes,
});

/** Resolve the selected predefined configuration entry for the document, if it matches. */
const resolveSelectedPredefinedEntry = (doc: TextDocument, ctx: LanguageEntryContext): LanguageEntry | undefined => {
  const selectedPredefinedName = ctx.predefinedConfig;
  if (!selectedPredefinedName || !ctx.predefined.has(selectedPredefinedName)) return undefined;
  const predefinedEntry = ctx.predefined.get(selectedPredefinedName);
  if (!predefinedEntry || ctx.matchLanguage(predefinedEntry.language, doc) <= 0) return undefined;

  return predefinedEntry;
};

/** Build an entry from the selected predefined configuration, if it matches. */
export const getPredefinedEntry = (doc: TextDocument, userEntry: LanguageEntry | undefined, ctx: LanguageEntryContext): LanguageEntry | undefined => {
  const predefinedEntry = resolveSelectedPredefinedEntry(doc, ctx);
  if (!predefinedEntry) return undefined;
  let finalEntry = applyDefaultsToEntry(JSON.parse(JSON.stringify(predefinedEntry)), ctx); // deep clone
  if (userEntry) finalEntry = mergeUserEntry(finalEntry, userEntry);

  return finalEntry;
};

/** Collect the substitutions matching the document from the registered additional entries. */
const collectAdditionalSubstitutions = (doc: TextDocument, ctx: LanguageEntryContext): Substitution[] => {
  const subs: Substitution[] = [];
  for (const language of ctx.additionalSubstitutions) {
    if (ctx.matchLanguage(language.language, doc) > 0) {
      subs.push(...language.substitutions);
    }
  }

  return subs;
};

/** Build an entry from programmatically registered substitutions alone. */
const getAdditionalOnlyEntry = (doc: TextDocument, ctx: LanguageEntryContext): LanguageEntry | undefined => {
  if (ctx.additionalSubstitutions.size === 0) return undefined;
  const additionalOnlyEntry: LanguageEntry = {
    language: doc.languageId,
    substitutions: collectAdditionalSubstitutions(doc, ctx),
    combineIdenticalScopes: true,
    adjustCursorMovement: ctx.adjustCursorMovement,
    revealOn: ctx.revealOn,
    prettyCursor: ctx.prettyCursor,
  };

  return additionalOnlyEntry;
};

/** Find the best-matching language entry for the document, merging predefined
 * and user configurations if necessary. */
export const getLanguageEntry = (doc: TextDocument, ctx: LanguageEntryContext): LanguageEntry | undefined => {
  // 1. Best matching user-defined language entry
  const userEntry = findBestUserEntry(doc, ctx);

  // 2. A selected predefined configuration, if it matches this document
  let finalEntry = getPredefinedEntry(doc, userEntry, ctx);

  // 3. Fall back to the user entry alone
  if (!finalEntry && userEntry) finalEntry = JSON.parse(JSON.stringify(userEntry));

  // 4. If only registered (programmatic) substitutions apply, build an entry
  if (!finalEntry) finalEntry = getAdditionalOnlyEntry(doc, ctx);

  if (!finalEntry) ctx.logInfo(`No configuration found for ${doc.languageId} after all checks.`);

  return finalEntry;
};

/** The context the entry helpers fall back to when only defaults are involved. */
export const DEFAULT_LANGUAGE_ENTRY_CONTEXT: LanguageEntryContext = {
  predefined: new Map<string, LanguageEntry>(),
  additionalSubstitutions: new Set<LanguageEntry>(),
  matchLanguage: () => 0,
  logInfo: () => {},
};

/** The store state the language-entry helpers read, built from the root store. */
export const languageEntryContextFrom = (root: {
	settings: Partial<Pick<LanguageEntryContext, 'substitutions' | 'revealOn' | 'adjustCursorMovement' | 'prettyCursor' | 'predefinedConfig'>>;
	predefined: LanguageEntryContext['predefined'];
	additionalSubstitutions: LanguageEntryContext['additionalSubstitutions'];
	host: { matchLanguage: (language: string | string[], doc: TextDocument) => number } | undefined;
}): LanguageEntryContext => ({
	substitutions: root.settings.substitutions,
	revealOn: root.settings.revealOn,
	adjustCursorMovement: root.settings.adjustCursorMovement,
	prettyCursor: root.settings.prettyCursor,
	predefinedConfig: root.settings.predefinedConfig,
	predefined: root.predefined,
	additionalSubstitutions: root.additionalSubstitutions,
	matchLanguage: (language, doc) => root.host?.matchLanguage(language, doc) ?? 0,
	logInfo: console.info,
});
