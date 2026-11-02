import type { OutputChannel } from '../../host';
import type { RootStore } from '../../store';

// All backend logging goes through here — never straight to console.*.
// Before the channel is configured (e.g. at module-load time) the messages
// are dropped except errors, which must always be visible.
export const configureLogger = (state: RootStore, outputChannel: OutputChannel): void => {
  state.loggerChannel = outputChannel;
};

export const logWarn = (state: RootStore, message: string): void => {
  state.loggerChannel?.appendLine(`[warn] ${message}`);
};

export const logError = (state: RootStore, message: string, error?: unknown): void => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message, detail);
  state.loggerChannel?.appendLine(`[error] ${message} ${detail}`);
};
