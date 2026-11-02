import * as fs from 'fs';

import type { IGrammar, ITextMateRegistry, StackElement } from './vscode-textmate';
/** Namespaced logger: the backend injects its own; solo use falls back to the console. */
const log = {
	info: (message: string): void => console.log(message),
	warn: (message: string): void => console.warn(message),
	error: (message: string, error?: unknown): void => console.error(message, error),
};

// Export IGrammarLocator interface for compatibility
export interface IGrammarLocator {
  getFilePath(scopeName: string): string;
  getInjections?(scopeName: string): string[];
}

export interface IGrammarInfo {
  readonly fileTypes: string[];
  readonly name: string;
  readonly scopeName: string;
  readonly firstLineMatch: string;
}

/**
 * Utility to read a file as a promise
 */
const readFile = (path: string): Promise<Buffer> =>
  new Promise<Buffer>(function (resolve, reject) {
    fs.readFile(path, function (error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });

// Loads a grammar for the given scope name via the locator.
const loadGrammarViaLocator = async (vsctmModule: any, locator: IGrammarLocator, scopeName: string): Promise<any> => {
  try {
    const grammarPath = locator.getFilePath(scopeName);
    if (!grammarPath) {
      log.warn(`Grammar file not found for scope ${scopeName}`);
      return null;
    }

    log.info(`Loading grammar file for ${scopeName} from ${grammarPath}`);
    const data = await readFile(grammarPath);
    return vsctmModule.parseRawGrammar(data.toString(), grammarPath);
  } catch (err) {
    log.error(`Failed to load grammar for ${scopeName}:`, err);
    return null;
  }
};

// Returns the grammar injection file paths for the given scope name.
const getInjectionsViaLocator = (locator: IGrammarLocator, scopeName: string): string[] => {
  if (locator.getInjections) {
    return locator.getInjections(scopeName);
  }
  return [];
};

// Loads a grammar from an already-created vscode-textmate registry.
const loadGrammarFromRegistry = (registry: any, scopeName: string): Promise<any> =>
  registry.loadGrammar(scopeName);

// Create TextMate registry with the grammar locator and the loaded WASM library.
export const createRegistry = (
  vsctmModule: any,
  locator: IGrammarLocator,
  onigLibPromise: Promise<any>,
): ITextMateRegistry | null => {
  if (!vsctmModule) {
    log.error('TextMate module not available');
    return null;
  }

  const registry = new vsctmModule.Registry({
    onigLib: onigLibPromise,
    loadGrammar: function (scopeName: string) {
      return loadGrammarViaLocator(vsctmModule, locator, scopeName);
    },
    getInjections: function (scopeName: string) {
      return getInjectionsViaLocator(locator, scopeName);
    },
  });

  return {
    INITIAL: vsctmModule.INITIAL,
    loadGrammar: function (scopeName: string) {
      return loadGrammarFromRegistry(registry, scopeName);
    },
  };
};

// Helper function to load grammar synchronously for fallback
export const loadGrammarSync = (
  vsctmModule: any,
  dummyGrammar: IGrammar,
  filePath: string,
): IGrammar => {
  try {
    if (!vsctmModule || !vsctmModule.parseRawGrammar) {
      return dummyGrammar;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const raw: unknown = vsctmModule.parseRawGrammar(content, filePath);
    return raw as IGrammar;
  } catch (err) {
    log.error(`Error loading grammar synchronously: ${err.message}`);
    return dummyGrammar;
  }
};

export const createDummyGrammar = (vsctmModule: any): IGrammar => ({
  tokenizeLine(_lineText: string, prevState: StackElement) {
    return {
      tokens: [],
      ruleStack: prevState,
      stoppedEarly: false,
      fonts: [],
    };
  },
  tokenizeLine2(_lineText: string, _prevState: StackElement | null) {
    return {
      tokens: new Uint32Array(0),
      ruleStack: _prevState ?? vsctmModule.INITIAL,
      stoppedEarly: false,
    };
  },
});
