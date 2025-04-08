import type { IOnigLib } from "vscode-textmate";
import type { ITextMateRegistry } from "../../host";
import type { IGrammarLocator } from "../registry";
import { loadOnigLib } from "../onig-wasm";
import { createRegistry } from "../registry";
import type { GrammarStore } from "../store";

/** Load the WASM library once; the promise is cached on the store. */
export const loadOnigLibAction = (state: GrammarStore): Promise<IOnigLib> => {
	if (state.onigLibPromise === undefined) {
		state.onigLibPromise = loadOnigLib();
	}
	return state.onigLibPromise;
};

/** Build a TextMate registry over the given locator, loading WASM if needed. */
export const createRegistryAction = (state: GrammarStore, locator: IGrammarLocator): ITextMateRegistry | null => {
	const onigLibPromise = state.onigLibPromise ?? (state.onigLibPromise = loadOnigLib());
	return createRegistry(locator, onigLibPromise);
};
