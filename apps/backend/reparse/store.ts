/**
 * The reparse store: a mobx-state-tree model holding the state of the reparse
 * feature — the current cancellation token for in-flight reparse operations.
 * Object literal, no classes.
 */
import { types as t } from "mobx-state-tree";
import type { Instance } from "mobx-state-tree";
import { passthrough } from "../utils/mst-passthrough";
import { createReparseToken } from "./actions/reparse-token";

export const ReparseStoreModel = t.model("ReparseStore", {
	/** The current reparse cancellation token, set by `createReparseToken`. */
	currentToken: t.optional(passthrough<{ cancelled: boolean }>("currentToken"), undefined),
});

export type ReparseStore = Instance<typeof ReparseStoreModel>;

export { createReparseToken };
