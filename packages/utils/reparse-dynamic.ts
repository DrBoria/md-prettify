import type { Range, Substitution } from "@md-prettify/types";
import { positionFrom, rangeFromPositions } from "./range";

export interface ResolvedDynamicRange {
	uglyRange: Range;
	keyParams: Substitution;
	matchText: string;
	resolvedPretty: string;
	log: string;
}

/** One step of the part-by-part walk: either a debug log or a decoration. */
export type PrettyPartStep =
	| { kind: "log"; log: string }
	| { kind: "decoration"; part: string; partOriginalText: string; uglyRange: Range };

/**
 * Walks the pretty parts of a dynamic substitution and computes the static-part
 * decorations plus the placeholder debug logs, without touching any store.
 */
export const prettyPartSteps = (
	match: RegExpMatchArray,
	lineIdx: number,
	matchOffset: number,
	pretty: string,
): PrettyPartStep[] => {
	const prettyParts = prettyPartsOf(pretty);
	const originalMatchText = match[0];
	let currentOriginalIndex = 0;
	const steps: PrettyPartStep[] = [];

	for (let i = 0; i < prettyParts.length; i++) {
		const part = prettyParts[i];
		if (part === '') continue;

		const isDynamicPlaceholder = part.match(/^\$(\d+)$/);

		if (isDynamicPlaceholder) {
			const paramIndex = parseInt(isDynamicPlaceholder[1], 10);
			const resolved = resolveDynamicPart(match, originalMatchText, paramIndex, currentOriginalIndex, part);
			steps.push({ kind: "log", log: resolved.log });
			currentOriginalIndex = resolved.nextOriginalIndex;
			continue;
		}

		const startPos = matchOffset + currentOriginalIndex;
		const previousPart = i > 0 ? prettyParts[i - 1] : null;
		let partOriginalLength: number;
		if (previousPart === '$0') {
			partOriginalLength = 0;
		} else {
			const nextStart = findNextPlaceholderStart(prettyParts, i + 1, match, originalMatchText, currentOriginalIndex);
			partOriginalLength = Math.max(0, nextStart - currentOriginalIndex);
		}

		const partOriginalText = originalMatchText.substring(currentOriginalIndex, currentOriginalIndex + partOriginalLength);
		const endPos = startPos + partOriginalLength;
		const uglyRange = rangeFromPositions(positionFrom(lineIdx, startPos), positionFrom(lineIdx, endPos));
		steps.push({ kind: "decoration", part, partOriginalText, uglyRange });

		currentOriginalIndex += partOriginalLength;
	}

	return steps;
};

/** Builds the cache-key parameters for a resolved pretty text. */
const keyParamsOf = (configData: Substitution, pretty: string): Substitution => ({
	ugly: configData.ugly,
	pretty,
	scope: configData.scope,
	style: configData.style,
});

/** Resolves the original-text segment a `$N` placeholder maps to. */
export const resolveDynamicPart = (
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
export const findNextPlaceholderStart = (
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

/** Splits the pretty text on `$N` placeholders. */
export const prettyPartsOf = (pretty: string): string[] => pretty.split(/(\$\d+)/g);

/**
 * Special case: the pretty text contains only $0 and static text.
 * Returns the decoration data, or null when this case does not apply.
 */
export const dollarZeroOnlyDecoration = (
	configData: Substitution,
	match: RegExpMatchArray,
	lineIdx: number,
	matchStart: number,
	matchEnd: number,
): ResolvedDynamicRange | null => {
	const containsOtherPlaceholders = /\$(?!0\b)\d+/.test(configData.pretty);
	if (containsOtherPlaceholders || !configData.pretty.includes('$0')) return null;

	const uglyRange = rangeFromPositions(positionFrom(lineIdx, matchStart), positionFrom(lineIdx, matchEnd));
	const resolvedPretty = configData.pretty.replace('$0', match[0]);
	return {
		uglyRange,
		keyParams: keyParamsOf(configData, resolvedPretty),
		matchText: match[0],
		resolvedPretty,
		log: ` Part '$0' corresponds to original substring '${match[0]}' [${matchStart}-${matchEnd}]`,
	};
};

/**
 * Special case: the pretty text is a single capture-group placeholder (e.g. '$1').
 * Returns the decoration data, or null when this case does not apply.
 */
export const wholeMatchCaptureDecoration = (
	configData: Substitution,
	match: RegExpMatchArray,
	lineIdx: number,
	matchStart: number,
	matchEnd: number,
): ResolvedDynamicRange | null => {
	if (!(configData.pretty.match(/^\$\d+$/) && match.length > 1)) return null;

	const paramIndex = parseInt(configData.pretty.substring(1), 10);
	if (!(paramIndex < match.length && match[paramIndex] !== undefined)) return null;

	const uglyRange = rangeFromPositions(positionFrom(lineIdx, matchStart), positionFrom(lineIdx, matchEnd));
	const capturedGroup = match[paramIndex];
	return {
		uglyRange,
		keyParams: keyParamsOf(configData, capturedGroup),
		matchText: match[0],
		resolvedPretty: capturedGroup,
		log: `Entire match '${match[0]}' being replaced with captured group ${paramIndex}: '${capturedGroup}' [${matchStart}-${matchEnd}]`,
	};
};
