/**
 * Command registration for the VS Code adapter.
 *
 * The command *logic* (enable/disable/toggle) lives in the backend and is
 * wired to the IDE purely through the `Host` interface. This file is the thin
 * IDE-side entry point that `activate.ts` calls.
 */
import * as vscode from 'vscode';
import type { Host, Disposable } from '../../apps/backend/host';
import { registerCommands as backendRegisterCommands } from '../../apps/backend/index';

export function registerCommands(host: Host): Disposable[] {
  return backendRegisterCommands(host);
}

/** The `registerCommand` adapter of the `Host` interface. */
export const registerHostCommand = (
  id: string,
  handler: (...args: unknown[]) => unknown,
): Disposable => vscode.commands.registerCommand(id, handler);
