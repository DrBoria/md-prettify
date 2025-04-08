import type { IToken } from '../host';

/** True when two token scope lists are element-wise identical. */
const sameScopes = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let idx = 0; idx < a.length; idx++) {
    if (a[idx] !== b[idx]) return false;
  }
  return true;
};

export const combineIdenticalTokenScopes = (tokens: IToken[]): IToken[] => {
  if (!tokens || tokens.length === 0)
    return [];
  const result = [tokens[0]];
  let prevToken = tokens[0];
  for (let idx = 1; idx < tokens.length; ++idx) {
    const token = tokens[idx];
    if (prevToken.endIndex === token.startIndex && sameScopes(prevToken.scopes, token.scopes)) {
      // Note: create a copy of the object so the source tokens are unmodified
      result[result.length - 1] = { startIndex: prevToken.startIndex, endIndex: token.endIndex, scopes: prevToken.scopes };
      prevToken = result[result.length - 1];
    } else {
      result.push(token);
      prevToken = token;
    }
  }
  return result;
};

export const groupAndMergeTokensByScope = (
  tokens: IToken[],
): Record<string, { startIndex: number; endIndex: number }[]> => {
  if (!tokens || tokens.length === 0) {
    return {};
  }

  // Step 1: Collect ranges per scope
  const scopeMap: Record<string, { startIndex: number; endIndex: number }[]> = {};
  for (const token of tokens) {
    for (const scope of token.scopes) {
      if (!scopeMap[scope]) {
        scopeMap[scope] = [];
      }
      scopeMap[scope].push({ startIndex: token.startIndex, endIndex: token.endIndex });
    }
  }

  // Step 2: Merge the ranges for each scope
  for (const scope in scopeMap) {
    scopeMap[scope] = mergeRanges(scopeMap[scope]);
  }

  return scopeMap;
};

const compareByStartIndex = (a: { startIndex: number }, b: { startIndex: number }): number => a.startIndex - b.startIndex;

// Merges adjacent or overlapping ranges
const mergeRanges = (ranges: { startIndex: number; endIndex: number }[]): { startIndex: number; endIndex: number }[] => {
  if (ranges.length === 0) return [];

  // Sort by startIndex
  ranges.sort(compareByStartIndex);
  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];

    // If the current range touches or overlaps the last one, merge them
    if (current.startIndex <= last.endIndex) {
      last.endIndex = Math.max(last.endIndex, current.endIndex);
    } else {
      merged.push(current);
    }
  }

  return merged;
};
