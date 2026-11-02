import type { Host, TextDocument } from '../../host';
import { getLanguageEntry, languageEntryContextFrom } from '@md-prettify/utils';
import type { RootStore } from '../../store';
import { createPrettyDocumentController } from './controller';

/** Stores the IDE adapter's host on the root store. */
export const setHostAction = (root: RootStore, host: Host): void => {
  root.host = host;
};

/** Opens the document: loads its grammar, then registers its controller on the root store. */
export const openDocumentAction = async (root: RootStore, doc: TextDocument): Promise<void> => {
  if (root.documents.has(doc.uri) || !root.commands.enabled) return;
  const entry = getLanguageEntry(doc, languageEntryContextFrom(root));
  if (!entry) return;
  const options = {
    hideTextMethod: hideTextMethodOf(root),
    textMateGrammar: await loadGrammarForScopeAction(root, entry.textMateInitialScope ?? 'source.' + doc.languageId),
    debug: root.settings.debug === true,
    outputChannel: root.outputChannel,
  };
  if (root.documents.has(doc.uri) || doc.isClosed) return;
  const substitutions = entry.substitutions ?? [];
  root.documents.set(doc.uri, createPrettyDocumentController(root.host, doc, entry, options, substitutions));
};

/** The hide-text method the settings ask for, defaulting to letter-spacing. */
const hideTextMethodOf = (root: RootStore): NonNullable<RootStore['settings']['hideTextMethod']> =>
  root.settings.hideTextMethod ?? 'hack-letterSpacing';

/** Loads the TextMate grammar for a scope, returning null on failure. */
const loadGrammarForScopeAction = async (root: RootStore, scopeName: string) => {
  if (!root.textMateRegistry) return null;
  const cached = root.loadedGrammars.get(scopeName);
  if (cached) return cached;
  const grammar = await root.textMateRegistry.loadGrammar(scopeName);
  if (grammar) root.loadedGrammars.set(scopeName, grammar);
  return grammar ?? null;
};

/** Disposes every controller: used on disable and on configuration reload. */
export const unloadAllDocumentsAction = (root: RootStore): void => {
  for (const prettyDoc of root.documents.values()) prettyDoc.dispose();
  root.documents.clear();
};

/** Closes one document's controller. */
export const closeDocumentAction = (root: RootStore, doc: TextDocument): void => {
  root.documents.get(doc.uri)?.dispose();
  root.documents.delete(doc.uri);
};
