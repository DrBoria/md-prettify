/**
 * The vscode-textmate token types the host contract names.
 *
 * They are declared here field by field (not imported from the library) so
 * this is a plain structural type module: the backend may name them without
 * depending on the editor API, and the adapter's real grammars satisfy them.
 */

/** A grammar's state stack (opaque to everything outside the library). */
export interface StateStack {
	readonly _brand: "vscode-textmate-StateStack";
}

/** One token of a tokenized line: a span and a scope list. */
export interface IToken {
	startIndex: number;
	endIndex: number;
	scopes: string[];
}

/** The result of tokenizing one line. */
export interface ITokenizeLineResult<RuleStack = StateStack> {
	tokens: IToken[];
	ruleStack: RuleStack;
	stoppedEarly?: boolean;
}

/** The Oniguruma WASM binding the registry tokenizes with. */
export interface IOnigLib {
	createOnigScanner(patterns: string[]): unknown;
	createOnigString(str: string): unknown;
}

/** A loaded grammar. */
export interface IGrammar {
	tokenizeLine(lineText: string, prevState: StateStack | null, timeLimit?: number): ITokenizeLineResult<StateStack>;
	tokenizeLine2(lineText: string, prevState: StateStack | null, timeLimit?: number): { tokens: Uint32Array; ruleStack: StateStack; stoppedEarly?: boolean };
}

/** A grammar's state stack, as the registry hands it back. */
export type StackElement = StateStack;

/** The grammar registry an IDE adapter hands the backend (newest first). */
export interface ITextMateRegistry {
	readonly INITIAL: StateStack;
	loadGrammar(scopeName: string): Promise<IGrammar | undefined>;
}
