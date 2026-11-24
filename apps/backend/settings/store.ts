/**
 * The settings store: the IDE the extension is attached to, the enable/disable
 * state of pretty symbols, the handlers subscribed to it and the settings the
 * ide configuration was parsed into. Object literal, no classes.
 */
import { types as t } from 'mobx-state-tree';
import type { Instance } from 'mobx-state-tree';
import { registerActions } from '@md-prettify/utils';
import type { Ide, OnEnabledChangeHandler, Settings } from '@md-prettify/types';
import { applyEntryDefaultsAction, applySettingsAction, attachIdeAction } from './actions/configuration';
import { clearEnabledHandlersAction, setEnabledAction, setEnabledHandlerAction } from './actions/set-enabled';

const SettingsStoreBase = t
	.model('SettingsStore', {
		/** Whether pretty symbols are enabled at all. */
		enabled: t.boolean,
		/** The IDE the extension is attached to. */
		ide: t.frozen<Ide | undefined>(undefined),
		/** The settings the ide configuration was parsed into. */
		values: t.frozen<Settings>({} as Settings),
		/** Handlers notified whenever `enabled` changes. */
		enabledHandlers: t.frozen<Set<OnEnabledChangeHandler>>(new Set<OnEnabledChangeHandler>()),
	})
	.views((self) => ({
		/** isEnabled: reports whether pretty symbols are enabled at all. The flag
		 *  is this store's own field, so the answer belongs to the store. */
		get isEnabled(): boolean {
			return self.enabled;
		},
	}));

/** The settings store the orchestrators read and the actions write. */
export type SettingsStore = Instance<typeof SettingsStoreBase>;

export const SettingsStoreModel = SettingsStoreBase.actions((self) =>
	registerActions(self, {
		attachIde: attachIdeAction,
		applySettings: applySettingsAction,
		applyEntryDefaults: applyEntryDefaultsAction,
		setEnabled: setEnabledAction,
		setEnabledHandler: setEnabledHandlerAction,
		clearEnabledHandlers: clearEnabledHandlersAction,
	}),
);
