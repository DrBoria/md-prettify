/**
 * Dynamic substitution handling: the pretty text contains `$N` placeholders
 * ($0, $1, ...) that map onto segments of the original matched text.
 *
 * `handlePrettiesWithDynamicParams` is the entry point. It short-circuits the
 * two special cases (whole-match `$0` and single-capture-group replacement)
 * and otherwise falls back to `handlePartByPart` (see dynamic-part-by-part.ts).
 */

import { positionFrom, rangeFromPositions } from '../host';
import type { PrettySubstitution, DecorationKeyParams } from '../document/type';
import type { DocumentStore } from '../document/type';
import { hasPriorityScopes } from '../resolve/cache';
import { addResolvedRange } from '../resolve/ranges';
import { handlePartByPart } from './dynamic-part-by-part';
import { logDebug } from './tokenize';

/**
 * Special case: the pretty text contains only $0 and static text.
 * The whole match is replaced by the resolved text.
 * @returns true when the match was handled and the caller should stop.
 */
const handleDollarZeroOnly = (
  state: DocumentStore,
  lineIdx: number,
  matchStart: number,
  matchEnd: number,
  configData: PrettySubstitution,
  match: RegExpMatchArray,
  rulePriority: number,
): boolean => {
  const containsOtherPlaceholders = /\$(?!0\b)\d+/.test(configData.pretty);
  if (containsOtherPlaceholders || !configData.pretty.includes('$0')) return false;

  const uglyRange = rangeFromPositions(positionFrom(lineIdx, matchStart), positionFrom(lineIdx, matchEnd));
  // Calculate the actual pretty text by substituting $0
  const resolvedPretty = configData.pretty.replace('$0', match[0]);

  // Add debug logging specifically for this $0 case
  logDebug(state, ` Part '$0' corresponds to original substring '${match[0]}' [${matchStart}-${matchEnd}]`);

  // Use a cache key specific to the *resolved* text to ensure unique decorations
  const keyParams: DecorationKeyParams = {
    ugly: configData.ugly, // Keep original ugly for context
    pretty: resolvedPretty, // Use RESOLVED pretty text for key
    scope: configData.scope,
    style: configData.style,
  };
  addResolvedRange(state, keyParams, match[0], resolvedPretty, rulePriority, uglyRange);
  return true; // Handled directly, skip the part-by-part logic
};

/**
 * Special case: the pretty text is a single capture-group placeholder (e.g. '$1').
 * The whole match is replaced by that captured group.
 * @returns true when the match was handled and the caller should stop.
 */
const handleWholeMatchCapture = (
  state: DocumentStore,
  lineIdx: number,
  matchStart: number,
  matchEnd: number,
  configData: PrettySubstitution,
  match: RegExpMatchArray,
  rulePriority: number,
): boolean => {
  // This handles cases like /\${([^}]+)}/g with pretty: '$1'
  // Where we need to replace the entire matched text with just the captured group
  if (!(configData.pretty.match(/^\$\d+$/) && match.length > 1)) return false;

  // If pretty is just a single placeholder (like '$1')
  const paramIndex = parseInt(configData.pretty.substring(1), 10);
  if (!(paramIndex < match.length && match[paramIndex] !== undefined)) return false;

  const uglyRange = rangeFromPositions(positionFrom(lineIdx, matchStart), positionFrom(lineIdx, matchEnd));
  const capturedGroup = match[paramIndex];

  // Add debug logging for this specific case
  logDebug(state, `Entire match '${match[0]}' being replaced with captured group ${paramIndex}: '${capturedGroup}' [${matchStart}-${matchEnd}]`);

  // Use a cache key specific to the capture group text
  const keyParams: DecorationKeyParams = {
    ugly: configData.ugly,
    pretty: capturedGroup, // Use captured text as the pretty version
    scope: configData.scope,
    style: configData.style,
  };
  addResolvedRange(state, keyParams, match[0], capturedGroup, rulePriority, uglyRange);
  return true; // Handled directly, skip the part-by-part logic
};

/**
 * Handles a single match of a rule whose pretty text contains dynamic parameters
 * ($0, $1, ...). Avoids re-processing the same match on the same line.
 */
export const handlePrettiesWithDynamicParams = (
  state: DocumentStore,
  lineIdx: number,
  matchStart: number,
  matchEnd: number,
  configData: PrettySubstitution,
  match: RegExpMatchArray,
  loggedDollarZeroRangesThisLine: Set<string>,
): void => {
  // Determine whether this is a high-priority rule (based on '!' in scopes)
  const isPriorityRule = hasPriorityScopes(configData.scope);
  const rulePriority = isPriorityRule ? 2 : 1;

  // Unique identifier for the match to avoid processing it twice
  const matchId = `${matchStart}:${matchEnd}:${configData.ugly.source}`;
  if (loggedDollarZeroRangesThisLine.has(matchId)) {
    return; // Skip, we already processed this match
  }
  loggedDollarZeroRangesThisLine.add(matchId);

  // --- Special Case: Handle pretties containing only $0 and static text ---
  if (handleDollarZeroOnly(state, lineIdx, matchStart, matchEnd, configData, match, rulePriority)) return;
  // --- End Special Case ---

  // --- Special Case: Handle entire match replacement with capture groups ---
  if (handleWholeMatchCapture(state, lineIdx, matchStart, matchEnd, configData, match, rulePriority)) return;
  // --- End Special Case ---

  // Original logic for handling complex substitutions with $1, $2, etc.
  handlePartByPart(state, lineIdx, matchStart, configData, match, rulePriority);
};
