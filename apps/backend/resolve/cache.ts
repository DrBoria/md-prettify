import type { Range } from '../host';
import { rangeIntersection, rangeContains, rangeIsEqual } from '../host';
import { mapSet } from '../utils/range';
import * as textUtil from '../utils/text-deltas';
import * as decorations from './ranges';
import type { PrettySubstitution, DecorationKeyParams, DecorationCacheEntry } from '../document/type';
import type { DocumentStore } from '../document/type';
import { indexInsert, indexRemove, overlapCandidates, rangeKey, keyMapRemove } from './range-index';

/**
 * Generates a unique string key for caching decorations based on substitution parameters.
 */
export const getDecorationCacheKey = (params: DecorationKeyParams): string => {
  const scopeStr = Array.isArray(params.scope) ? [...params.scope].sort().join(",") : params.scope || '';
  const styleStr = params.style ? JSON.stringify(Object.entries(params.style).sort()) : '';
  const uglyStr = params.ugly instanceof RegExp ? `${params.ugly.source}|${params.ugly.flags}` : params.ugly;
  // Using a separator unlikely to appear in the strings themselves
  return `${uglyStr}:::${params.pretty}:::${scopeStr}:::${styleStr}`;
};

/** Helper to check if scope array has a priority rule (ends with !) */
export const hasPriorityScopes = (scopeArray?: string | string[]): boolean => {
  if (!scopeArray) return false;

  const scopes = Array.isArray(scopeArray) ? scopeArray : [scopeArray];
  for (const scope of scopes) {
    if (typeof scope === 'string' && scope.endsWith('!')) {
      return true;
    }
  }
  return false;
};

/** Helper to get the priority level of a cache key (based on scopes) */
export const getCacheKeyPriority = (state: DocumentStore, cacheKey: string): number => {
  const cacheEntry = state.decorationCache.get(cacheKey);

  // If we already determined the priority for this key, use it
  if (cacheEntry?.priority !== undefined) {
    return cacheEntry.priority;
  }

  // For now, we just have two priority levels:
  // 2 = rule with ! at the end of scope
  // 1 = normal rule
  let foundPriority = 1; // Normal priority by default

  // Find the matching rule and check its priority
  for (const configData of state.prettySubstitutions) {
    const key = getDecorationCacheKey(configData);
    if (key === cacheKey) {
      // Check for a scope ending with !
      if (hasPriorityScopes(configData.scope)) {
        foundPriority = 2; // High priority
      }
      break; // Found the rule, stop searching
    }
  }

  // Store the found priority in the cache for later use
  if (cacheEntry) {
    cacheEntry.priority = foundPriority;
  }

  return foundPriority;
};

/** Helper function to shift ranges in a Set */
export const shiftRangeDeltaForSet = (set: Set<Range>, delta: textUtil.RangeDelta): Set<Range> =>
  mapSet(set, (range) => textUtil.rangeTranslate(range, delta));

/**
 * Compares one existing overlapping range against the new one by priority and
 * containment. Returns 'dominated' when the new range must not be added.
 */
const overlapVerdict = (
  existingRange: Range,
  newRange: Range,
  existingRulePriority: number,
  newRulePriority: number,
): 'dominated' | 'remove' | 'keep' => {
  if (rangeContains(existingRange, newRange) && !rangeIsEqual(existingRange, newRange)) {
    return newRulePriority > existingRulePriority ? 'remove' : 'dominated';
  }
  if (rangeContains(newRange, existingRange)) {
    return newRulePriority >= existingRulePriority ? 'remove' : 'keep';
  }
  if (existingRulePriority > newRulePriority) return 'dominated';
  if (newRulePriority > existingRulePriority) return 'remove';
  return 'keep';
};

/** Collects the existing ranges the new range dominates, or null when dominated itself. */
const collectDominatedRanges = (state: DocumentStore, newRange: Range, newCacheKey: string): Set<Range> | null => {
  const newRulePriority = getCacheKeyPriority(state, newCacheKey);
  const rangesToRemove = new Set<Range>();
  for (const existingRange of overlapCandidates(state.lineIndex, state.hiddeDecorationsRanges, newRange)) {
    if (!state.hiddeDecorationsRanges.has(existingRange)) continue;
    if (!rangeIntersection(existingRange, newRange)) continue;
    const existingCacheKey = state.rangeKeyToCacheKey.get(rangeKey(existingRange)) || '';
    const existingRulePriority = getCacheKeyPriority(state, existingCacheKey);
    const verdict = overlapVerdict(existingRange, newRange, existingRulePriority, newRulePriority);
    if (verdict === 'dominated') return null;
    if (verdict === 'remove') rangesToRemove.add(existingRange);
  }
  return rangesToRemove;
};

/** Removes dominated ranges from the active set, derived indexes, and cache entries. */
const removeDominatedRanges = (state: DocumentStore, rangesToRemove: Set<Range>): void => {
  for (const r of rangesToRemove) {
    state.hiddeDecorationsRanges.delete(r);
    indexRemove(state.lineIndex, r);
    keyMapRemove(state.rangeKeyToCacheKey, [r]);
  }
  for (const entry of state.decorationCache.values()) {
    for (const r of rangesToRemove) {
      entry.ranges.delete(r);
    }
  }
};

/** Finds the substitution whose cache key matches, if any. */
const findSubstitutionByKey = (state: DocumentStore, cacheKey: string): PrettySubstitution | undefined => {
  for (const sub of state.prettySubstitutions) {
    if (getDecorationCacheKey(sub) === cacheKey) return sub;
  }
  return undefined;
};

/** Returns the cache entry for the key, creating a placeholder entry when missing. */
const getOrCreateCacheEntry = (state: DocumentStore, cacheKey: string): DecorationCacheEntry | undefined => {
  const existing = state.decorationCache.get(cacheKey);
  if (existing) return existing;
  console.warn(`Cache entry not found for key ${cacheKey} when adding range. Creating placeholder.`);
  const configData = findSubstitutionByKey(state, cacheKey);
  if (!configData || !configData.pretty) {
    console.error(`Could not create cache entry for ${cacheKey}. Range not added to cache.`);
    return undefined;
  }
  const newDecoration = decorations.makePrettyDecorationLetterSpacingHack(state.host, {
    ugly: `${configData.ugly}`,
    pretty: configData.pretty,
    scope: configData.scope,
    style: configData.style,
  });
  const entry: DecorationCacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: configData.pretty };
  state.decorationCache.set(cacheKey, entry);
  return entry;
};

/**
 * Adds a new range for a pretty substitution, handling overlaps by priority:
 * a higher-priority range replaces the one it contains; a lower-priority range
 * is ignored when contained. Partial overlaps are resolved by priority too.
 *
 * Overlap candidates come from the derived line index (`state.lineIndex`), so
 * this is O(k) in ranges on the overlapping lines instead of O(M) in all
 * active ranges; the owning cache key is read from `state.rangeKeyToCacheKey`.
 */
export const addOrUpdatePrettyRange = (state: DocumentStore, newRange: Range, newCacheKey: string): void => {
  const rangesToRemove = collectDominatedRanges(state, newRange, newCacheKey);
  if (rangesToRemove === null) return; // Do not add this new range

  removeDominatedRanges(state, rangesToRemove);

  // Add the new range (it wasn't dominated)
  state.hiddeDecorationsRanges.add(newRange);
  indexInsert(state.lineIndex, newRange);

  // Add the new range to its corresponding cache entry, creating it if missing
  const cacheEntry = getOrCreateCacheEntry(state, newCacheKey);
  if (!cacheEntry) return; // Cannot add to cache if entry cannot be ensured

  cacheEntry.ranges.add(newRange);
  // Record the owning cache key only once the range is in the cache entry,
  // mirroring the old map (which was rebuilt from cache entries ∩ active set).
  state.rangeKeyToCacheKey.set(rangeKey(newRange), newCacheKey);
};
