import type { OnEnabledChangeHandler } from '@md-prettify/types';
import type { RootStore } from '../../store';

/** Adds a handler to the store's enabled-change handlers. */
export const addEnabledHandler = (root: RootStore, handler: OnEnabledChangeHandler): void => {
  root.commands.enabledHandlers.add(handler);
};

/** Removes a handler from the store's enabled-change handlers. */
export const removeEnabledHandler = (root: RootStore, handler: OnEnabledChangeHandler): void => {
  root.commands.enabledHandlers.delete(handler);
};

