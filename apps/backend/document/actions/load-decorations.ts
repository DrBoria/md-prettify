import type { Substitution } from '../../store.d/type';
import type { DocumentStore } from '../type';
import { collectDecorationTypes, getDecorationCacheKey, hasPriorityScopes, makeHideTextDecorations, makePrettyDecorationLetterSpacingHack } from '@md-prettify/utils';

/** Disposes every decoration type the store owns and clears its decoration state. */
export const unloadDecorationsAction = (state: DocumentStore): void => {
  for (const type of collectDecorationTypes(state.hiddenDecoration, state.revealedUglyDecoration, state.decorationCache)) type.dispose();
  state.decorationCache.clear();
  state.hiddeDecorationsRanges.clear();
  state.hiddenDecoration = null;
  state.revealedUglyDecoration = null;
  state.boxedSymbolDecoration = null;
};

/** Creates the hide/reveal decoration types for the configured hide-text method. */
const loadHideTextDecorations = (state: DocumentStore): void => {
  const decorations = makeHideTextDecorations(state.host, state.hideTextMethod);
  state.hiddenDecoration = decorations.uglyDecoration;
  state.revealedUglyDecoration = decorations.revealedUglyDecoration;
  state.boxedSymbolDecoration = decorations.boxedSymbolDecoration;
};

/** Pre-creates the cache entry for a high-priority rule. */
const precacheHighPriorityRule = (state: DocumentStore, subst: Substitution, re: RegExp, scope: string | string[]): void => {
  const key = getDecorationCacheKey({ ugly: re, pretty: subst.pretty, style: subst.style, scope });
  if (state.decorationCache.has(key)) return;
  state.decorationCache.set(key, {
    decorationType: makePrettyDecorationLetterSpacingHack(state.host, { ugly: subst.ugly, pretty: subst.pretty, scope, style: subst.style }),
    ranges: new Set(),
    pretty: subst.pretty,
    priority: 2,
  });
};

/** Compiles one substitution rule, storing it and pre-caching high-priority rules. */
const addSubstitution = (state: DocumentStore, subst: Substitution): void => {
  const uglyStr = subst.ugly;
  try {
    const re = new RegExp(uglyStr, 'g');
    if (re.test('')) {
      console.warn(`Substitution ignored because it matches the empty string: "${uglyStr}" --> "${subst.pretty}"`);
      return;
    }
    let scopeToUse = subst.scope;
    if (!scopeToUse && state.defaultScope) scopeToUse = [state.defaultScope];
    state.prettySubstitutions.add({ ugly: re, pretty: subst.pretty, style: subst.style, scope: scopeToUse });
    if (subst.pretty && scopeToUse && hasPriorityScopes(scopeToUse)) precacheHighPriorityRule(state, subst, re, scopeToUse);
  } catch (e) {
    console.warn(`Could not add rule "${uglyStr}" --> "${subst.pretty}"; invalid regular expression`);
  }
};

/** Loads the hide/reveal decorations and the substitution rules into the store. */
export const loadDecorationsAction = (state: DocumentStore, substitutions: Substitution[]): void => {
  unloadDecorationsAction(state);
  loadHideTextDecorations(state);
  state.prettySubstitutions = new Set();
  for (const subst of substitutions) addSubstitution(state, subst);
};
