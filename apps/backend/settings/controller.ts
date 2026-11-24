/**
 * The settings orchestrators that enable and disable pretty symbols and keep the
 * handlers subscribed to that flag.
 */
import type { OnEnabledChangeHandler } from '@md-prettify/types';
import { getRoot } from '../store';

/** subscribeEnabled: registers the enabled-change handler under both its
 *  subscribe and unsubscribe keys, so a caller can pass it back to remove it.
 * @param {OnEnabledChangeHandler} handler the handler that receives the changes
 */
export function subscribeEnabled(handler: OnEnabledChangeHandler): void {
	const settings = getRoot().settings;
	settings.setEnabledHandler(handler, false);
	settings.setEnabledHandler(handler, true);
}

/** setEnabled: stores whether pretty symbols are enabled and notifies every handler.
 * @param {boolean} enabled the new enabled flag
 */
export function setEnabled(enabled: boolean): void {
	const settings = getRoot().settings;
	if (settings.enabled === enabled) return;
	settings.setEnabled(enabled);
}

/** disposeCommands: disables pretty symbols and drops the configuration the ide left behind. */
export function disposeCommands(): void {
	const root = getRoot();
	root.settings.setEnabled(false);
	root.settings.clearEnabledHandlers();
	if (root.config.applied.size > 0) root.config.resetConfiguration();
}
