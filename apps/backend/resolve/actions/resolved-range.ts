import type { Range } from "../../host";
import type { Instance } from "mobx-state-tree";
import type { ResolveStoreModel } from "../store";
import type { DecorationKeyParams, DocumentStore } from "../../document/type";
import { getDecorationCacheKey } from "../cache";
import { addResolvedRange as addResolvedRangeEngine } from "../ranges";

type ResolveStore = Instance<typeof ResolveStoreModel>;

/** The unique cache key for a substitution's parameters. */
export const getDecorationCacheKeyAction = (state: ResolveStore, params: DecorationKeyParams): string => {
	return getDecorationCacheKey({ ...params });
};

/**
 * Creates the cache entry for a resolved pretty text if missing and adds the
 * range with overlap handling; records the resolved range on the store.
 */
export const addResolvedRangeAction = (
	state: ResolveStore,
	docState: DocumentStore,
	params: DecorationKeyParams,
	uglyContext: string,
	resolvedPretty: string,
	rulePriority: number,
	uglyRange: Range,
): void => {
	addResolvedRangeEngine(docState, params, uglyContext, resolvedPretty, rulePriority, uglyRange);
	state.lastResolvedRange = uglyRange;
	state.lastResolvedCacheKey = getDecorationCacheKey(params);
};
