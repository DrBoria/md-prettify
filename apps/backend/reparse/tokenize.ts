import type { IToken } from '../host';
import type { DocumentStore } from '../document/type';
import type { PrettySubstitution } from '../document/type';
import { scopeSetByRangeKey, segmentMapFromScopes } from './segments';

export const refreshTokensOnLine = (state: DocumentStore, line: string, lineNumber: number): { tokens: IToken[], invalidated: boolean } => {
  if (!state.grammar)
    return { tokens: [], invalidated: false };
  try {
    const prevState = state.grammarState[lineNumber - 1] || null;
    const lineTokens = state.grammar.tokenizeLine(line, prevState);
    const invalidated = !state.grammarState[lineNumber] || !lineTokens.ruleStack.equals(state.grammarState[lineNumber])
    state.grammarState[lineNumber] = lineTokens.ruleStack;
    return { tokens: lineTokens.tokens, invalidated: invalidated };
  } catch (err) {
    console.error(`Error when refresh tokens on line '${line}', lineNumber: ${lineNumber}`, err);
    return { tokens: [], invalidated: false };
  }
};

export const getLineSegmentsWithScopes = (line: string, tokens: IToken[]) => {
  return segmentMapFromScopes(scopeSetByRangeKey(line, tokens));
};

/** Collects the scopes of tokens whose span intersects the target character range. */
const collectIntersectingScopes = (
  lineTokens: IToken[],
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

/** Helper function to get all unique scopes intersecting a given character range on a line */
export const getScopesForRange = (state: DocumentStore, lineTokens: IToken[], targetRangeStartChar: number, targetRangeEndChar: number): Set<string> => {
  if (!state.grammar || !lineTokens) return new Set<string>();
  const intersectingScopes = collectIntersectingScopes(lineTokens, targetRangeStartChar, targetRangeEndChar);
  if (intersectingScopes.size === 0 && state.defaultScope) {
    intersectingScopes.add(state.defaultScope);
  }
  return intersectingScopes;
};

/**
 * Classifies the scopes of a rule into three groups:
 * - positive: plain scopes the match location must intersect
 * - negative: scopes (without the leading '!') that veto the rule if intersected
 * - high-priority: scopes ending with '!' that bypass the positive match requirement
 */
const ruleScopeList = (configData: PrettySubstitution): unknown[] =>
  configData.scope ? (Array.isArray(configData.scope) ? configData.scope : [configData.scope]) : [];

const isPositiveScope = (scope: unknown): scope is string =>
  typeof scope === 'string' && !scope.startsWith('!') && !scope.endsWith('!');

const isNegativeScope = (scope: unknown): scope is string =>
  typeof scope === 'string' && scope.startsWith('!') && scope.length > 1;

const isHighPriorityScope = (scope: unknown): scope is string =>
  typeof scope === 'string' && scope.endsWith('!');

/** Collects the scopes matching the predicate, applying the per-group normalization. */
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

export const classifyRuleScopes = (configData: PrettySubstitution): {
  positiveScopes: Set<string>,
  negativeScopesByPrefix: Set<string>,
  highPriorityScopes: Set<string>,
} => {
  const ruleScopes = ruleScopeList(configData);

  return {
    positiveScopes: scopeSet(ruleScopes, isPositiveScope, identityScope),
    negativeScopesByPrefix: scopeSet(ruleScopes, isNegativeScope, stripLeadingBang),
    highPriorityScopes: scopeSet(ruleScopes, isHighPriorityScope, stripTrailingBang),
  };
};

/** True when any match scope starts with the given prefix. */
const anyScopeStartsWith = (matchScopes: Set<string>, prefix: string): boolean => {
  for (const matchScope of matchScopes) {
    if (matchScope.startsWith(prefix)) return true;
  }
  return false;
};

/** True when any rule scope matches a match scope by prefix in either direction. */
const anyScopeMatchesEitherDirection = (ruleScopes: Set<string>, matchScopes: Set<string>): boolean => {
  for (const ruleScope of ruleScopes) {
    for (const matchScope of matchScopes) {
      // matchScope starts with ruleScope OR ruleScope starts with matchScope
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
  // High-priority scopes bypass the positive match requirement.
  const hasHighPriorityMatch = [...highPriorityScopes].some((s) => anyScopeStartsWith(matchScopes, s));
  const ruleNeedsPositiveMatch = positiveScopes.size > 0 || highPriorityScopes.size > 0;
  const hasPositiveMatch = hasHighPriorityMatch
    || (ruleNeedsPositiveMatch && positiveScopes.size > 0 && anyScopeMatchesEitherDirection(positiveScopes, matchScopes));
  const hasNegativeMatch = anyScopeMatchesEitherDirection(negativeScopesByPrefix, matchScopes);

  // Apply the rule only if:
  // 1. High-priority condition met OR regular positive condition met AND
  // 2. Negative condition NOT met.
  return (hasHighPriorityMatch || hasPositiveMatch) && !hasNegativeMatch;
};

/** Appends a line to the output channel when debug logging is enabled. */
export const logDebug = (state: DocumentStore, message: string): void => {
  if (state.debug && state.outputChannel) state.outputChannel.appendLine(message);
};

