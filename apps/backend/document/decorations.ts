import type { Substitution } from '../config/configuration';
import * as decorations from '../resolve/ranges';
import type { DocumentStore } from './type';
import { getDecorationCacheKey, hasPriorityScopes } from '../resolve/cache';
import { unloadDecorations } from './store';

/** Creates the hide/reveal decoration set for the configured hide-text method. */
const makeHideTextDecorations = (state: DocumentStore): { uglyDecoration: NonNullable<DocumentStore['hiddenDecoration']>, revealedUglyDecoration: NonNullable<DocumentStore['revealedUglyDecoration']>, boxedSymbolDecoration: NonNullable<DocumentStore['boxedSymbolDecoration']> } => {
  if (state.hideTextMethod === "hack-fontSize") return decorations.makeDecorationsFontSizeHack(state.host);
  if (state.hideTextMethod === "hack-letterSpacing") return decorations.makeDecorationsLetterSpacingHack(state.host);
  return decorations.makeDecorationsNone(state.host);
};

export const loadDecorations = (state: DocumentStore, substitutions: Substitution[]): void => {
  unloadDecorations(state); // Clear previous state including cache

  const dec = makeHideTextDecorations(state);
  state.hiddenDecoration = dec.uglyDecoration;
  state.revealedUglyDecoration = dec.revealedUglyDecoration;
  state.boxedSymbolDecoration = dec.boxedSymbolDecoration;

  state.prettySubstitutions = new Set();
  for (const subst of substitutions) {
    addSubstitution(state, subst);
  }
};

/** Pre-creates the cache entry for a high-priority rule (decoration itself is created on demand). */
const precacheHighPriorityRule = (state: DocumentStore, subst: Substitution, re: RegExp, scope: string | string[]): void => {
  const key = getDecorationCacheKey({
    ugly: re,
    pretty: subst.pretty,
    style: subst.style,
    scope,
  });

  if (!state.decorationCache.has(key)) {
    const newDecoration = decorations.makePrettyDecorationLetterSpacingHack(state.host, {
      ugly: subst.ugly,
      pretty: subst.pretty,
      scope,
      style: subst.style,
    });
    state.decorationCache.set(key, {
      decorationType: newDecoration,
      ranges: new Set(),
      pretty: subst.pretty,
      priority: 2 // Explicitly set high priority
    });
  }
};

/** Compiles one substitution rule, storing it and pre-caching high-priority rules. */
const addSubstitution = (state: DocumentStore, subst: Substitution): void => {
  const uglyStr = subst.ugly;
  try {
    const re = new RegExp(uglyStr, "g");
    if (re.test("")) {
      console.warn(`Substitution ignored because it matches the empty string: "${uglyStr}" --> "${subst.pretty}"`);
      return;
    }

    // Auto-add defaultScope to rules that don't specify scopes
    let scopeToUse = subst.scope;
    if (!scopeToUse && state.defaultScope) {
      scopeToUse = [state.defaultScope];
    }

    // Store the raw configuration, decorations will be created on demand and cached
    state.prettySubstitutions.add({
      ugly: re,
      pretty: subst.pretty,
      // No decorationType or ranges here
      style: subst.style,
      scope: scopeToUse, // Use the scope with defaultScope if needed
    });

    // Pre-create cache entry with priority if this is a high-priority rule
    if (subst.pretty && scopeToUse && hasPriorityScopes(scopeToUse)) {
      precacheHighPriorityRule(state, subst, re, scopeToUse);
    }
  } catch (e) {
    console.warn(`Could not add rule "${uglyStr}" --> "${subst.pretty}"; invalid regular expression`)
  }
};
