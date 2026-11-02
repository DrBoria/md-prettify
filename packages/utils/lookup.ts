import type { Position, Range } from "@md-prettify/types";
import { positionIsEqual, rangeContains, rangeIntersection } from "./range";

const isPositionAtStart = (range: Range, pos: Position): boolean => positionIsEqual(range.start, pos);
const isPositionAtEnd = (range: Range, pos: Position): boolean => positionIsEqual(range.end, pos);

/**
 * Checks whether a position is contained in a range with the given edge-inclusion options.
 */
const rangeContainsPosition = (range: Range, pos: Position, options: { excludeStart: boolean, includeEnd: boolean }): boolean => {
	const contained = rangeContains(range, pos);
	const atStart = isPositionAtStart(range, pos);
	const atEnd = isPositionAtEnd(range, pos);

	if (options.excludeStart) {
		if (options.includeEnd) {
			return contained && !atStart;
		}
		return contained && !atStart && !atEnd;
	}
	if (options.includeEnd) {
		return contained || atEnd;
	}
	return contained;
};

/**
 * Finds the hidden range containing the given position.
 */
export const findSymbolAt = (state: { hiddeDecorationsRanges: Set<Range> }, pos: Position, options: { excludeStart?: boolean, includeEnd?: boolean } = { excludeStart: false, includeEnd: false }): Range | undefined => {
	for (const range of state.hiddeDecorationsRanges) {
		if (rangeContainsPosition(range, pos, { excludeStart: options.excludeStart, includeEnd: options.includeEnd })) {
			return range;
		}
	}
	return undefined;
};

/**
 * Finds all hidden ranges overlapping the given range.
 */
export const findSymbolsIn = (state: { hiddeDecorationsRanges: Set<Range> }, range: Range): Set<Range> => {
	const overlappingRanges = new Set<Range>();
	for (const hiddenRange of state.hiddeDecorationsRanges) {
		if (rangeIntersection(range, hiddenRange)) overlappingRanges.add(hiddenRange);
	}
	return overlappingRanges;
};
