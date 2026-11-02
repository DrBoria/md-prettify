import type { ReparseToken } from "./reparse-scopes";

export interface SegmentRange {
	startIndex: number;
	endIndex: number;
}

export interface LineSegmentData {
	range: SegmentRange;
	scopes: Set<string>;
}

const rangeKeyOf = (startIndex: number, endIndex: number): string => `${startIndex}-${endIndex}`;

/** Adds one scope's ranges to the range-key -> scopes map. */
const addRangesToScopeMap = (map: Map<string, Set<string>>, scope: string, ranges: SegmentRange[]): void => {
	for (const range of ranges) {
		const rangeKey = rangeKeyOf(range.startIndex, range.endIndex);
		const scopes = map.get(rangeKey);
		if (scopes) scopes.add(scope);
		else map.set(rangeKey, new Set([scope]));
	}
};

const compareByStartIndex = (a: SegmentRange, b: SegmentRange): number => a.startIndex - b.startIndex;

/** Merges adjacent or overlapping ranges; does not mutate the input. */
const mergeRanges = (ranges: SegmentRange[]): SegmentRange[] => {
	if (ranges.length === 0) return [];
	const sorted = [...ranges].sort(compareByStartIndex);
	const merged: SegmentRange[] = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i];
		const last = merged[merged.length - 1];
		if (current.startIndex <= last.endIndex) {
			last.endIndex = Math.max(last.endIndex, current.endIndex);
		} else {
			merged.push(current);
		}
	}
	return merged;
};

/** Groups tokens by scope and merges each scope's ranges into contiguous spans. */
const groupAndMergeTokensByScope = (tokens: ReparseToken[]): Record<string, SegmentRange[]> => {
	if (tokens.length === 0) return {};
	const scopeMap: Record<string, SegmentRange[]> = {};
	for (const token of tokens) {
		for (const scope of token.scopes) {
			(scopeMap[scope] ??= []).push({ startIndex: token.startIndex, endIndex: token.endIndex });
		}
	}
	for (const scope in scopeMap) {
		scopeMap[scope] = mergeRanges(scopeMap[scope]);
	}
	return scopeMap;
};

/** Collects the set of scopes for each merged range key ("start-end") on the line. */
export const scopeSetByRangeKey = (tokens: ReparseToken[]): Map<string, Set<string>> => {
	const rangeToScopesMap = new Map<string, Set<string>>();
	for (const [scope, ranges] of Object.entries(groupAndMergeTokensByScope(tokens))) {
		addRangesToScopeMap(rangeToScopesMap, scope, ranges);
	}
	return rangeToScopesMap;
};

/** Builds the line's segment map, skipping empty (start >= end) ranges. */
export const segmentMapFromScopes = (
	rangeToScopesMap: Map<string, Set<string>>,
): Map<string, LineSegmentData> => {
	const finalSegmentMap = new Map<string, LineSegmentData>();
	for (const [rangeKey, scopes] of rangeToScopesMap) {
		const [startStr, endStr] = rangeKey.split("-");
		const startIndex = parseInt(startStr, 10);
		const endIndex = parseInt(endStr, 10);
		if (startIndex < endIndex) {
			finalSegmentMap.set(rangeKey, { range: { startIndex, endIndex }, scopes });
		}
	}
	return finalSegmentMap;
};

/** Tokenizes a line into scoped segments. */
export const getLineSegmentsWithScopes = (tokens: ReparseToken[]): Map<string, LineSegmentData> =>
	segmentMapFromScopes(scopeSetByRangeKey(tokens));

/** Checks whether a segment is excluded by the language entry's excluded scopes. */
export const isSegmentExcluded = (
	excludedScopes: Set<string>,
	tokenScopes: Set<string>,
): boolean => {
	if (excludedScopes.size === 0 || tokenScopes.size === 0) return false;
	for (const scope of tokenScopes) {
		for (const excludedPrefix of excludedScopes) {
			if (scope.startsWith(excludedPrefix)) return true;
		}
	}
	return false;
};
