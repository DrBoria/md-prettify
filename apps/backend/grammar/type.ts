/**
 * The grammar feature's shapes: the extensions it scans, the ide surface it
 * reads, and the TextMate contracts only this feature works through.
 */
import type { IGrammar } from 'vscode-textmate';

/** The registry the backend loads grammars through. */
export interface ITextMateRegistry {
	loadGrammar(scopeName: string): Promise<IGrammar | null>;
}

/** A grammar injection the feature resolved to a file. */
export interface GrammarInjection {
	scopeName: string;
	path: string;
}
