/**
 * The root store: a mobx-state-tree model holding the extension's runtime state.
 * It is declared once, in place, and read through the `getRoot` accessor.
 *
 * Every feature declares its own model in its own `store.ts`; the root store
 * only composes them. The channels it logs to are live objects, so they live in
 * `volatile`; the IDE itself belongs to the settings feature.
 */
import { types as t, unprotect } from 'mobx-state-tree';
import type { OutputChannel } from '@md-prettify/types';
import { ConfigStoreModel } from './config/store';
import { SettingsStoreModel } from './settings/store';
import { GrammarStoreModel } from './grammar/store';
import { DocumentStoreModel } from './document/store';
import { DecorationsStoreModel } from './decorations/store';

/** rootStore: the single root store instance the whole backend shares. */
export const rootStore = t
	.model('RootStore', {
		/** Every open document's store, keyed by document uri. */
		documents: t.map(DocumentStoreModel),
		/** What is drawn on each open document, keyed by the same uri. */
		decorations: t.map(DecorationsStoreModel),
		/** The settings feature store (enabled flag, handlers, parsed settings). */
		settings: SettingsStoreModel,
		/** The config feature store (language entries and predefined configurations). */
		config: t.optional(ConfigStoreModel, {}),
		/** The grammar feature store (WASM promise, registry, grammar cache). */
		grammar: t.optional(GrammarStoreModel, {}),
	})
	.volatile(() => ({
		/** The channel the backend logs to. */
		outputChannel: undefined as OutputChannel | undefined,
		/** The commands feature's logger channel. */
		loggerChannel: null as OutputChannel | null,
	}))
	.create({ documents: {}, settings: { enabled: true } });
unprotect(rootStore);

/** The root store's shape. */
export type RootStore = typeof rootStore;

/** getRoot: returns the single root store instance the whole backend shares.
 * @returns {RootStore} the root store
 */
export function getRoot(): RootStore {
	if (!rootStore) throw new Error('root store is not initialised');

	return rootStore;
}
