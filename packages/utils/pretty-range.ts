import type { Range, DecorationRenderOptions, TextEditorDecorationType, PrettyStyle } from "@md-prettify/types";
import { rangeContains, rangeIsEqual, rangeIntersection } from "./range";
import { getDecorationCacheKey } from "./decoration-cache";
import { hasHighPriorityScope } from "./reparse-rules";
import { rangeKey, overlapCandidates, indexInsert, indexRemove, keyMapRemove } from "./range-index";
import { makePrettyDecorationLetterSpacingHack } from "./pretty-decorations";

/** Compares one existing overlapping range against the new one by priority and containment. */
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

/** Helper to get the priority level of a cache key (based on scopes). */
export const getCacheKeyPriority = (
	state: {
		decorationCache: Map<string, { priority?: number }>;
		prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }>;
	},
	cacheKey: string,
): number => {
	const cacheEntry = state.decorationCache.get(cacheKey);
	if (cacheEntry?.priority !== undefined) return cacheEntry.priority;

	let foundPriority = 1;
	for (const configData of state.prettySubstitutions) {
		const key = getDecorationCacheKey(configData);
		if (key === cacheKey) {
			if (hasHighPriorityScope(configData.scope)) foundPriority = 2;
			break;
		}
	}

	if (cacheEntry) cacheEntry.priority = foundPriority;
	return foundPriority;
};

/** Collects the existing ranges the new range dominates, or null when dominated itself. */
const collectDominatedRanges = (
	state: {
		lineIndex: Map<number, Range[]>;
		hiddeDecorationsRanges: Set<Range>;
		rangeKeyToCacheKey: Map<string, string>;
		decorationCache: Map<string, { priority?: number }>;
		prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }>;
	},
	newRange: Range,
	newCacheKey: string,
): Set<Range> | null => {
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
const removeDominatedRanges = (
	state: {
		hiddeDecorationsRanges: Set<Range>;
		lineIndex: Map<number, Range[]>;
		rangeKeyToCacheKey: Map<string, string>;
		decorationCache: Map<string, { ranges: Set<Range> }>;
	},
	rangesToRemove: Set<Range>,
): void => {
	for (const r of rangesToRemove) {
		state.hiddeDecorationsRanges.delete(r);
		indexRemove(state.lineIndex, r);
		keyMapRemove(state.rangeKeyToCacheKey, [r]);
		for (const entry of state.decorationCache.values()) {
			entry.ranges.delete(r);
		}
	}
};

/** Finds the substitution whose cache key matches, if any. */
const findSubstitutionByKey = (
	state: { prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }> },
	cacheKey: string,
): { ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle } | undefined => {
	for (const sub of state.prettySubstitutions) {
		if (getDecorationCacheKey(sub) === cacheKey) return sub;
	}
	return undefined;
};

/** Returns the cache entry for the key, creating a placeholder entry when missing. */
const getOrCreateCacheEntry = (
	state: {
		decorationCache: Map<string, { decorationType: TextEditorDecorationType; ranges: Set<Range>; pretty: string; priority?: number }>;
		prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }>;
		host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType };
	},
	cacheKey: string,
): { decorationType: TextEditorDecorationType; ranges: Set<Range>; pretty: string; priority?: number } | undefined => {
	const existing = state.decorationCache.get(cacheKey);
	if (existing) return existing;
	console.warn(`Cache entry not found for key ${cacheKey} when adding range. Creating placeholder.`);
	const configData = findSubstitutionByKey(state, cacheKey);
	if (!configData || !configData.pretty) {
		console.error(`Could not create cache entry for ${cacheKey}. Range not added to cache.`);
		return undefined;
	}
	const newDecoration = makePrettyDecorationLetterSpacingHack(state.host, {
		ugly: `${configData.ugly}`,
		pretty: configData.pretty,
		scope: configData.scope,
		style: configData.style,
	});
	const entry = { decorationType: newDecoration, ranges: new Set<Range>(), pretty: configData.pretty };
	state.decorationCache.set(cacheKey, entry);
	return entry;
};

/**
 * Adds a new range for a pretty substitution, handling overlaps by priority.
 */
export const addOrUpdatePrettyRange = (
	state: {
		decorationCache: Map<string, { decorationType: TextEditorDecorationType; ranges: Set<Range>; pretty: string; priority?: number }>;
		hiddeDecorationsRanges: Set<Range>;
		lineIndex: Map<number, Range[]>;
		rangeKeyToCacheKey: Map<string, string>;
		prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }>;
		host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType };
	},
	newRange: Range,
	newCacheKey: string,
): void => {
	const rangesToRemove = collectDominatedRanges(state, newRange, newCacheKey);
	if (rangesToRemove === null) return;

	removeDominatedRanges(state, rangesToRemove);

	state.hiddeDecorationsRanges.add(newRange);
	indexInsert(state.lineIndex, newRange);

	const cacheEntry = getOrCreateCacheEntry(state, newCacheKey);
	if (!cacheEntry) return;

	cacheEntry.ranges.add(newRange);
	state.rangeKeyToCacheKey.set(rangeKey(newRange), newCacheKey);
};

/**
 * Creates the cache entry for a resolved pretty text if missing and adds the
 * range with overlap handling.
 */
export const addResolvedRange = (
	state: {
		decorationCache: Map<string, { decorationType: TextEditorDecorationType; ranges: Set<Range>; pretty: string; priority?: number }>;
		hiddeDecorationsRanges: Set<Range>;
		lineIndex: Map<number, Range[]>;
		rangeKeyToCacheKey: Map<string, string>;
		prettySubstitutions: Iterable<{ ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle }>;
		host: { createDecorationType: (options: DecorationRenderOptions) => TextEditorDecorationType };
	},
	params: { ugly: RegExp | string; pretty: string; scope?: string | string[]; style?: PrettyStyle },
	uglyContext: string,
	resolvedPretty: string,
	rulePriority: number,
	uglyRange: Range,
): void => {
	const key = getDecorationCacheKey(params);
	let cacheEntry = state.decorationCache.get(key);

	if (!cacheEntry) {
		const newDecoration = makePrettyDecorationLetterSpacingHack(state.host, {
			ugly: uglyContext,
			pretty: resolvedPretty,
			scope: params.scope,
			style: params.style,
		});
		cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: resolvedPretty, priority: rulePriority };
		state.decorationCache.set(key, cacheEntry);
	} else if (cacheEntry.priority === undefined) {
		cacheEntry.priority = rulePriority;
	}

	addOrUpdatePrettyRange(state, uglyRange, key);
};
