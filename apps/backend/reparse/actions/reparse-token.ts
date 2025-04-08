import type { Instance } from "mobx-state-tree";
import type { ReparseStoreModel } from "../store";

type ReparseStore = Instance<typeof ReparseStoreModel>;

/**
 * Creates a cancellation token for a reparse operation and stores it on the
 * store. Call the returned `cancel()` to signal that a new reparse has
 * superseded this one.
 */
export const createReparseToken = (state: ReparseStore): void => {
	const token = { cancelled: false };
	state.currentToken = token;
};
