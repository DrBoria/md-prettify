import type { IGrammarLocator } from './registry';
import { createGrammarLocator as createLocator } from '@md-prettify/utils';
import { loadGrammarAction } from './store';
import { getRoot } from '../store';
import { getHost } from '../store.d/controller';

/** Builds the TextMate grammar locator over the host, the grammar loader and the logger. */
export const createGrammarLocatorAction = (): IGrammarLocator =>
  createLocator({
    getHost: () => getHost(),
    loadGrammar: (scopeName) => loadGrammarAction(getRoot().grammar, getRoot().textMateRegistry, getRoot().loadedGrammars, scopeName),
    logInfo: console.info,
    logWarn: console.warn,
    logError: console.error,
  }) as IGrammarLocator;
