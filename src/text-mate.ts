import * as path from 'path';
import * as fs from 'fs';
// import * as vscode from 'vscode'; // Remove vscode import if no longer needed

import * as vsctm from 'vscode-textmate';
import * as oniguruma from 'vscode-oniguruma';
import { PrettySubstitution } from './PrettyModel';

// namespace N {
//   /**
//    * The registry that will hold all grammars.
//    */
//   export declare class Registry {
//     private readonly _locator;
//     private readonly _syncRegistry;
//     constructor(locator?: IGrammarLocator);
//     /**
//      * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
//      */
//     loadGrammar(initialScopeName: string, callback: (err: any, grammar: IGrammar) => void): void;
//     /**
//      * Load the grammar at `path` synchronously.
//      */
//     loadGrammarFromPathSync(path: string): IGrammar;
//     /**
//      * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `loadGrammarFromPathSync`.
//      */
//     grammarForScopeName(scopeName: string): IGrammar;
//   }  
// }

const wasmPath = path.join(__dirname, '..', '..', 'node_modules', 'vscode-oniguruma', 'release', 'onig.wasm');
console.info(`Checking Oniguruma WASM at ${wasmPath}`);
if (!fs.existsSync(wasmPath)) {
  console.error(`Oniguruma WASM file not found at ${wasmPath}`);
}
const wasmBuffer = fs.readFileSync(wasmPath);

console.info(`Loading Oniguruma WASM from ${wasmPath}`);
const onigLibPromise = oniguruma.loadWASM({ data: wasmBuffer })
  .then(() => {
    console.info('Oniguruma WASM loaded successfully');
    return {
      createOnigScanner: (patterns) => oniguruma.createOnigScanner(patterns),
      createOnigString: (s) => oniguruma.createOnigString(s),
    };
  })
  .catch(err => {
    console.error('Failed to load Oniguruma WASM:', err);
    throw err;
  });

export function matchScope(scope: string | string[], scopes: string[]) : boolean {
  if(!scope)
    return true;
  
  // If scope is an array, check if any of the scope strings match
  if(Array.isArray(scope)) {
    return scope.some(s => matchSingleScope(s, scopes));
  }
  
  return matchSingleScope(scope, scopes);
}

function matchSingleScope(scope: string, scopes: string[]): boolean {
  // Для лучшего обнаружения вложенных скоупов
  // 1. Проверим, содержит ли хотя бы один из скоупов полностью наш искомый скоуп
  for (const tokenScope of scopes) {
    if (tokenScope.includes(scope)) {
      return true;
    }
  }
  
  // 2. Проверим по частям
  const parts = scope.split(/\s+/);
  for (const part of parts) {
    let found = false;
    for (const tokenScope of scopes) {
      if (tokenScope.includes(part)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  
  return true;
}

/**
 * Utility to read a file as a promise
 */
function readFile(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, data) => error ? reject(error) : resolve(data));
  });
}

// Export TextMate functionality if available
export const INITIAL = vsctm ? vsctm.INITIAL : undefined;
export const parseRawGrammar = vsctm ? vsctm.parseRawGrammar : undefined;
export const Registry = vsctm ? vsctm.Registry : undefined;

// Dummy grammar implementation for when TextMate is not available
const dummyGrammar = {
  tokenizeLine(lineText: string, prevState: any): any {
    return {
      tokens: [],
      ruleStack: prevState || INITIAL,
    };
  }
};

// Create TextMate registry with the grammar locator
export function createRegistry(locator: any) {
  if (!vsctm) {
    console.error('TextMate module not available');
    return null;
  }

  return new vsctm.Registry({
    onigLib: onigLibPromise,
    loadGrammar: async (scopeName: string) => {
      try {
        const grammarPath = locator.getFilePath(scopeName);
        if (!grammarPath) {
          console.warn(`Grammar file not found for scope ${scopeName}`);
          return null;
        }

        console.info(`Loading grammar file for ${scopeName} from ${grammarPath}`);
        const data = await readFile(grammarPath);
        return vsctm.parseRawGrammar(data.toString(), grammarPath);
      } catch (err) {
        console.error(`Failed to load grammar for ${scopeName}:`, err);
        return null;
      }
    },
    getInjections: (scopeName: string) => {
      if (locator.getInjections) {
        return locator.getInjections(scopeName);
      }
      return [];
    }
  });
}

// Helper function to load grammar synchronously for fallback
export function loadGrammarSync(scopeName: string, filePath: string): any {
  try {
    if (!vsctm || !vsctm.parseRawGrammar) {
      return dummyGrammar;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return vsctm.parseRawGrammar(content, filePath);
  } catch (err) {
    console.error(`Error loading grammar synchronously: ${err.message}`);
    return dummyGrammar;
  }
}

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
 * A grammar
 */
export interface IGrammar {
  /**
   * Tokenize `lineText` using previous line state `prevState`.
   */
  tokenizeLine(lineText: string, prevState: StackElement): ITokenizeLineResult;
}

export interface ITokenizeLineResult {
  readonly tokens: IToken[];
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}

export interface IToken {
  startIndex: number;
  readonly endIndex: number;
  readonly scopes: string[];
}

/**
 * **IMPORTANT** - Immutable!
 */
export interface StackElement {
  _stackElementBrand: void;
  readonly _parent: StackElement;
  equals(other: StackElement): boolean;
}

export function combineIdenticalTokenScopes(tokens: any[]) : any[] {
  if(!tokens || tokens.length === 0)
    return [];
  const result = [tokens[0]];
  let prevToken = tokens[0];
  for(let idx = 1; idx < tokens.length; ++idx) {
    const token = tokens[idx];
    if(prevToken.endIndex===token.startIndex && token.scopes.length === prevToken.scopes.length && token.scopes.every((t,idx) => t === prevToken.scopes[idx])) {
      // Note: create a copy of the object so the source tokens are unmodified
      result[result.length-1] = {startIndex: prevToken.startIndex, endIndex: token.endIndex, scopes: prevToken.scopes}
      prevToken = result[result.length-1];
    } else {
      result.push(token);
      prevToken = token;
    }
  }
  return result;
}

export function groupAndMergeTokensByScope(
  tokens: any[], 
): Record<string, { startIndex: number; endIndex: number }[]> {
  if (!tokens || tokens.length === 0) {
    return {};
  }


  // Шаг 1: Собираем диапазоны по скоупам
  const scopeMap: Record<string, { startIndex: number; endIndex: number }[]> = {};
  for (const token of tokens) {
    for (const scope of token.scopes) {
      if (!scopeMap[scope]) {
        scopeMap[scope] = [];
      }
      scopeMap[scope].push({ startIndex: token.startIndex, endIndex: token.endIndex });
    }
  }

  // Шаг 2: Объединяем диапазоны для каждого скоупа
  for (const scope in scopeMap) {
    scopeMap[scope] = mergeRanges(scopeMap[scope]);
  }

  return scopeMap;
}

export function groupSubstitutionsByScope(scopedSubstitutions: PrettySubstitution[], defaultScope: string): Record<string, PrettySubstitution[]> {
  // Инициализируем пустой объект для хранения результата
  const scopeToSubsts: Record<string, PrettySubstitution[]> = {};

  // Проходим по каждому объекту в массиве
  for (const subst of scopedSubstitutions) {
    // Определяем скоупы: используем subst.scope если он есть, иначе defaultScope
    let scopes: string[];
    if (subst.scope) {
      scopes = Array.isArray(subst.scope) ? subst.scope : [subst.scope];
    } else {
      // Если scope не задан, используем defaultScope
      scopes = [defaultScope];
    }


    // Для каждого scope в массиве scopes
    for (const scope of scopes) {
      // Если для этого scope ещё нет массива, создаём его
      if (!scopeToSubsts[scope]) {
        scopeToSubsts[scope] = [];
      }
      // Добавляем текущий объект в массив для этого scope
      scopeToSubsts[scope].push(subst);
    }
  }

  return scopeToSubsts;
}

// Функция для объединения примыкающих диапазонов
function mergeRanges(ranges: { startIndex: number; endIndex: number }[]): { startIndex: number; endIndex: number }[] {
  if (ranges.length === 0) return [];

  // Сортируем по startIndex
  ranges.sort((a, b) => a.startIndex - b.startIndex);
  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const current = ranges[i];
    const last = merged[merged.length - 1];

    // Если текущий диапазон примыкает или пересекается с последним, объединяем
    if (current.startIndex <= last.endIndex) {
      last.endIndex = Math.max(last.endIndex, current.endIndex);
    } else {
      merged.push(current);
    }
  }

  return merged;
}
