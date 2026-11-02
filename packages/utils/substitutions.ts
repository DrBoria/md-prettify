import type { Substitution } from '@md-prettify/types';

/** The scopes a substitution contributes to: its own scope(s), or the default. */
const scopesForSubstitution = (subst: Substitution, defaultScope: string): string[] => {
  if (!subst.scope) return [defaultScope];

  return Array.isArray(subst.scope) ? subst.scope : [subst.scope];
};

/** Appends a substitution to its scope's list, creating the list if needed. */
const addToScope = (scopeToSubsts: Record<string, Substitution[]>, scope: string, subst: Substitution): void => {
  if (!scopeToSubsts[scope]) {
    scopeToSubsts[scope] = [];
  }
  scopeToSubsts[scope].push(subst);
};

export const groupSubstitutionsByScope = (scopedSubstitutions: Substitution[], defaultScope: string): Record<string, Substitution[]> => {
  const scopeToSubsts: Record<string, Substitution[]> = {};
  for (const subst of scopedSubstitutions) {
    for (const scope of scopesForSubstitution(subst, defaultScope)) {
      addToScope(scopeToSubsts, scope, subst);
    }
  }

  return scopeToSubsts;
};
