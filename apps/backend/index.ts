// The VS Code extension host ships its own MobX copy; isolate ours before any
// other import (direct or transitive) loads mobx/mst.
import { configure } from 'mobx';
configure({ isolateGlobalState: true });

import type { Disposable, Host } from './host';
import type { LanguageEntry } from './config/configuration';
import type { mdPrettify } from './config/api';
import { getAdditionalSubstitutions } from './config/language-entry';
import { getOutputChannel, initialize, reloadConfiguration } from './config/settings';
import {
  disablePrettySymbols,
  enablePrettySymbols,
  notifyEnabledChange,
  onEnabledChange,
  togglePrettySymbols,
} from './commands/toggle';
import { copyWithSubstitutions } from './commands/copy';
import { closeDocument, onActiveEditorChanged, onSelectionChanged, openDocument, setHost, unloadAllDocuments } from './document/manager';
import { logError } from './config/logger';
import { getRootStore, createRootStore } from './store';
import type { RootStore } from './store';

/** Initialize the backend; called by the IDE adapter (packages/vscode-extension). */
export function activate(host: Host): mdPrettify {
  setHost(host);
  initialize(host);

  return {
    onDidEnabledChange: onEnabledChange,
    isEnabled() {
      return getRootStore()?.enabled ?? false;
    },
    registerSubstitutions(substitutions: LanguageEntry): Disposable {
      getAdditionalSubstitutions().add(substitutions);
      // TODO: this could be smart about not unloading & reloading everything
      reloadConfiguration();
      return {
        dispose() {
          getAdditionalSubstitutions().delete(substitutions);
        },
      };
    },
  };
}

/** Command registration; called by the IDE adapter. */
export function registerCommands(host: Host): Disposable[] {
  return [
    host.registerCommand('md-prettify.copyWithSubstitutions', function () { void copyWithSubstitutions(host); }),
    host.registerCommand('md-prettify.disablePrettySymbols', function () { disablePrettySymbols(); }),
    host.registerCommand('md-prettify.enablePrettySymbols', function () { enablePrettySymbols(); }),
    host.registerCommand('md-prettify.togglePrettySymbols', function () { togglePrettySymbols(); }),
  ];
}

/** Event listener registration; called by the IDE adapter. */
export function registerListeners(host: Host): Disposable[] {
  return [
    host.onDidOpenTextDocument(function (doc) {
      void openDocument(doc).catch(function (err) { logError('openDocument:', err); });
    }),
    host.onDidCloseTextDocument(closeDocument),
    host.onDidChangeConfiguration(function () { reloadConfiguration(); }),
    host.onDidChangeActiveTextEditor(onActiveEditorChanged),
    host.onDidChangeTextEditorSelection(onSelectionChanged),
  ];
}

/** Clean up; the extension is being unloaded. */
export function deactivate(): void {
  notifyEnabledChange(false);
  unloadAllDocuments();
  getOutputChannel()?.dispose();
}

/** Public re-exports for the IDE adapter. */
export { createRootStore };
export type { RootStore };
export { disablePrettySymbols, enablePrettySymbols, togglePrettySymbols } from './commands/toggle';
export { refreshPage } from './commands/refresh';
export { getOutputChannel } from './config/settings';
