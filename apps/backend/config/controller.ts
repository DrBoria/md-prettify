/**
 * The configuration orchestrators: read the ide configuration into the settings
 * and the config stores. Called by the extension entry point.
 */
import type { Ide } from '@md-prettify/types';
import type { LanguageEntry, RawConfiguration, Settings } from '@md-prettify/types';
import { settingsFromConfiguration } from '@md-prettify/utils';
import { getRoot } from '../store';

/** reloadConfiguration: re-reads the settings and rebuilds the substitution defaults for every language. */
export function reloadConfiguration(): void {
	const root = getRoot();
	const configuration = (root.settings.ide?.getConfiguration('mdPrettify') ?? {}) as RawConfiguration;
	const settings: Settings = settingsFromConfiguration(configuration);
	root.settings.applySettings(settings);
	root.config.storePredefinedConfigs(configuration);
	root.settings.applyEntryDefaults(settings);
}

/** initialize: activates the config feature by storing the ide and clearing any previous configuration.
 * @param {Ide} ide the IDE the extension is attached to
 */
export function initialize(ide: Ide): void {
	const root = getRoot();
	root.settings.attachIde(ide);
	root.config.resetConfiguration();
}

/** registerSubstitutions: registers a programmatic substitution entry and reloads the configuration.
 * @param {LanguageEntry} entry the entry the extension caller wants to add
 */
export function registerSubstitutions(entry: LanguageEntry): void {
	getRoot().config.registerSubstitution(entry, true);
	reloadConfiguration();
}
