// The VS Code extension host ships its own MobX copy; isolate ours before any
// other import (direct or transitive) loads mobx/mst.
import { configure } from 'mobx';
configure({ isolateGlobalState: true });

import type { Disposable, Host } from './host';
import type { OnEnabledChangeHandler } from '@md-prettify/types';
import type { LanguageEntry } from './store.d/type';
import type { mdPrettify } from './store.d/type';
import { getAdditionalSubstitutions } from './store.d/language-entry';
import { getOutputChannel, initialize, reloadConfiguration } from './store.d/controller';
import { togglePrettySymbols } from './commands/toggle-pretty-symbols';
import { addEnabledHandler, removeEnabledHandler } from './commands/actions/set-enabled';
import { copyWithSubstitutions, onActiveEditorChanged, onSelectionChanged } from './commands/editor-events';
import {
  closeDocumentAction,
  openDocumentAction,
  setHostAction,
  unloadAllDocumentsAction,
} from './document/actions/manage-documents';
import { createRootStore, isEnabled, requireRootStore } from './store';
import type { RootStore } from './store';

/** Initialize the backend; called by the IDE adapter (packages/vscode-extension). */
export function activate(host: Host): mdPrettify {
  const root = requireRootStore();
  setHostAction(root, host);
  initialize(host);

  return {
    onDidEnabledChange(handler: OnEnabledChangeHandler): Disposable {
      addEnabledHandler(root, handler);
      return { dispose: () => removeEnabledHandler(root, handler) };
    },
    isEnabled,
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
    host.registerCommand('md-prettify.disablePrettySymbols', function () {
      const root = requireRootStore();
      const commands = root.commands;
      if (commands.enabled !== false) {
        commands.enabled = false;
        for (const handler of commands.enabledHandlers) handler(false);
      }
      unloadAllDocumentsAction(root);
    }),
    host.registerCommand('md-prettify.enablePrettySymbols', function () {
      const root = requireRootStore();
      const commands = root.commands;
      if (commands.enabled !== true) {
        commands.enabled = true;
        for (const handler of commands.enabledHandlers) handler(true);
      }
      reloadConfiguration();
    }),
    host.registerCommand('md-prettify.togglePrettySymbols', function () { togglePrettySymbols(); }),
  ];
}

/** Event listener registration; called by the IDE adapter. */
export function registerListeners(host: Host): Disposable[] {
  return [
    host.onDidOpenTextDocument(function (doc) {
      void openDocumentAction(requireRootStore(), doc).catch(function (err) { console.error('openDocument:', err); });
    }),
    host.onDidCloseTextDocument(function (doc) { closeDocumentAction(requireRootStore(), doc); }),
    host.onDidChangeConfiguration(function () { reloadConfiguration(); }),
    host.onDidChangeActiveTextEditor(onActiveEditorChanged),
    host.onDidChangeTextEditorSelection(onSelectionChanged),
  ];
}

/** Clean up; the extension is being unloaded. */
export function deactivate(): void {
  const root = requireRootStore();
  const commands = root.commands;
  if (commands.enabled !== false) {
    commands.enabled = false;
    for (const handler of commands.enabledHandlers) handler(false);
  }
  unloadAllDocumentsAction(root);
  getOutputChannel()?.dispose();
}

/** Public re-exports for the IDE adapter. */
export { createRootStore };
export type { RootStore };
export { togglePrettySymbols } from './commands/toggle-pretty-symbols';
export { getOutputChannel } from './store.d/controller';
