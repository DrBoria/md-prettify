import type { IToken } from '../host';
import type { LineSegmentData, DocumentStore } from '../document/type';
import { groupAndMergeTokensByScope } from '../grammar/tokens';

/** Collects the set of scopes for each merged range key ("start-end") on the line. */
export const scopeSetByRangeKey = (
  line: string,
  tokens: IToken[],
): Map<string, Set<string>> => {
  const rangeToScopesMap = new Map<string, Set<string>>();

  for (const [scope, ranges] of Object.entries(groupAndMergeTokensByScope(tokens))) {
    for (const range of ranges) {
      const rangeKey = `${range.startIndex}-${range.endIndex}`;
      const existing = rangeToScopesMap.get(rangeKey);
      if (existing) {
        existing.add(scope);
      } else {
        rangeToScopesMap.set(rangeKey, new Set([scope]));
      }
    }
  }

  return rangeToScopesMap;
};

/** Parses a range key ("start-end") into the segment range. */
export const segmentFromKey = (key: string, scopes: Set<string>): LineSegmentData => {
  const [startStr, endStr] = key.split('-');
  return { range: { startIndex: parseInt(startStr, 10), endIndex: parseInt(endStr, 10) }, scopes };
};

/** Builds the line's segment map, skipping empty (start >= end) ranges. */
export const segmentMapFromScopes = (
  rangeToScopesMap: Map<string, Set<string>>,
): Map<string, LineSegmentData> => {
  const finalSegmentMap = new Map<string, LineSegmentData>();

  for (const [rangeKey, scopes] of rangeToScopesMap) {
    const [startStr, endStr] = rangeKey.split('-');
    const startIndex = parseInt(startStr, 10);
    const endIndex = parseInt(endStr, 10);
    if (startIndex < endIndex) {
      finalSegmentMap.set(rangeKey, { range: { startIndex, endIndex }, scopes });
    }
  }

  return finalSegmentMap;
};

/** Logs every segment of the line to the debug output channel. */
export const logLineSegments = (
  state: DocumentStore,
  lineIndex: number,
  line: string,
  lineSegments: Map<string, LineSegmentData>,
): void => {
  if (!state.debug || !state.outputChannel) return;
  state.outputChannel.appendLine(`--- Line ${lineIndex + 1} ---${lineSegments.size === 0 ? ' No segments found.' : ''}`);
  for (const segmentData of lineSegments.values()) {
    const segmentText = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
    state.outputChannel.appendLine(` Segment [${segmentData.range.startIndex}-${segmentData.range.endIndex}]: '${segmentText}', Scopes: [${[...segmentData.scopes].join(', ')}]`);
  }
};

/** Logs a segment excluded by the language entry to the debug output channel. */
export const logExcludedSegment = (
  state: DocumentStore,
  line: string,
  segmentData: LineSegmentData,
): void => {
  if (!state.debug || !state.outputChannel) return;
  const segmentText = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
  state.outputChannel.appendLine(`  -> Segment [${segmentData.range.startIndex}-${segmentData.range.endIndex}] ('${segmentText}') excluded by language entry due to scopes: [${[...segmentData.scopes].join(', ')}]`);
};

/** Checks whether a segment is excluded by the language entry's excluded scopes. */
export const isSegmentExcluded = (
  state: DocumentStore,
  tokenScopes: Set<string>,
): boolean => {
  if (state.excludedScopes.size === 0 || tokenScopes.size === 0) return false;
  for (const scope of tokenScopes) {
    for (const excludedPrefix of state.excludedScopes) {
      if (scope.startsWith(excludedPrefix)) return true;
    }
  }
  return false;
};
