import type { TextDocument } from '../host';
import type { LanguageEntry, Substitution } from './configuration';
import { logInfo } from './logger';
import { requireRootStore } from '../store';

/** Substitutions registered programmatically via the public API. */
export const getAdditionalSubstitutions = (): Set<LanguageEntry> => requireRootStore().additionalSubstitutions;

/** Rank a language entry against the document (0 = no match). */
const rankLanguageEntry = (entry: LanguageEntry, doc: TextDocument): { rank: number; entry: LanguageEntry } => ({
  rank: requireRootStore().host?.matchLanguage(entry.language, doc) ?? 0,
  entry,
});

const compareByRankDesc = (x: { rank: number }, y: { rank: number }): number => (x.rank > y.rank ? -1 : x.rank == y.rank ? 0 : 1);

/** Find the best-matching user-defined language entry for the document. */
const findBestUserEntry = (doc: TextDocument): LanguageEntry | undefined => {
  const userRankings = [];
  for (const entry of requireRootStore().settings.substitutions ?? []) {
    const ranked = rankLanguageEntry(entry, doc);
    if (ranked.rank > 0) userRankings.push(ranked);
  }
  userRankings.sort(compareByRankDesc);

  return userRankings.length > 0 ? userRankings[0].entry : undefined;
};

/** Return a copy of the entry with defaults filled in (used by settings reload). */
export const applyDefaultsToEntry = (entry: LanguageEntry): LanguageEntry => {
  const settings = requireRootStore().settings;

  return {
    ...entry,
    revealOn: entry.revealOn ?? settings.revealOn,
    adjustCursorMovement: entry.adjustCursorMovement ?? settings.adjustCursorMovement,
    prettyCursor: entry.prettyCursor ?? settings.prettyCursor,
    combineIdenticalScopes: entry.combineIdenticalScopes ?? true,
  };
};

/** Append `values` to an optional array, treating `undefined` as empty. */
const appendArray = <T,>(target: T[] | undefined, values: T[]): T[] => [...(target ?? []), ...values];

/** Merge the user entry's settings onto a predefined entry, returning a new entry. */
const mergeUserEntry = (baseEntry: LanguageEntry, userEntry: LanguageEntry): LanguageEntry => ({
  ...baseEntry,
  substitutions: userEntry.substitutions?.length ? appendArray(baseEntry.substitutions, userEntry.substitutions) : baseEntry.substitutions,
  revealOn: userEntry.revealOn ?? baseEntry.revealOn,
  adjustCursorMovement: userEntry.adjustCursorMovement ?? baseEntry.adjustCursorMovement,
  prettyCursor: userEntry.prettyCursor ?? baseEntry.prettyCursor,
  combineIdenticalScopes: userEntry.combineIdenticalScopes ?? baseEntry.combineIdenticalScopes,
  excludedScopes: userEntry.excludedScopes ? appendArray(baseEntry.excludedScopes, userEntry.excludedScopes) : baseEntry.excludedScopes,
});

/** Resolve the selected predefined configuration entry for the document, if it matches. */
const resolveSelectedPredefinedEntry = (doc: TextDocument): LanguageEntry | undefined => {
  const selectedPredefinedName = requireRootStore().settings.predefinedConfig;
  if (!selectedPredefinedName || !requireRootStore().predefined.has(selectedPredefinedName)) return undefined;
  const predefinedEntry = requireRootStore().predefined.get(selectedPredefinedName);
  if (!predefinedEntry || (requireRootStore().host?.matchLanguage(predefinedEntry.language, doc) ?? 0) <= 0) return undefined;

  return predefinedEntry;
};

/** Build an entry from the selected predefined configuration, if it matches. */
const getPredefinedEntry = (doc: TextDocument, userEntry: LanguageEntry | undefined): LanguageEntry | undefined => {
  const predefinedEntry = resolveSelectedPredefinedEntry(doc);
  if (!predefinedEntry) return undefined;
  let finalEntry = applyDefaultsToEntry(JSON.parse(JSON.stringify(predefinedEntry))); // deep clone
  if (userEntry) finalEntry = mergeUserEntry(finalEntry, userEntry);

  return finalEntry;
};

/** Collect the substitutions matching the document from the registered additional entries. */
const collectAdditionalSubstitutions = (doc: TextDocument): Substitution[] => {
  const subs: Substitution[] = [];
  for (const language of getAdditionalSubstitutions()) {
    if ((requireRootStore().host?.matchLanguage(language.language, doc) ?? 0) > 0) {
      subs.push(...language.substitutions);
    }
  }

  return subs;
};

/** Build an entry from programmatically registered substitutions alone. */
const getAdditionalOnlyEntry = (doc: TextDocument): LanguageEntry | undefined => {
  if (getAdditionalSubstitutions().size === 0) return undefined;
  const settings = requireRootStore().settings;
  const additionalOnlyEntry: LanguageEntry = {
    language: doc.languageId,
    substitutions: collectAdditionalSubstitutions(doc),
    combineIdenticalScopes: true,
    adjustCursorMovement: settings.adjustCursorMovement,
    revealOn: settings.revealOn,
    prettyCursor: settings.prettyCursor,
  };

  return additionalOnlyEntry;
};

/** Find the best-matching language entry for the document, merging predefined
 * and user configurations if necessary. */
export function getLanguageEntry(doc: TextDocument): LanguageEntry | undefined {
  // 1. Best matching user-defined language entry
  const userEntry = findBestUserEntry(doc);

  // 2. A selected predefined configuration, if it matches this document
  let finalEntry = getPredefinedEntry(doc, userEntry);

  // 3. Fall back to the user entry alone
  if (!finalEntry && userEntry) finalEntry = JSON.parse(JSON.stringify(userEntry));

  // 4. If only registered (programmatic) substitutions apply, build an entry
  if (!finalEntry) finalEntry = getAdditionalOnlyEntry(doc);

  if (!finalEntry) logInfo(`No configuration found for ${doc.languageId} after all checks.`);

  return finalEntry;
}
