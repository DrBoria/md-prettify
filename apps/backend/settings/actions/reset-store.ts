/** The commands action that resets the whole root store for a test or a fresh ide. */
import type { Ide } from '@md-prettify/types';
import type { RootStore } from '../../store';
import { settingsFromConfiguration } from '@md-prettify/utils';

/** Clears every feature's state and points the root store at the given ide. */
export function resetStoreAction(root: RootStore, ide: Ide): void {
	root.documents.clear();
	root.settings.enabled = true;
	root.settings.enabledHandlers.clear();
	root.settings.ide = ide;
	root.outputChannel = ide.createOutputChannel('test');
	root.settings.values = settingsFromConfiguration({});
	root.config.additionalSubstitutions.clear();
	root.config.predefined.clear();
	root.config.predefinedConfigs.clear();
	root.grammar.loadedGrammars.clear();
	root.grammar.registry = null;
}
