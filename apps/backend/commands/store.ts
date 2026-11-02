/**
 * The commands store: a mobx-state-tree model holding the enable/disable state
 * of pretty symbols and the handlers subscribed to it. Object literal, no
 * classes; the behaviour lives in plain functions in `./toggle.ts`.
 */
import { types as t } from "mobx-state-tree";
import type { Instance } from "mobx-state-tree";
import type { OnEnabledChangeHandler } from "@md-prettify/types";
import { passthrough } from "@md-prettify/utils";

export const CommandsStoreModel = t.model("CommandsStore", {
	/** Whether pretty symbols are enabled at all. */
	enabled: t.boolean,
	/** Handlers notified whenever `enabled` changes. */
	enabledHandlers: passthrough<Set<OnEnabledChangeHandler>>("enabledHandlers"),
});

export type CommandsStore = Instance<typeof CommandsStoreModel>;
