/**
 * Command registration for the WebStorm adapter.
 *
 * The command *logic* (enable/disable/toggle) lives in the backend and is
 * wired to the IDE purely through the `Host` interface. This file is the thin
 * IDE-side entry point that `activate.ts` calls, plus the `registerCommand`
 * adapter that `host-adapter.ts` composes into the `Host` object.
 */
import * as webstorm from 'webstorm';
import type { Host, Disposable } from '../../apps/backend/host';
import { registerCommands as backendRegisterCommands } from '../../apps/backend/index';

export const registerCommands = (host: Host): Disposable[] => {
  return backendRegisterCommands(host);
};

/** The `registerCommand` adapter of the `Host` interface. */
export const registerHostCommand = (
  id: string,
  handler: (...args: unknown[]) => unknown,
): Disposable => webstorm.commands.registerCommand(id, handler);
