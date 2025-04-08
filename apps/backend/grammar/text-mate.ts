import * as vsctm from 'vscode-textmate';

// The host contract re-exports the canonical vscode-textmate token types.
export type { IGrammar, IToken, ITokenizeLineResult, StackElement } from '../host';

export { createRegistry, loadGrammarSync } from './registry';
export type { IGrammarLocator, IGrammarInfo } from './registry';
export { matchScope } from './scope-match';
export { combineIdenticalTokenScopes, groupAndMergeTokensByScope } from './tokens';
export { groupSubstitutionsByScope } from './substitutions';

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

// Export TextMate functionality if available
export const INITIAL = vsctm ? vsctm.INITIAL : undefined;
export const parseRawGrammar = vsctm ? vsctm.parseRawGrammar : undefined;
export const Registry = vsctm ? vsctm.Registry : undefined;
