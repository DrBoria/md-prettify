/**
 * Matching a rule's TextMate scopes against the scopes a stretch of text carries,
 * because a rule names scopes in three flavours — plain, `!scope` to veto and
 * `scope!` to win — and the decoration store decides what to paint while this
 * module only answers whether a rule applies.
 */
import type { Substitution } from '@md-prettify/types';

/** getDecorationCacheKey: gives a rule one stable name for its decoration type,
 * @param {Substitution} params the rule whose identity is wanted
 * @returns {string} the key built from the pattern, the pretty text, the scopes and the style */
export function getDecorationCacheKey(params: Substitution): string {
	const scopeStr = Array.isArray(params.scope) ? [...params.scope].sort().join(',') : params.scope || '';
	const styleStr = params.style ? JSON.stringify(Object.entries(params.style).sort()) : '';
	const uglyStr = params.ugly instanceof RegExp ? `${params.ugly.source}|${params.ugly.flags}` : params.ugly;
	return `${uglyStr}:::${params.pretty}:::${scopeStr}:::${styleStr}`;
}

/** hasPriorityScopes: reports whether a rule carries a `scope!` marker,
 * @param {string | string[]} scopeArray the rule's scope list, when it has one
 * @returns {boolean} true when at least one scope ends with `!` */
function hasPriorityScopes(scopeArray?: string | string[]): boolean {
	if (!scopeArray) return false;
	const scopes = Array.isArray(scopeArray) ? scopeArray : [scopeArray];
	return scopes.some((scope) => typeof scope === 'string' && scope.endsWith('!'));
}

/** ruleScopeList: flattens a rule's scope into one list,
 * @param {{ scope?: string | string[] }} configData the rule whose scopes are read
 * @returns {unknown[]} the scopes as declared, empty when the rule names none */
function ruleScopeList(configData: { scope?: string | string[] }): unknown[] {
	if (!configData.scope) return [];
	return Array.isArray(configData.scope) ? configData.scope : [configData.scope];
}

/** isPrefixedScope: recognises `!scope` and `scope!` through one test,
 * @param {unknown} scope one entry of a rule's scope list
 * @param {string} marker the marker the entry has to carry
 * @param {boolean} atStart true for the veto form, false for the priority form
 * @returns {boolean} true when the entry carries the marker where it is expected */
function isPrefixedScope(scope: unknown, marker: string, atStart: boolean): scope is string {
	if (typeof scope !== 'string' || scope.length <= 1) return false;
	return atStart ? scope.startsWith(marker) : scope.endsWith(marker);
}

/** scopeSet: collects the scopes of one flavour into a set,
 * @param {unknown[]} ruleScopes the rule's scope list as declared
 * @param {(scope: unknown) => scope is string} matches the flavour to keep
 * @param {(scope: string) => string} normalize strips the marker before storing
 * @returns {Set<string>} the scopes of that flavour, with the markers stripped */
function scopeSet(ruleScopes: unknown[], matches: (scope: unknown) => scope is string, normalize: (scope: string) => string): Set<string> {
	if (ruleScopes.length === 0) return new Set<string>();
	return new Set(ruleScopes.filter(matches).map(normalize));
}

/** classifyRuleScopes: splits a rule's scopes into the three sets matching needs;
 * @param {{ scope?: string | string[] }} configData the rule whose scopes are classified
 * @returns {{ positiveScopes: Set<string>; negativeScopesByPrefix: Set<string>; highPriorityScopes: Set<string> }} the three sets */
export function classifyRuleScopes(configData: { scope?: string | string[] }): {
	positiveScopes: Set<string>;
	negativeScopesByPrefix: Set<string>;
	highPriorityScopes: Set<string>;
} {
	const ruleScopes = ruleScopeList(configData);
	if (ruleScopes.length === 0) {
		return { positiveScopes: new Set(), negativeScopesByPrefix: new Set(), highPriorityScopes: new Set() };
	}

	return {
		positiveScopes: scopeSet(
			ruleScopes,
			(scope) => typeof scope === 'string' && !isPrefixedScope(scope, '!', true) && !isPrefixedScope(scope, '!', false),
			(scope) => scope,
		),
		negativeScopesByPrefix: scopeSet(
			ruleScopes,
			(scope) => isPrefixedScope(scope, '!', true),
			(scope) => scope.substring(1),
		),
		highPriorityScopes: scopeSet(
			ruleScopes,
			(scope) => isPrefixedScope(scope, '!', false),
			(scope) => scope.substring(0, scope.length - 1),
		),
	};
}

/** anyScopeMatchesEitherDirection: compares a rule scope with a carried one both ways,
 * @param {Set<string>} ruleScopes the scopes the rule declares
 * @param {Set<string>} matchScopes the scopes the stretch carries
 * @returns {boolean} true when one side is a prefix of the other */
function anyScopeMatchesEitherDirection(ruleScopes: Set<string>, matchScopes: Set<string>): boolean {
	for (const ruleScope of ruleScopes) {
		for (const matchScope of matchScopes) {
			if (matchScope.startsWith(ruleScope) || ruleScope.startsWith(matchScope)) return true;
		}
	}
	return false;
}

/** isScopeApplicable: decides whether a rule covers a stretch — veto, then priority;
 * @param {Set<string>} positiveScopes the scopes the rule requires
 * @param {Set<string>} negativeScopesByPrefix the scopes that veto the rule
 * @param {Set<string>} highPriorityScopes the scopes that let the rule win regardless
 * @param {Set<string>} matchScopes the scopes the text actually carries
 * @returns {boolean} true when the rule applies */
export function isScopeApplicable(
	positiveScopes: Set<string>,
	negativeScopesByPrefix: Set<string>,
	highPriorityScopes: Set<string>,
	matchScopes: Set<string>,
): boolean {
	if (negativeScopesByPrefix.size > 0 && anyScopeMatchesEitherDirection(negativeScopesByPrefix, matchScopes)) return false;
	for (const highScope of highPriorityScopes) {
		for (const matchScope of matchScopes) {
			if (matchScope.startsWith(highScope)) return true;
		}
	}
	// A rule that names no scope applies everywhere: it can still be vetoed by
	// `!scope`. Demanding a positive scope silently disabled every scopeless rule,
	// so `if (...) {`, `try {` and their braces were never replaced.
	if (positiveScopes.size === 0) return true;

	return anyScopeMatchesEitherDirection(positiveScopes, matchScopes);
}

/** mergeTouching: welds adjacent ranges into one stretch,
 * @param {{ startIndex: number; endIndex: number }[]} ranges the ranges to weld
 * @returns {{ startIndex: number; endIndex: number }[]} the welded ranges, left to right */
function mergeTouching(ranges: { startIndex: number; endIndex: number }[]): { startIndex: number; endIndex: number }[] {
	if (ranges.length === 0) return [];
	const ordered = [...ranges].sort((a, b) => a.startIndex - b.startIndex);
	const merged = [ordered[0]];
	for (let index = 1; index < ordered.length; index++) {
		const current = ordered[index];
		const last = merged[merged.length - 1];
		if (current.startIndex <= last.endIndex) last.endIndex = Math.max(last.endIndex, current.endIndex);
		else merged.push(current);
	}
	return merged;
}

/** groupAndMergeTokensByScope: collects every token's ranges per scope,
 * @param {readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[]} tokens the tokenized line
 * @returns {Record<string, { startIndex: number; endIndex: number }[]>} the merged ranges of each scope */
export function groupAndMergeTokensByScope(
	tokens: readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[],
): Record<string, { startIndex: number; endIndex: number }[]> {
	const scopeMap: Record<string, { startIndex: number; endIndex: number }[]> = {};
	for (const token of tokens) {
		for (const scope of token.scopes) {
			if (!scopeMap[scope]) scopeMap[scope] = [];
			scopeMap[scope].push({ startIndex: token.startIndex, endIndex: token.endIndex });
		}
	}
	for (const scope in scopeMap) scopeMap[scope] = mergeTouching(scopeMap[scope]);
	return scopeMap;
}

/** segmentExcluded: reports whether a segment carries an excluded scope,
 * @param {Set<string>} excludedScopes the scope prefixes that veto a segment
 * @param {Set<string>} tokenScopes the scopes the segment carries
 * @returns {boolean} true when one carried scope starts with an excluded prefix */
export function segmentExcluded(excludedScopes: Set<string>, tokenScopes: Set<string>): boolean {
	if (excludedScopes.size === 0 || tokenScopes.size === 0) return false;
	for (const scope of tokenScopes) {
		for (const excludedPrefix of excludedScopes) {
			if (scope.startsWith(excludedPrefix)) return true;
		}
	}
	return false;
}

/** rulesInPriorityOrder: puts the rules marked `scope!` first;
 * @param {Iterable<{ scope?: string | string[] }>} rules the rules to order
 * @returns {{ scope?: string | string[] }[]} the ordered copy, priority markers first */
export function rulesInPriorityOrder<T extends { scope?: string | string[] }>(rules: Iterable<T>): T[] {
	const high: T[] = [];
	const low: T[] = [];
	for (const rule of rules) {
		if (hasPriorityScopes(rule.scope)) high.push(rule);
		else low.push(rule);
	}
	return [...high, ...low];
}
