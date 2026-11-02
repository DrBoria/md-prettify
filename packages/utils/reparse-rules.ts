import type { ScopeRule } from "./reparse-scopes";

export const hasHighPriorityScope = (scope?: string | string[]): boolean => {
	if (!scope) return false;
	const scopes = Array.isArray(scope) ? scope : [scope];
	for (const s of scopes) {
		if (typeof s === "string" && s.endsWith("!")) return true;
	}
	return false;
};

/** Collects the rules of the given priority (high-priority scopes end with !). */
export const rulesOfPriority = <T extends ScopeRule>(rules: Iterable<T>, highPriority: boolean): T[] => {
	const out: T[] = [];
	for (const rule of rules) {
		if (hasHighPriorityScope(rule.scope) === highPriority) out.push(rule);
	}
	return out;
};

/** Splits rules into high-priority and normal, high-priority first. */
export const rulesInPriorityOrder = <T extends ScopeRule>(rules: Set<T>): T[] => [
	...rulesOfPriority(rules, true),
	...rulesOfPriority(rules, false),
];
