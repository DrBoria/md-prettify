/**
 * The resolve store: a mobx-state-tree model holding the state of the resolve
 * feature — the last resolved pretty range and its cache key, recorded when a
 * resolved range is added. Object literal, no classes.
 *
 * The overlap/range engine state (hiddeDecorationsRanges, lineIndex,
 * decorationCache, rangeKeyToCacheKey) lives on the document store; the engine
 * functions in this folder operate on it.
 */
import { types as t } from "mobx-state-tree";
import type { Instance } from "mobx-state-tree";
import type { Range } from "../host";
import { passthrough } from "../utils/mst-passthrough";
import { getDecorationCacheKeyAction, addResolvedRangeAction } from "./actions/resolved-range";

export const ResolveStoreModel = t.model("ResolveStore", {
	/** The range last added via `addResolvedRange`, for observers/tests. */
	lastResolvedRange: t.maybeNull(passthrough<Range>("lastResolvedRange")),
	/** The cache key of the range last added via `addResolvedRange`. */
	lastResolvedCacheKey: t.string,
});

export type ResolveStore = Instance<typeof ResolveStoreModel>;

export { getDecorationCacheKeyAction, addResolvedRangeAction };


