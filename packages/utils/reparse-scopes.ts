/** Structural view of a TextMate token; the reparse engine uses only these fields. */
export interface ReparseToken {
	startIndex: number;
	endIndex: number;
	scopes: string[];
}

/** The scope-bearing surface of a substitution rule. */
export interface ScopeRule {
	ugly?: RegExp | string;
	pretty?: string;
	scope?: string | string[];
}

const ruleScopeList = (configData: ScopeRule): unknown[] =>
	configData.scope ? (Array.isArray(configData.scope) ? configData.scope : [configData.scope]) : [];

const isPositiveScope = (scope: unknown): scope is string =>
	typeof scope === "string" && !scope.startsWith("!") && !scope.endsWith("!");

const isNegativeScope = (scope: unknown): scope is string =>
	typeof scope === "string" && scope.startsWith("!") && scope.length > 1;

const isHighPriorityScope = (scope: unknown): scope is string =>
	typeof scope === "string" && scope.endsWith("!");

const scopeSet = (
	ruleScopes: unknown[],
	matches: (scope: unknown) => scope is string,
	normalize: (scope: string) => string,
): Set<string> => {
	const collected = new Set<string>();
	for (const scope of ruleScopes) {
		if (matches(scope)) collected.add(normalize(scope));
	}
	return collected;
};

const identityScope = (scope: string): string => scope;

const stripLeadingBang = (scope: string): string => scope.substring(1);

const stripTrailingBang = (scope: string): string => scope.substring(0, scope.length - 1);

export interface ClassifiedScopes {
	positiveScopes: Set<string>;
	negativeScopesByPrefix: Set<string>;
	highPriorityScopes: Set<string>;
}

export const classifyRuleScopes = (configData: ScopeRule): ClassifiedScopes => {
	const ruleScopes = ruleScopeList(configData);
	return {
		positiveScopes: scopeSet(ruleScopes, isPositiveScope, identityScope),
		negativeScopesByPrefix: scopeSet(ruleScopes, isNegativeScope, stripLeadingBang),
		highPriorityScopes: scopeSet(ruleScopes, isHighPriorityScope, stripTrailingBang),
	};
};

const anyScopeStartsWith = (matchScopes: Set<string>, prefix: string): boolean => {
	for (const matchScope of matchScopes) {
		if (matchScope.startsWith(prefix)) return true;
	}
	return false;
};

const anyScopeMatchesEitherDirection = (ruleScopes: Set<string>, matchScopes: Set<string>): boolean => {
	for (const ruleScope of ruleScopes) {
		for (const matchScope of matchScopes) {
			if (matchScope.startsWith(ruleScope) || ruleScope.startsWith(matchScope)) return true;
		}
	}
	return false;
};

/**
 * Decides whether a rule applies at a match location, given the scopes intersecting the match.
 * The rule applies when (a high-priority scope matched OR a positive scope matched)
 * AND no negative scope matched.
 */
export const isScopeApplicable = (
	positiveScopes: Set<string>,
	negativeScopesByPrefix: Set<string>,
	highPriorityScopes: Set<string>,
	matchScopes: Set<string>,
): boolean => {
	const hasHighPriorityMatch = [...highPriorityScopes].some((s) => anyScopeStartsWith(matchScopes, s));
	const ruleNeedsPositiveMatch = positiveScopes.size > 0 || highPriorityScopes.size > 0;
	const hasPositiveMatch = hasHighPriorityMatch
		|| (ruleNeedsPositiveMatch && positiveScopes.size > 0 && anyScopeMatchesEitherDirection(positiveScopes, matchScopes));
	const hasNegativeMatch = anyScopeMatchesEitherDirection(negativeScopesByPrefix, matchScopes);
	return (hasHighPriorityMatch || hasPositiveMatch) && !hasNegativeMatch;
};

/** Collects the scopes of tokens whose span intersects the target character range. */
export const collectIntersectingScopes = (
	lineTokens: ReparseToken[],
	targetRangeStartChar: number,
	targetRangeEndChar: number,
): Set<string> => {
	const intersectingScopes = new Set<string>();
	for (const token of lineTokens) {
		if (token.endIndex <= targetRangeStartChar || token.startIndex >= targetRangeEndChar) continue;
		for (const scope of token.scopes) {
			intersectingScopes.add(scope);
		}
	}
	return intersectingScopes;
};

/** All unique scopes intersecting a character range, falling back to the default scope. */
export const getScopesForRange = (
	hasGrammar: boolean,
	defaultScope: string,
	lineTokens: ReparseToken[],
	targetRangeStartChar: number,
	targetRangeEndChar: number,
): Set<string> => {
	if (!hasGrammar) return new Set<string>();
	const intersectingScopes = collectIntersectingScopes(lineTokens, targetRangeStartChar, targetRangeEndChar);
	if (intersectingScopes.size === 0 && defaultScope) {
		intersectingScopes.add(defaultScope);
	}
	return intersectingScopes;
};
