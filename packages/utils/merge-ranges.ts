import type { IToken } from './vscode-textmate';

import { compareByStartIndex } from './compare-by-start-index';

/** Merges adjacent or overlapping ranges. */
export const mergeRanges = (ranges: { startIndex: number; endIndex: number }[]): { startIndex: number; endIndex: number }[] => {
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
