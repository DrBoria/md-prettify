/**
 * Coordinates of the product: points, offsets and the conversion between them.
 *
 * Every consumer (the backend features, both IDE adapters and the tests) needs
 * the same arithmetic, so it lives here rather than in any one feature.
 */
import type { Position } from '@md-prettify/types';

/** positionFrom: builds a non-negative point, refusing a value that cannot be a document coordinate.
 * @param {number} line the line index the caller wants to point at
 * @param {number} character the column the caller wants to point at
 * @returns {Position} the checked point
 */
export function positionFrom(line: number, character: number): Position {
	if (!Number.isInteger(line) || !Number.isInteger(character) || line < 0 || character < 0) {
		throw new RangeError(`position must be non-negative integers, got ${line}:${character}`);
	}
	return {
		line,
		character,
	};
}

/** positionCompare: orders two points so callers can sort and bound ranges consistently.
 * @param {Position} a the left point of the comparison
 * @param {Position} b the right point of the comparison
 * @returns {number} negative when `a` comes first, positive when `b` does
 */
export function positionCompare(a: Position, b: Position): number {
	if (a.line < b.line) return -1;
	if (a.line > b.line) return 1;
	if (a.character < b.character) return -1;
	if (a.character > b.character) return 1;
	return 0;
}

/** positionIsEqual: tells whether two points name the same place, by value, not by identity.
 * @param {Position} a the first point to compare
 * @param {Position} b the second point to compare
 * @returns {boolean} true when both coordinates match
 */
export function positionIsEqual(a: Position, b: Position): boolean {
	if (a === b) return true;
	return a.line === b.line && a.character === b.character;
}

// The package barrel: one import path for every consumer. The symbols are
// imported and re-exported here because `export … from` hides where a symbol
// is actually declared.
import { documentSnapshot, editorSnapshot, selectionsSnapshot, changesSnapshot, rangeTranslateByDelta, toRangeDelta } from './ide-snapshot';
import { compiledRulesOf, decorationOptionsFor, getLanguageEntry, settingsFromConfiguration } from './settings-merge';
import {
	classifyRuleScopes,
	getDecorationCacheKey,
	groupAndMergeTokensByScope,
	isScopeApplicable,
	rulesInPriorityOrder,
	segmentExcluded,
} from './scope-match';
import { buildDecorationsList, getDecoratedText, hiddenRangesOf, spansOfLine } from './text-pieces';
import { loadOnigLib } from './oniguruma';
import { lineStartsOf, offsetOf, rangeFrom, rangeFromPositions, rangeIsEqual, revealedSpansOf, selectionFrom } from './spans';

export {
	documentSnapshot,
	editorSnapshot,
	selectionsSnapshot,
	changesSnapshot,
	rangeTranslateByDelta,
	compiledRulesOf,
	decorationOptionsFor,
	getLanguageEntry,
	settingsFromConfiguration,
	classifyRuleScopes,
	getDecorationCacheKey,
	groupAndMergeTokensByScope,
	isScopeApplicable,
	rulesInPriorityOrder,
	segmentExcluded,
	buildDecorationsList,
	getDecoratedText,
	hiddenRangesOf,
	spansOfLine,
	loadOnigLib,
	toRangeDelta,
	rangeFrom,
	rangeFromPositions,
	rangeIsEqual,
	selectionFrom,
	lineStartsOf,
	offsetOf,
	revealedSpansOf,
};

/**
 * registerActions: binds every action of `actions` to `self`, so an action stays a
 * plain function of its own store and the model only binds it.
 * @param {S} self the store the actions belong to
 * @param {Record<string, Function>} actions the actions, each taking its store first
 * @returns the same actions as methods of that store
 */
export function registerActions<S extends object, A extends Record<string, (self: S, ...args: never[]) => unknown>>(
	self: S,
	actions: A,
): { [K in keyof A]: A[K] extends (self: never, ...args: infer P) => infer R ? (...args: P) => R : never } {
	const bound: Record<string, (...args: never[]) => unknown> = {};
	for (const [name, action] of Object.entries(actions)) {
		bound[name] = (...args: never[]) => action(self, ...args);
	}

	return bound as { [K in keyof A]: A[K] extends (self: never, ...args: infer P) => infer R ? (...args: P) => R : never };
}
