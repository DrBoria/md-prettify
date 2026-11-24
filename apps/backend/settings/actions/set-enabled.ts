/**
 * The settings actions that store the enabled flag and notify the handlers
 * subscribed to it.
 */
import type { OnEnabledChangeHandler } from '@md-prettify/types';
import type { SettingsStore } from '../store';

/**
 * setEnabledHandlerAction: subscribes or unsubscribes one enabled-change handler.
 * @param {SettingsStore} self the settings store being written
 * @param {OnEnabledChangeHandler} handler the handler to add or remove
 * @param {boolean} present whether the handler is added or removed
 */
export function setEnabledHandlerAction(self: SettingsStore, handler: OnEnabledChangeHandler, present: boolean): void {
	if (present) self.enabledHandlers.add(handler);
	else self.enabledHandlers.delete(handler);
}

/**
 * setEnabledAction: stores whether pretty symbols are enabled and notifies every
 * handler.
 * @param {SettingsStore} self the settings store being written
 * @param {boolean} enabled the new enabled flag
 */
export function setEnabledAction(self: SettingsStore, enabled: boolean): void {
	self.enabled = enabled;
	for (const handler of self.enabledHandlers) handler(enabled);
}

/**
 * clearEnabledHandlersAction: removes every registered enabled-change handler.
 * @param {SettingsStore} self the settings store being cleared
 */
export function clearEnabledHandlersAction(self: SettingsStore): void {
	self.enabledHandlers.clear();
}
