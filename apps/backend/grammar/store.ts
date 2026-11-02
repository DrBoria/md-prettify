/**
 * The grammar store: a mobx-state-tree model holding the state of the
 * grammar feature — the Oniguruma WASM library promise, loaded once and
 * shared by every TextMate registry. Object literal, no classes.
 *
 * Actions live in `./actions/` and are re-exported here so callers import
 * them from this module.
 */
import { types as t } from "mobx-state-tree";
import type { Instance } from "mobx-state-tree";
import type { IOnigLib } from "vscode-textmate";
import type { IGrammar, ITextMateRegistry } from "../host";
import { passthrough } from "@md-prettify/utils";
import { loadOnigLibAction, createRegistryAction } from "./actions/load-onig-lib";

export const GrammarStoreModel = t.model("GrammarStore", {
	/** The in-flight WASM library promise, set once by `loadOnigLibAction`. */
	onigLibPromise: t.optional(passthrough<Promise<IOnigLib>>("onigLibPromise"), undefined),
});

export type GrammarStore = Instance<typeof GrammarStoreModel>;

/** Loads (and caches on the store) the TextMate grammar for a scope. */
export const loadGrammarAction = async (
	state: GrammarStore,
	registry: ITextMateRegistry | undefined,
	loadedGrammars: { get(scope: string): IGrammar | undefined; set(scope: string, grammar: IGrammar): unknown },
	scopeName: string,
): Promise<IGrammar | null> => {
	const cached = loadedGrammars.get(scopeName);
	if (cached) return cached;
	if (!registry) return null;
	const grammar = await registry.loadGrammar(scopeName);
	if (grammar) loadedGrammars.set(scopeName, grammar);
	return grammar ?? null;
};

export { loadOnigLibAction, createRegistryAction };


