import type { TextDocument } from '../host';
import type { LanguageEntry } from './type';
import type { RootStore } from '../store';

/** Rank a language entry against the document (0 = no match). */
export const rankLanguageEntry = (root: RootStore, entry: LanguageEntry, doc: TextDocument): { rank: number; entry: LanguageEntry } => ({
  rank: root.host?.matchLanguage(entry.language, doc) ?? 0,
  entry,
});

/** Descending rank order. */
const compareByRankDesc = (x: { rank: number }, y: { rank: number }): number => (x.rank > y.rank ? -1 : x.rank == y.rank ? 0 : 1);

/** Find the best-matching user-defined language entry for the document. */
export const findBestUserEntry = (root: RootStore, doc: TextDocument): LanguageEntry | undefined => {
  const userRankings = [];
  for (const entry of root.settings.substitutions ?? []) {
    const ranked = rankLanguageEntry(root, entry, doc);
    if (ranked.rank > 0) userRankings.push(ranked);
  }
  userRankings.sort(compareByRankDesc);

  return userRankings.length > 0 ? userRankings[0].entry : undefined;
};
