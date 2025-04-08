import type { PrettySubstitution } from '../document/type';

/** The scopes a substitution contributes to: its own scope(s), or the default. */
const scopesForSubstitution = (subst: PrettySubstitution, defaultScope: string): string[] => {
  if (!subst.scope) return [defaultScope];

  return Array.isArray(subst.scope) ? subst.scope : [subst.scope];
};

/** Appends a substitution to its scope's list, creating the list if needed. */
const addToScope = (scopeToSubsts: Record<string, PrettySubstitution[]>, scope: string, subst: PrettySubstitution): void => {
  if (!scopeToSubsts[scope]) {
    scopeToSubsts[scope] = [];
  }
  scopeToSubsts[scope].push(subst);
};

export const groupSubstitutionsByScope = (scopedSubstitutions: PrettySubstitution[], defaultScope: string): Record<string, PrettySubstitution[]> => {
  const scopeToSubsts: Record<string, PrettySubstitution[]> = {};
  for (const subst of scopedSubstitutions) {
    for (const scope of scopesForSubstitution(subst, defaultScope)) {
      addToScope(scopeToSubsts, scope, subst);
    }
  }

  return scopeToSubsts;
};
