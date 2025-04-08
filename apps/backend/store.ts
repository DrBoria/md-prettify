/**
 * The root store: a mobx-state-tree model holding the extension's runtime
 * state, created once at the extension's entry point (packages/<ide>/activate.ts)
 * and passed explicitly to the backend wiring — there are no module singletons.
 *
 * Holds the host, the TextMate registry, the grammar cache, every open
 * document's controller, the resolve feature store, and the enable/disable
 * state.
 *
 * The grammar and controller maps use inline `t.custom` passthrough types:
 * mst stores the value as-is, so the in-place mutations vscode-textmate makes
 * on grammars (and the controllers' own live state) keep working. Non-serializable
 * IDE API objects (host, registry, channels, config state) live in `volatile`.
 *
 * The config feature state (settings, predefined configs, the logger channel,
 * programmatic substitutions) also lives here, so feature code reads it through
 * getRootStore/requireRootStore instead of per-feature store modules.
 */
import { types as t, type Instance, unprotect } from "mobx-state-tree";
import type { Host, IGrammar, ITextMateRegistry, OutputChannel } from "./host";
import type { LanguageEntry, PredefinedConfig, Settings } from "./config/configuration";
import type { PrettyDocumentController } from "./document/controller";
import { GrammarStoreModel } from "./grammar/store";
import { ReparseStoreModel } from "./reparse/store";
import { ResolveStoreModel } from "./resolve/store";

export type OnEnabledChangeHandler = (enabled: boolean) => void;

/** A passthrough map value: stored as-is, no snapshot processing or proxying. */
const grammarValue = t.custom<IGrammar, IGrammar>({
	name: "IGrammar",
	fromSnapshot: (s) => s,
	toSnapshot: (s) => s,
	isTargetType: () => true,
	getValidationMessage: () => "",
});

const controllerValue = t.custom<PrettyDocumentController, PrettyDocumentController>({
	name: "PrettyDocumentController",
	fromSnapshot: (s) => s,
	toSnapshot: (s) => s,
	isTargetType: () => true,
	getValidationMessage: () => "",
});

export const RootStoreModel = t.model("RootStore", {
	/** Cache for loaded grammars, keyed by scope name. */
	loadedGrammars: t.map(grammarValue),
	/** Every open document's controller, keyed by document uri. */
	documents: t.map(controllerValue),
	/** Whether pretty symbols are enabled at all. */
	enabled: t.boolean,
	/** The grammar feature store (the loaded Oniguruma WASM promise). */
	grammar: GrammarStoreModel,
	/** The reparse feature store (the in-flight reparse cancellation token). */
	reparse: ReparseStoreModel,
	/** The resolve feature store (last resolved range + its cache key). */
	resolve: ResolveStoreModel,
})
// Host/registry/handlers and the config feature state are IDE API objects or
// live collections: not serializable, not observable.
.volatile(() => ({
	host: undefined as Host | undefined,
	textMateRegistry: undefined as ITextMateRegistry | undefined,
	enabledHandlers: new Set<OnEnabledChangeHandler>(),
	// Config feature state (formerly the settings/logger/predefined stores):
	loggerChannel: undefined as OutputChannel | undefined,
	predefinedConfigs: new Map<string, PredefinedConfig>(),
	settings: undefined as Settings,
	outputChannel: undefined as OutputChannel,
	predefined: new Map<string, LanguageEntry>(),
	additionalSubstitutions: new Set<LanguageEntry>(),
}));

export type RootStore = Instance<typeof RootStoreModel>;

/** The created root store, if any; set by createRootStore (last call wins). */
const rootStoreRef = { current: undefined as RootStore | undefined };

/** The root store, or undefined before createRootStore has run. */
export const getRootStore = (): RootStore | undefined => rootStoreRef.current;

/** The root store, or an error if it has not been created yet. */
export const requireRootStore = (): RootStore => {
	const store = rootStoreRef.current;
	if (!store) throw new Error("Root store not created; call createRootStore() first");
	return store;
};

/** Creates the root store; called by the extension's entry point. */
export const createRootStore = (): RootStore => {
	const store = RootStoreModel.create({
		enabled: true,
		grammar: GrammarStoreModel.create(),
		reparse: ReparseStoreModel.create(),
		resolve: ResolveStoreModel.create({ lastResolvedRange: null, lastResolvedCacheKey: "" }),
	});

	unprotect(store);

	rootStoreRef.current = store;

	return store;
};
