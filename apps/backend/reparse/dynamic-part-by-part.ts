/**
 * Part-by-part handling of dynamic substitutions.
 *
 * Splits the pretty text on `$N` placeholders and decorates the static parts,
 * mapping each part onto the corresponding segment of the original matched
 * text.
 */

import { positionFrom, rangeFromPositions } from '../host';
import type { DocumentStore } from '../document/type';
import type { PrettySubstitution, DecorationKeyParams } from '../document/type';
import { addResolvedRange } from '../resolve/ranges';
import { logDebug } from './tokenize';

/** Resolves the original-text segment a `$N` placeholder maps to. */
const resolveDynamicPart = (
  match: RegExpMatchArray,
  originalMatchText: string,
  paramIndex: number,
  currentOriginalIndex: number,
  part: string,
): { length: number; nextOriginalIndex: number; log: string } => {
  if (paramIndex >= match.length || match[paramIndex] === undefined) {
    return { length: 0, nextOriginalIndex: currentOriginalIndex, log: `Part '${part}' maps to invalid/unmatched group (Index ${paramIndex})` };
  }
  const groupText = match[paramIndex];
  const groupStartIndex = originalMatchText.indexOf(groupText, currentOriginalIndex);
  if (groupStartIndex === -1) {
    return { length: 0, nextOriginalIndex: currentOriginalIndex, log: `Part '${part}' (group ${paramIndex}) did not find corresponding text starting from index ${currentOriginalIndex}. Original text: "${groupText}"` };
  }
  const groupEndIndex = groupStartIndex + groupText.length;
  return { length: groupText.length, nextOriginalIndex: groupEndIndex, log: `Part '${part}' corresponds to original substring '${groupText}' [${groupStartIndex}-${groupEndIndex}]` };
};

/** Index in the original text where the next placeholder's group text starts, or the end of the match. */
const findNextPlaceholderStart = (
  prettyParts: string[],
  fromIndex: number,
  match: RegExpMatchArray,
  originalMatchText: string,
  currentOriginalIndex: number,
): number => {
  let nextPlaceholderOriginalStart = originalMatchText.length;
  const remainingParts = prettyParts.length - fromIndex;
  for (let j = 0; j < remainingParts; j++) {
    const partIndex = fromIndex + j;
    const nextPlaceholderMatch = prettyParts[partIndex].match(/^\$(\d+)$/);
    if (!nextPlaceholderMatch) continue;
    const nextParamIndex = parseInt(nextPlaceholderMatch[1], 10);
    if (nextParamIndex >= match.length || match[nextParamIndex] === undefined) continue;
    const nextGroupStartIndex = originalMatchText.indexOf(match[nextParamIndex], currentOriginalIndex);
    if (nextGroupStartIndex !== -1) {
      nextPlaceholderOriginalStart = nextGroupStartIndex;
      break;
    }
  }
  return nextPlaceholderOriginalStart;
};

/**
 * Part-by-part handling of complex substitutions with $1, $2, etc.
 * Decorations are created for the static parts, mapped to the corresponding
 * segments of the original matched text.
 */
export const handlePartByPart = (
  state: DocumentStore,
  lineIdx: number,
  matchOffset: number,
  configData: PrettySubstitution,
  match: RegExpMatchArray,
  rulePriority: number,
): void => {
  const prettyParts = prettyPartsOf(configData);
  if (prettyParts.length === 0) return;

  processPrettyParts(state, lineIdx, matchOffset, configData, match, rulePriority, prettyParts);
};

/** Splits the pretty text on `$N` placeholders. */
const prettyPartsOf = (configData: PrettySubstitution): string[] => configData.pretty.split(/(\$\d+)/g);

/** Walks the pretty parts, decorating static parts and advancing through the original match. */
const processPrettyParts = (
  state: DocumentStore,
  lineIdx: number,
  matchOffset: number,
  configData: PrettySubstitution,
  match: RegExpMatchArray,
  rulePriority: number,
  prettyParts: string[],
): void => {
  const originalMatchText = match[0];
  const processedParts = new Set<string>();
  let currentOriginalIndex = 0;

  for (let i = 0; i < prettyParts.length; i++) {
    const part = prettyParts[i];
    if (part === '') continue;

    const partKey = `${i}:${part}:${currentOriginalIndex}`;
    if (processedParts.has(partKey)) continue;
    processedParts.add(partKey);

    const isDynamicPlaceholder = part.match(/^\$(\d+)$/);

    if (isDynamicPlaceholder) {
      const paramIndex = parseInt(isDynamicPlaceholder[1], 10);
      const resolved = resolveDynamicPart(match, originalMatchText, paramIndex, currentOriginalIndex, part);
      logDebug(state, resolved.log);
      currentOriginalIndex = resolved.nextOriginalIndex;
      continue;
    }

    // Static part of the pretty string.
    const startPos = matchOffset + currentOriginalIndex;
    const previousPart = i > 0 ? prettyParts[i - 1] : null;
    let partOriginalLength: number;
    if (previousPart === '$0') {
      // Preceded by $0: zero-length segment after the full match.
      partOriginalLength = 0;
    } else {
      const nextStart = findNextPlaceholderStart(prettyParts, i + 1, match, originalMatchText, currentOriginalIndex);
      partOriginalLength = Math.max(0, nextStart - currentOriginalIndex);
    }

    const partOriginalText = originalMatchText.substring(currentOriginalIndex, currentOriginalIndex + partOriginalLength);
    const endPos = startPos + partOriginalLength;
    const uglyRange = rangeFromPositions(positionFrom(lineIdx, startPos), positionFrom(lineIdx, endPos));

    const dynamicPartParams: DecorationKeyParams = {
      ugly: configData.ugly,
      pretty: part,
      scope: configData.scope,
      style: configData.style,
    };
    addResolvedRange(state, dynamicPartParams, partOriginalText, part, rulePriority, uglyRange);

    currentOriginalIndex += partOriginalLength;
  }
};
