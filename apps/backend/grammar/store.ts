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
import { passthrough } from "../utils/mst-passthrough";
import { loadOnigLibAction, createRegistryAction } from "./actions/load-onig-lib";

export const GrammarStoreModel = t.model("GrammarStore", {
	/** The in-flight WASM library promise, set once by `loadOnigLibAction`. */
	onigLibPromise: t.optional(passthrough<Promise<IOnigLib>>("onigLibPromise"), undefined),
});

export type GrammarStore = Instance<typeof GrammarStoreModel>;

export { loadOnigLibAction, createRegistryAction };


