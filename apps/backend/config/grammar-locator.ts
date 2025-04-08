import type * as tm from '../grammar/text-mate';
import { loadGrammar } from '../document/manager';
import { logError, logInfo, logWarn } from './logger';
import { getHost } from './settings';

// The grammar locator bridges the TextMate registry to the host's grammar
// discovery (installed IDE extensions), not a vscode import.
const logLoadGrammarError = (err: unknown): void => logError('loadGrammar:', err);

const injectionScopeNames = (injections: { scopeName: string }[]): string[] => {
  const names: string[] = [];
  for (const injection of injections) names.push(injection.scopeName);
  return names;
};

const resolveGrammarFilePath = (scopeName: string): string => {
  try {
    const file = getHost()?.getGrammarFilePath(scopeName) ?? null;
    if (file) logInfo(`Found grammar for ${scopeName} at ${file}`);
    else logWarn(`No grammar found for ${scopeName}`);
    return file;
  } catch (err) {
    logError(`Error getting file path for ${scopeName}:`, err);
    // Falsy, like the original `undefined` — loadGrammarViaLocator treats any
    // falsy path as "grammar not found".
    return '';
  }
};

const resolveGrammarInjections = (scopeName: string): string[] => {
  logInfo(`Getting injections for ${scopeName}`);
  const injections = getHost()?.getGrammarInjections(scopeName) ?? [];
  if (injections.length > 0) {
    logInfo(`Found injections for ${scopeName}: ${injectionScopeNames(injections).join(', ')}`);
    // fire-and-forget: the registry loads the grammars once the scope names
    // are handed back
    for (const injection of injections) {
      void loadGrammar(injection.scopeName).catch(logLoadGrammarError);
    }
    return injectionScopeNames(injections);
  }
  logInfo(`No injections found for ${scopeName}`);
  return [];
};

export const createGrammarLocator = (): tm.IGrammarLocator => ({
  getFilePath: resolveGrammarFilePath,
  getInjections: resolveGrammarInjections,
});