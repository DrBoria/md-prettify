import type { Range } from '../host';
import { positionFrom, rangeFrom, rangeFromPositions, rangeIsEmpty } from '../host';
import * as decorations from '../resolve/ranges';
import type * as tm from '../grammar/text-mate';
import type { PrettySubstitution, LineSegmentData } from '../document/type';
import type { DocumentStore } from '../document/type';
import { getDecorationCacheKey, hasPriorityScopes, addOrUpdatePrettyRange } from '../resolve/cache';
import { refreshTokensOnLine, getLineSegmentsWithScopes, getScopesForRange, classifyRuleScopes, isScopeApplicable } from './tokenize';
import { handlePrettiesWithDynamicParams } from './dynamic';
import { logLineSegments, logExcludedSegment, isSegmentExcluded } from './segments';

/** Collects the rules of the given priority (high-priority scopes end with !). */
const rulesOfPriority = (rules: Set<PrettySubstitution>, highPriority: boolean): PrettySubstitution[] => {
  const out: PrettySubstitution[] = [];
  for (const rule of rules) {
    if (hasPriorityScopes(rule.scope) === highPriority) out.push(rule);
  }

  return out;
};

/** Splits rules into high-priority (scopes ending with !) and normal, high-priority first. */
const rulesInPriorityOrder = (state: DocumentStore): PrettySubstitution[] => [
  ...rulesOfPriority(state.prettySubstitutions, true),
  ...rulesOfPriority(state.prettySubstitutions, false),
];

/** Handles a static pretty: ensures the cache entry + decoration exist and adds the range. */
const addStaticPrettyRange = (state: DocumentStore, configData: PrettySubstitution, uglyRange: Range): void => {
  const key = getDecorationCacheKey(configData);
  let cacheEntry = state.decorationCache.get(key);
  // High priority (2) if there are scopes ending with !, otherwise normal (1)
  const priority = hasPriorityScopes(configData.scope) ? 2 : 1;

  if (!cacheEntry && configData.pretty) {
    const newDecoration = decorations.makePrettyDecorationLetterSpacingHack(state.host, {
      ugly: `${configData.ugly}`, // Use original ugly regex string for context if needed
      pretty: configData.pretty,
      scope: configData.scope,
      style: configData.style,
    });
    cacheEntry = { decorationType: newDecoration, ranges: new Set(), pretty: configData.pretty, priority };
    state.decorationCache.set(key, cacheEntry);
  } else if (cacheEntry && cacheEntry.priority === undefined) {
    cacheEntry.priority = priority;
  }

  // Add the matched range only when there is a pretty version to show
  if (configData.pretty) {
    addOrUpdatePrettyRange(state, uglyRange, key);
  }
};

/** Applies a rule that passed the scope check: re-scans matches and adds each range. */
const applyApplicableRule = (
  state: DocumentStore,
  lineIdx: number,
  configData: PrettySubstitution,
  regexGlobal: RegExp,
  substring: string,
  segmentData: LineSegmentData,
  loggedDollarZeroRangesThisLine: Set<string>,
): void => {
  const hasDynamicParams = /\$\d+/.test(configData.pretty);
  const matchIterator = substring.matchAll(regexGlobal);

  for (const match of matchIterator) {
    if (match.index === undefined || match[0].length === 0) continue;

    const start = segmentData.range.startIndex + match.index;
    const end = start + match[0].length;
    const uglyRange = rangeFromPositions(positionFrom(lineIdx, start), positionFrom(lineIdx, end));
    if (rangeIsEmpty(uglyRange)) continue;

    if (hasDynamicParams) {
      handlePrettiesWithDynamicParams(state, lineIdx, start, end, configData, match, loggedDollarZeroRangesThisLine);
    } else {
      addStaticPrettyRange(state, configData, uglyRange);
    }
  }
};

/** Runs one substitution rule against a segment, adding ranges for applicable matches. */
const processRuleForSegment = (
  state: DocumentStore,
  lineIdx: number,
  line: string,
  tokens: tm.IToken[],
  configData: PrettySubstitution,
  segmentData: LineSegmentData,
  loggedDollarZeroRangesThisLine: Set<string>,
): void => {
  const substring = line.substring(segmentData.range.startIndex, segmentData.range.endIndex);
  const regex = configData.ugly;
  if (!(regex instanceof RegExp)) return; // Should not happen, but safe check
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g'; // matchAll needs 'g'
  const regexGlobal = new RegExp(regex.source, flags);
  const matchIterator = substring.matchAll(regexGlobal);

  for (const match of matchIterator) {
    if (match.index === undefined || match[0].length === 0) continue;

    const startChar = match.index;
    const endChar = startChar + match[0].length;
    const uglyRange = rangeFromPositions(positionFrom(lineIdx, startChar), positionFrom(lineIdx, endChar));
    if (rangeIsEmpty(uglyRange)) continue;

    const matchScopes = getScopesForRange(state, tokens, startChar, endChar);
    const { positiveScopes, negativeScopesByPrefix, highPriorityScopes } = classifyRuleScopes(configData);
    if (!isScopeApplicable(positiveScopes, negativeScopesByPrefix, highPriorityScopes, matchScopes)) continue;

    applyApplicableRule(state, lineIdx, configData, regexGlobal, substring, segmentData, loggedDollarZeroRangesThisLine);
  }
};

/** Processes one line segment: matches all rules against it and adds the resulting ranges. */
const processLineSegment = (
  state: DocumentStore,
  lineIdx: number,
  line: string,
  tokens: tm.IToken[],
  segmentData: LineSegmentData,
  loggedDollarZeroRangesThisLine: Set<string>,
): void => {
  const isExcluded = isSegmentExcluded(state, segmentData.scopes);
  if (isExcluded) {
    logExcludedSegment(state, line, segmentData);
    return; // Skip this segment entirely if excluded by the language entry
  }

  for (const configData of rulesInPriorityOrder(state)) {
    processRuleForSegment(state, lineIdx, line, tokens, configData, segmentData, loggedDollarZeroRangesThisLine);
  }
};

// Fills the empty grammarState lines BEFORE the range (forward from the nearest
// filled line, O(gap)) so the first in-range line tokenizes from the right prevState.
const refreshGrammarStateBefore = (state: DocumentStore, startLine: number): void => {
  if (!state.grammar || startLine <= 0) return;
  let anchor = startLine - 1;
  while (anchor > 0 && !state.grammarState[anchor]) --anchor;
  for (let lineIdx = anchor + 1; lineIdx < startLine; ++lineIdx) {
    refreshTokensOnLine(state, state.document.getLine(lineIdx), lineIdx);
  }
};

/** Tracks the $0 ranges already logged on the current line. */
const loggedDollarZeroRanges = (): Set<string> => new Set<string>();

/** Processes every segment of one line against the rules. */
const processLineSegments = (
  state: DocumentStore,
  lineIdx: number,
  line: string,
  tokens: tm.IToken[],
  lineSegments: Map<string, LineSegmentData>,
  loggedDollarZeroRangesThisLine: Set<string>,
): void => {
  logLineSegments(state, lineIdx, line, lineSegments);

  for (const segmentData of lineSegments.values()) {
    processLineSegment(state, lineIdx, line, tokens, segmentData, loggedDollarZeroRangesThisLine);
  }
};

/** Reparses one line: tokenizes it and processes every segment against the rules. */
const reparseLine = (state: DocumentStore, lineIdx: number): void => {
  const line = state.document.getLine(lineIdx);
  const { tokens } = refreshTokensOnLine(state, line, lineIdx);
  const lineSegments = getLineSegmentsWithScopes(line, tokens);

  processLineSegments(state, lineIdx, line, tokens, lineSegments, loggedDollarZeroRanges());
};

/** Reparses the given range (or the whole document) and updates the decoration ranges. */
export const reparsePretties = (state: DocumentStore, rangeToReparse?: Range) => {
  rangeToReparse = rangeToReparse || rangeFrom(0, 0, state.document.getLineCount(), 0);
  rangeToReparse = state.document.validateRange(rangeToReparse);

  const lineCount = state.document.getLineCount();
  const startLine = rangeToReparse.start.line;
  const endLine = Math.min(rangeToReparse.end.line, lineCount - 1);

  refreshGrammarStateBefore(state, startLine);

  for (let lineIdx = startLine; lineIdx <= endLine; ++lineIdx) {
    reparseLine(state, lineIdx);
  }

  state.changedUglies = true; // Uglies may have changed; precise tracking could live in addOrUpdatePrettyRange.
};
