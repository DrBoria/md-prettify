import * as fs from 'fs';

import * as vsctm from 'vscode-textmate';
import type { IGrammar, ITextMateRegistry, StackElement } from '../host';
import { log } from '../config/logger';

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

// Dummy grammar implementation for when TextMate is not available
const dummyGrammar: IGrammar = {
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
      ruleStack: _prevState ?? vsctm.INITIAL,
      stoppedEarly: false,
      fonts: [],
    };
  },
};

// Loads a grammar for the given scope name via the locator.
const loadGrammarViaLocator = async (locator: IGrammarLocator, scopeName: string): Promise<vsctm.IRawGrammar | null> => {
  try {
    const grammarPath = locator.getFilePath(scopeName);
    if (!grammarPath) {
      log.warn(`Grammar file not found for scope ${scopeName}`);
      return null;
    }

    log.info(`Loading grammar file for ${scopeName} from ${grammarPath}`);
    const data = await readFile(grammarPath);
    return vsctm.parseRawGrammar(data.toString(), grammarPath);
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
const loadGrammarFromRegistry = (registry: vsctm.Registry, scopeName: string): Promise<vsctm.IGrammar> =>
  registry.loadGrammar(scopeName);

// Create TextMate registry with the grammar locator and the loaded WASM library.
export const createRegistry = (locator: IGrammarLocator, onigLibPromise: Promise<vsctm.IOnigLib>): ITextMateRegistry | null => {
  if (!vsctm) {
    log.error('TextMate module not available');
    return null;
  }

  const registry = new vsctm.Registry({
    onigLib: onigLibPromise,
    loadGrammar: function (scopeName: string) {
      return loadGrammarViaLocator(locator, scopeName);
    },
    getInjections: function (scopeName: string) {
      return getInjectionsViaLocator(locator, scopeName);
    },
  });

  return {
    INITIAL: vsctm.INITIAL,
    loadGrammar: function (scopeName: string) {
      return loadGrammarFromRegistry(registry, scopeName);
    },
  };
};

// Helper function to load grammar synchronously for fallback
export const loadGrammarSync = (scopeName: string, filePath: string): IGrammar => {
  try {
    if (!vsctm || !vsctm.parseRawGrammar) {
      return dummyGrammar;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const raw: unknown = vsctm.parseRawGrammar(content, filePath);
    return raw as IGrammar;
  } catch (err) {
    log.error(`Error loading grammar synchronously: ${err.message}`);
    return dummyGrammar;
  }
};