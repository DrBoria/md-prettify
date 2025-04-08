import type { Host, IGrammar, ITextMateRegistry, TextDocument, TextEditor } from '../host';
import type { ControllerOptions } from './type';
import { logError, logInfo, logWarn } from '../config/logger';
import { getLanguageEntry } from '../config/language-entry';
import { getSettings, getOutputChannel } from '../config/settings';
import { createPrettyDocumentController, type PrettyDocumentController } from './controller';
import { requireRootStore } from '../store';

/**
 * The document manager: the per-document lifecycle (open, close, unload)
 * and the shared state for all documents (the host, the TextMate registry,
 * the grammar cache, and the open documents), held in the root store.
 */

export function getDocument(doc: TextDocument): PrettyDocumentController | undefined {
  return requireRootStore().documents.get(doc.uri);
}

export function setHost(host: Host): void {
  requireRootStore().host = host;
}

export function setTextMateRegistry(registry: ITextMateRegistry | undefined): void {
  requireRootStore().textMateRegistry = registry;
}

/** Cache for loaded grammars. */
export const loadedGrammars = () => requireRootStore().loadedGrammars;

export async function loadGrammar(scopeName: string): Promise<IGrammar | null> {
  logInfo(`Loading grammar for scope: ${scopeName}`);

  const root = requireRootStore();

  if (!root.textMateRegistry) {
    logWarn(`TextMate registry not available, cannot load grammar for ${scopeName}`);
    return null;
  }

  const cached = root.loadedGrammars.get(scopeName);
  if (cached) {
    logInfo(`Using cached grammar for ${scopeName}`);
    return cached;
  }

  try {
    const grammar = await root.textMateRegistry.loadGrammar(scopeName);
    if (grammar) {
      logInfo(`Successfully loaded grammar for ${scopeName}`);
      root.loadedGrammars.set(scopeName, grammar);
      return grammar;
    }
    logWarn(`Grammar not found for ${scopeName}`);
    return null;
  } catch (err) {
    logError(`Exception in loadGrammar for ${scopeName}:`, err);
    return null;
  }
}

/** Resolves the TextMate scope name for a document, falling back to a language-derived scope. */
const resolveScopeName = (entry: { textMateInitialScope?: string }, host: Host | undefined, languageId: string): string =>
  entry.textMateInitialScope || host?.getLanguageScopeName(languageId) || 'source.' + languageId;

/** Loads the TextMate grammar for a scope, logging and returning null on failure. */
const loadGrammarForScope = async (scopeName: string): Promise<IGrammar | null> => {
  logInfo(`Attempting to load TextMate grammar for scope ${scopeName}`);
  try {
    const grammar = await loadGrammar(scopeName);
    if (!grammar) logWarn(`Could not load TextMate grammar for scope ${scopeName}`);
    return grammar;
  } catch (err) {
    logError(`Error loading TextMate grammar for scope ${scopeName}:`, err);
    return null;
  }
};

/** Create a controller for the given document, loading its grammar first. */
export async function openDocument(doc: TextDocument): Promise<void> {
  const root = requireRootStore();

  if (root.documents.has(doc.uri)) {
    logInfo(`Controller already exists for ${doc.uri}, skipping.`);
    return;
  }

  if (!root.enabled) {
    logInfo(`Pretty symbols disabled, not opening ${doc.fileName}`);
    return;
  }

  const entry = getLanguageEntry(doc);
  if (!entry) {
    logInfo(`No language entry for ${doc.fileName}, not opening`);
    return;
  }

  const settings = getSettings();
  const options: ControllerOptions = {
    hideTextMethod: settings.hideTextMethod,
    textMateGrammar: undefined,
    debug: settings.debug,
    outputChannel: getOutputChannel(),
  };
  options.textMateGrammar = await loadGrammarForScope(resolveScopeName(entry, root.host, doc.languageId));

  // Re-check after the await — another open may have raced us.
  if (root.documents.has(doc.uri)) {
    logInfo(`Controller was created for ${doc.uri} while waiting for grammar, skipping.`);
    return;
  }

  if (doc.isClosed) {
    logInfo(`Document ${doc.uri} closed while loading grammar, aborting.`);
    return;
  }

  try {
    const controller = createPrettyDocumentController(root.host, doc, entry, options);
    root.documents.set(doc.uri, controller);
    logInfo(`Controller created for ${doc.uri}`);
  } catch (err) {
    logError(`Error creating PrettyDocumentController for ${doc.uri}:`, err);
  }
}

export function closeDocument(doc: TextDocument): void {
  try {
    const root = requireRootStore();
    const prettyDoc = root.documents.get(doc.uri);
    if (prettyDoc) {
      prettyDoc.dispose();
      root.documents.delete(doc.uri);
    }
  } catch (e) {
    logError('closeDocument:', e);
  }
}

/** Dispose every controller; used on disable and on configuration reload. */
export function unloadAllDocuments(): void {
  const root = requireRootStore();
  for (const prettyDoc of root.documents.values()) prettyDoc.dispose();
  root.documents.clear();
}

/** Forward the active-editor change to the relevant document, if any. */
export function onActiveEditorChanged(editor: TextEditor | null): void {
  try {
    if (!editor) return;
    requireRootStore().documents.get(editor.document.uri)?.gotFocus(editor);
  } catch (e) {
    logError('onActiveEditorChanged:', e);
  }
}

/** Forward a selection change to the relevant document, if any. */
export function onSelectionChanged(event: { editor: TextEditor }): void {
  try {
    requireRootStore().documents.get(event.editor.document.uri)?.selectionChanged(event.editor);
  } catch (e) {
    logError('onSelectionChanged:', e);
  }
}
