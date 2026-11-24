/**
 * The config store: the language entries and predefined configurations the user
 * chose. It owns the rule semantics; it does not own documents or decorations.
 */
import { types as t } from 'mobx-state-tree';
import type { Instance } from 'mobx-state-tree';
import { registerActions } from '@md-prettify/utils';
import type { LanguageEntry, PredefinedConfig } from '@md-prettify/types';
import type { PrettySubstitution } from '../document/type';
import {
	forgetDocumentConfigAction,
	loadDocumentConfigAction,
	registerSubstitutionAction,
	resetConfigurationAction,
	storePredefinedConfigsAction,
} from './actions/configuration';

const ConfigStoreBase = t.model('ConfigStore', {}).volatile(() => ({
	/** The named predefined language entries the ide declared. */
	predefined: new Map<string, LanguageEntry>(),
	/** The named predefined configurations (rules + per-entry settings). */
	predefinedConfigs: new Map<string, PredefinedConfig>(),
	/** The programmatically registered language entries. */
	additionalSubstitutions: new Set<LanguageEntry>(),
	/** The entry the resolver chose for each open document, keyed by document uri. */
	applied: new Map<string, LanguageEntry>(),
	/** The substitution map compiled for each open document: regexes, ready to match. */
	rules: new Map<string, Set<PrettySubstitution>>(),
}));

/** The config store's shape, without the actions attached to it. */
export type ConfigStore = Instance<typeof ConfigStoreBase>;

export const ConfigStoreModel = ConfigStoreBase.actions((self) => {
	// The config actions all live in `actions/`, so this map is the only place
	// that has to know which of them the store exposes.
	return registerActions(self, {
		loadDocumentConfig: loadDocumentConfigAction,
		forgetDocumentConfig: forgetDocumentConfigAction,
		storePredefinedConfigs: storePredefinedConfigsAction,
		registerSubstitution: registerSubstitutionAction,
		resetConfiguration: resetConfigurationAction,
	});
});
