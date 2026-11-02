// The grammar locator bridges the TextMate registry to the host's grammar
// discovery (installed IDE extensions). Host access, grammar loading and
// logging are handed in as dependencies, so the module stays host-neutral
// and free of app imports.
const injectionScopeNames = (injections: { scopeName: string }[]): string[] => {
  const names: string[] = [];
  for (const injection of injections) names.push(injection.scopeName);
  return names;
};

export const createGrammarLocator = (deps: {
  getHost: () => {
    getGrammarFilePath(scopeName: string): string | null;
    getGrammarInjections(scopeName: string): { scopeName: string; path: string }[];
  } | undefined;
  loadGrammar: (scopeName: string) => Promise<unknown>;
  logInfo: (message: string) => void;
  logWarn: (message: string) => void;
  logError: (message: string, error?: unknown) => void;
}): {
  getFilePath: (scopeName: string) => string;
  getInjections: (scopeName: string) => string[];
} => {
  const logLoadGrammarError = (err: unknown): void => deps.logError('loadGrammar:', err);

  const resolveGrammarFilePath = (scopeName: string): string => {
    try {
      const file = deps.getHost()?.getGrammarFilePath(scopeName) ?? null;
      if (file) deps.logInfo(`Found grammar for ${scopeName} at ${file}`);
      else deps.logWarn(`No grammar found for ${scopeName}`);
      return file;
    } catch (err) {
      deps.logError(`Error getting file path for ${scopeName}:`, err);
      // Falsy, like the original `undefined` — loadGrammarViaLocator treats any
      // falsy path as "grammar not found".
      return '';
    }
  };

  const resolveGrammarInjections = (scopeName: string): string[] => {
    deps.logInfo(`Getting injections for ${scopeName}`);
    const injections = deps.getHost()?.getGrammarInjections(scopeName) ?? [];
    if (injections.length > 0) {
      deps.logInfo(`Found injections for ${scopeName}: ${injectionScopeNames(injections).join(', ')}`);
      // fire-and-forget: the registry loads the grammars once the scope names
      // are handed back
      for (const injection of injections) {
        void deps.loadGrammar(injection.scopeName).catch(logLoadGrammarError);
      }
      return injectionScopeNames(injections);
    }
    deps.logInfo(`No injections found for ${scopeName}`);
    return [];
  };

  return { getFilePath: resolveGrammarFilePath, getInjections: resolveGrammarInjections };
};
