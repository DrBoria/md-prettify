// The IDE extension ide ships its own MobX copy; isolate ours before any
// other import (direct or transitive) loads mobx/mst.
import { configure } from 'mobx';
configure({ isolateGlobalState: true });

import type { Disposable, mdPrettify } from '@md-prettify/types';
import type { Ide } from '@md-prettify/types';
import { initialize as initializeConfig, registerSubstitutions, reloadConfiguration } from './config/controller';
import { disposeCommands, setEnabled, subscribeEnabled } from './settings/controller';
import { disposeGrammar, initializeGrammar } from './grammar/controller';
import { closeDocument, openDocument, unloadAllDocuments } from './document/controller';
import { copyWithSubstitutions, focusActiveEditor, togglePrettySymbols } from './decorations/controller';
import { getRoot } from './store';

/** activate: initializes the backend for the given ide and returns the public api.
 * @param {Ide} ide the IDE the extension is attached to
 * @returns {mdPrettify} the public API the IDE exposes to other extensions
 */
export function activate(ide: Ide): mdPrettify {
	initializeConfig(ide);
	initializeGrammar();
	reloadConfiguration();
	setEnabled(true);
	for (const doc of ide.textDocuments) void openDocument(doc);

	return {
		onDidEnabledChange: subscribeEnabled,
		isEnabled: () => getRoot().settings.isEnabled,
		registerSubstitutions,
	};
}

/**
 * disablePrettySymbols: unloads every document so nothing stays decorated once
 * the user turned the feature off.
 */
function disablePrettySymbols(): void {
	setEnabled(false);
	unloadAllDocuments();
}

/**
 * enablePrettySymbols: reloads the settings and the grammar, then opens every
 * document again so the decorations come back where they were.
 * @param {Ide} ide the IDE the extension is attached to
 */
function enablePrettySymbols(ide: Ide): void {
	setEnabled(true);
	reloadConfiguration();
	initializeGrammar();
	for (const doc of ide.textDocuments) void openDocument(doc);
}

/** registerCommands: registers the extension's commands on the ide.
 * @param {Ide} ide the IDE the extension is attached to
 * @returns {Disposable[]} the disposables the decorator releases on unload
 */
export function registerCommands(ide: Ide): Disposable[] {
	if (!ide) return [];

	return [
		ide.registerCommand('md-prettify.copyWithSubstitutions', () => void copyWithSubstitutions(ide)),
		ide.registerCommand('md-prettify.disablePrettySymbols', disablePrettySymbols),
		ide.registerCommand('md-prettify.enablePrettySymbols', () => enablePrettySymbols(ide)),
		ide.registerCommand('md-prettify.togglePrettySymbols', togglePrettySymbols),
	];
}

/** registerListeners: registers the extension's event listeners on the ide.
 * @param {Ide} ide the IDE the extension is attached to
 * @returns {Disposable[]} the disposables the decorator releases on unload
 */
export function registerListeners(ide: Ide): Disposable[] {
	if (!ide) return [];

	return [
		ide.onDidOpenTextDocument(function (doc) {
			void openDocument(doc);
		}),
		ide.onDidCloseTextDocument(function (doc) {
			closeDocument(doc);
		}),
		ide.onDidChangeConfiguration(function () {
			unloadAllDocuments();
			initializeGrammar();
			reloadConfiguration();
			for (const doc of ide.textDocuments) void openDocument(doc);
		}),
		ide.onDidChangeActiveTextEditor(function (editor) {
			focusActiveEditor(editor);
		}),
		ide.onDidChangeTextEditorSelection(function (event) {
			focusActiveEditor(event.editor);
		}),
	];
}

/** deactivate: releases every backend resource. */
export function deactivate(): void {
	disposeCommands();
	unloadAllDocuments();
	disposeGrammar();
}
