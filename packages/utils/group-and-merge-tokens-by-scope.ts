import type { IToken } from './vscode-textmate';

import { mergeRanges } from './merge-ranges';

/** Buckets every token range under each of its scopes, merging overlaps. */
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
