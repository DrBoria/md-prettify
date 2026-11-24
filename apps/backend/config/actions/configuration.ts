/**
 * The config feature's actions: they write the predefined configurations and the
 * config entry of every open document. Each action writes the config store it
 * belongs to and reaches the documents through the root store.
 */
import { getRoot as rootOf } from 'mobx-state-tree';
import { compiledRulesOf } from '@md-prettify/utils';
import type { LanguageEntry, RawConfiguration } from '@md-prettify/types';
import type { ConfigStore } from '../store';
import type { RootStore } from '../../store';

/**
 * storePredefinedConfigsAction: stores the predefined configurations the raw
 * configuration declares.
 * @param {ConfigStore} self the config store being written
 * @param {RawConfiguration} configuration the raw configuration the ide returned
 */
export function storePredefinedConfigsAction(self: ConfigStore, configuration: RawConfiguration): void {
	self.predefined.clear();
	for (const [key, entry] of Object.entries(configuration.predefinedConfigurations ?? {})) {
		self.predefined.set(key, entry);
		self.predefinedConfigs.set(key, { substitutions: entry.substitutions ?? [], settings: entry });
	}
}

/**
 * registerSubstitutionAction: adds or removes one programmatically registered
 * substitution entry.
 * @param {ConfigStore} self the config store being written
 * @param {LanguageEntry} entry the entry the extension caller supplied
 * @param {boolean} present whether the entry is added or removed
 */
export function registerSubstitutionAction(self: ConfigStore, entry: LanguageEntry, present: boolean): void {
	if (!present) {
		self.additionalSubstitutions.delete(entry);

		return;
	}
	self.additionalSubstitutions.add(entry);
}

/**
 * resetConfigurationAction: clears the configuration the previous ide left behind.
 * @param {ConfigStore} self the config store being cleared
 */
export function resetConfigurationAction(self: ConfigStore): void {
	self.predefined.clear();
	self.predefinedConfigs.clear();
	self.additionalSubstitutions.clear();
}

/**
 * loadDocumentConfigAction: stores the entry resolved for one document and the
 * substitution map compiled from it.
 * @param {ConfigStore} self the config store being written
 * @param {string} uri the document the config applies to
 * @param {LanguageEntry} entry the merged language entry of that document
 */
export function loadDocumentConfigAction(self: ConfigStore, uri: string, entry: LanguageEntry): void {
	const root: RootStore = rootOf(self);
	self.applied.set(uri, entry);
	self.rules.set(uri, new Set(compiledRulesOf(entry, root.documents.get(uri)?.languageId ?? '')));
}

/**
 * forgetDocumentConfigAction: drops the entry and the substitution map of a
 * closed document.
 * @param {ConfigStore} self the config store being written
 * @param {string} uri the document whose config is dropped
 */
export function forgetDocumentConfigAction(self: ConfigStore, uri: string): void {
	self.applied.delete(uri);
	self.rules.delete(uri);
}
