import type { OutputChannel } from '../host';
import { getRootStore } from '../store';

// All backend logging goes through here — never straight to console.*.
// Before the channel is configured (e.g. at module-load time) the messages
// are dropped except errors, which must always be visible.
export function configureLogger(outputChannel: OutputChannel): void {
  const store = getRootStore();
  if (store) store.loggerChannel = outputChannel;
}

export const logInfo = (message: string): void => {
  const channel = getRootStore()?.loggerChannel;
  if (channel) channel.appendLine(message);
};

export const logWarn = (message: string): void => {
  getRootStore()?.loggerChannel?.appendLine(`[warn] ${message}`);
};

export const logError = (message: string, error?: unknown): void => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message, detail);
  getRootStore()?.loggerChannel?.appendLine(`[error] ${message} ${detail}`);
};

/** Namespaced logger (registry.ts style). */
export const log = {
  info: logInfo,
  warn: logWarn,
  error: logError,
};
