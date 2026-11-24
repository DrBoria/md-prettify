/**
 * The settings feature's configuration actions: they store the ide the extension
 * is attached to and the settings the ide configuration was parsed into.
 */
import { getRoot as rootOf } from 'mobx-state-tree';
import type { Ide, Settings } from '@md-prettify/types';
import type { SettingsStore } from '../store';
import type { RootStore } from '../../store';

/**
 * attachIdeAction: stores the ide the extension is attached to and opens its
 * debug channel.
 * @param {SettingsStore} self the settings store being written
 * @param {Ide} ide the ide the extension is attached to
 */
export function attachIdeAction(self: SettingsStore, ide: Ide): void {
	const root: RootStore = rootOf(self);
	self.ide = ide;
	root.outputChannel = ide.createOutputChannel('MD Prettify Debug');
}

/**
 * applySettingsAction: stores the settings the ide configuration was parsed into.
 * @param {SettingsStore} self the settings store being written
 * @param {Settings} settings the parsed settings
 */
export function applySettingsAction(self: SettingsStore, settings: Settings): void {
	self.values = settings;
}

/**
 * applyEntryDefaultsAction: fills the unset fields of every configured entry from
 * the settings they came with.
 * @param {SettingsStore} self the settings store being written
 * @param {Settings} settings the settings the defaults are read from
 */
export function applyEntryDefaultsAction(self: SettingsStore, settings: Settings): void {
	for (const language of settings.substitutions ?? []) {
		language.revealOn = language.revealOn ?? settings.revealOn;
		language.adjustCursorMovement = language.adjustCursorMovement ?? settings.adjustCursorMovement;
		language.prettyCursor = language.prettyCursor ?? settings.prettyCursor;
		language.combineIdenticalScopes = language.combineIdenticalScopes ?? true;
	}
	self.values = settings;
}
