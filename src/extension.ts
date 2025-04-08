// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Settings, LanguageEntry, UglyRevelation, PrettyCursor, HideTextMethod } from './configuration';
import { PrettyDocumentController } from './PrettyDocumentController';
import * as api from './api';
import * as tm from './text-mate';

/** globally enable or disable all substitutions */
let prettySymbolsEnabled = true;

/** Tracks all documents that substitutions are being applied to */
let documents = new Map<vscode.Uri, PrettyDocumentController>();
/** The current configuration */
let settings: Settings;
/** Output channel for debugging */
let outputChannel: vscode.OutputChannel; // Re-add output channel

const onEnabledChangeHandlers = new Set<(enabled: boolean) => void>();
export const additionalSubstitutions = new Set<api.LanguageEntry>();
export let textMateRegistry: any; // Registry from vscode-textmate
export let loadedGrammars = new Map<string, any>(); // Cache for loaded grammars

interface ExtensionGrammar {
  language?: string, scopeName?: string, path?: string, embeddedLanguages?: { [scopeName: string]: string }, injectTo?: string[]
}
interface ExtensionPackage {
  contributes?: {
    languages?: { id: string, configuration: string }[],
    grammars?: ExtensionGrammar[],
  }
}

export function getLanguageScopeName(languageId: string): string {
  try {
    const languages =
      vscode.extensions.all
        .filter(x => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
        .reduce((a: ExtensionGrammar[], b) => [...a, ...(b.packageJSON as ExtensionPackage).contributes.grammars], []);
    const matchingLanguages = languages.filter(g => g.language === languageId);

    if (matchingLanguages.length > 0) {
      console.info(`Mapping language ${languageId} to initial scope ${matchingLanguages[0].scopeName}`);
      return matchingLanguages[0].scopeName;
    }
  } catch (err) { }
  console.info(`Cannot find a mapping for language ${languageId}; assigning default scope source.${languageId}`);
  return 'source.' + languageId;
}

const grammarLocator = {
  getFilePath: function (scopeName: string): string {
    try {
      const grammars = vscode.extensions.all
        .filter(x => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
        .reduce((a: (ExtensionGrammar & { extensionPath: string })[], b) => [...a, ...(b.packageJSON as ExtensionPackage).contributes.grammars.map(x => Object.assign({ extensionPath: b.extensionPath }, x))], []);
      const matchingLanguages = grammars.filter(g => g.scopeName === scopeName);

      if (matchingLanguages.length > 0) {
        const ext = matchingLanguages[0];
        const file = path.join(ext.extensionPath, ext.path);
        console.info(`Found grammar for ${scopeName} at ${file}`);
        if (fs.existsSync(file)) {
          console.info(`Grammar file exists at ${file}`);
        } else {
          console.warn(`Grammar file does not exist at ${file}`);
        }
        return file;
      } else {
        console.warn(`No grammar found for ${scopeName}`);
      }
    } catch (err) {
      console.error(`Error getting file path for ${scopeName}:`, err);
    }
    return undefined;
  },
  getInjections: function (scopeName: string): string[] {
    console.info(`Getting injections for ${scopeName}`);
    const grammars = vscode.extensions.all
      .filter(x => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
      .reduce((a, b) => [...a, ...(b.packageJSON).contributes.grammars], []);
    const injections = grammars
      .filter(g => g.injectTo && g.injectTo.includes(scopeName))
      .map(g => g.scopeName);

    if (injections.length > 0) {
      console.info(`Found injections for ${scopeName}: ${injections.join(', ')}`);
      injections.forEach(async (injectionScope) => {
        console.info(`Attempting to load grammar for ${injectionScope}`);
        const grammar = await loadGrammar(injectionScope);
        if (!grammar) {
          console.warn(`No grammar found for ${injectionScope}`);
        } else {
          console.info(`Successfully loaded grammar for ${injectionScope}`);
        }
      });
      return injections;
    } else {
      console.info(`No injections found for ${scopeName}`);
    }
    return [];
  }
}

/** initialize everything; main entry point */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel
  outputChannel = vscode.window.createOutputChannel("MD Prettify Debug"); // Re-add output channel creation
  context.subscriptions.push(outputChannel); // Re-add output channel to subscriptions

  function registerTextEditorCommand(commandId: string, run: (editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => void): void {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(commandId, run));
  }
  function registerCommand(commandId: string, run: (...args: any[]) => void): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
  }

  registerTextEditorCommand('mdPrettify.copyWithSubstitutions', copyWithSubstitutions);
  registerCommand('mdPrettify.disablePrettySymbols', disablePrettySymbols);
  registerCommand('mdPrettify.enablePrettySymbols', enablePrettySymbols);
  registerCommand('mdPrettify.togglePrettySymbols', (editor: vscode.TextEditor) => {
    if (prettySymbolsEnabled) {
      disablePrettySymbols();
    } else {
      enablePrettySymbols();
    }
  });

  // registerCommand('extension.disablePrettySymbols', () => { vscode.window.showErrorMessage('Command "extension.disablePrettySymbols" is deprecated; use "mdPrettify.disablePrettySymbols" instead.') });
  // registerCommand('extension.enablePrettySymbols', () => { vscode.window.showErrorMessage('Command "extension.enablePrettySymbols" is deprecated; use "mdPrettify.enablePrettySymbols" instead.') });
  // registerCommand('extension.togglePrettySymbols', () => { vscode.window.showErrorMessage('Command "extension.togglePrettySymbols" is deprecated; use "mdPrettify.togglePrettySymbols" instead.') });

  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(selectionChanged));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(onConfigurationChanged));

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(changeActiveTextEditor));

  reloadConfiguration();

  // const result: api.mdPrettify = {
  //   onDidEnabledChange: function (handler: (enabled: boolean) => void): vscode.Disposable {
  //     onEnabledChangeHandlers.add(handler);
  //     return {
  //       dispose() {
  //         onEnabledChangeHandlers.delete(handler);
  //       }
  //     }
  //   },
  //   isEnabled: function (): boolean {
  //     return prettySymbolsEnabled;
  //   },
  //   registerSubstitutions: function (substitutions: api.LanguageEntry): vscode.Disposable {
  //     additionalSubstitutions.add(substitutions);
  //     // TODO: this could be smart about not unloading & reloading everything 
  //     reloadConfiguration();
  //     return {
  //       dispose() {
  //         additionalSubstitutions.delete(substitutions);
  //       }
  //     }
  //   }
  // };

  // return result;
}

function copyWithSubstitutions(editor: vscode.TextEditor) {
  try {
    if (!editor)
      return;
    const prettyDoc = documents.get(editor.document.uri);
    if (prettyDoc)
      prettyDoc.copyDecorated(editor);
  } catch (e) {
  }
}

function changeActiveTextEditor(editor: vscode.TextEditor) {
  try {
    if (!editor)
      return;
    const prettyDoc = documents.get(editor.document.uri);
    if (prettyDoc)
      prettyDoc.gotFocus(editor);
  } catch (e) {
  }
}


/** A text editor selection changed; forward the event to the relevant document */
function selectionChanged(event: vscode.TextEditorSelectionChangeEvent) {
  try {
    const prettyDoc = documents.get(event.textEditor.document.uri);
    if (prettyDoc)
      prettyDoc.selectionChanged(event.textEditor);
  } catch (e) {
    console.error(e);
  }
}

/** Te user updated their settings.json */
function onConfigurationChanged() {
  reloadConfiguration();
}

/** Re-read the settings and recreate substitutions for all documents */
function reloadConfiguration() {
  try {
    // Initialize TextMate registry
    try {
      console.info('Initializing TextMate registry');
      loadedGrammars.clear(); // Clear cached grammars
      textMateRegistry = tm.createRegistry(grammarLocator);
      console.info('TextMate registry initialized successfully');
    } catch (err) {
      textMateRegistry = undefined;
      console.error('Failed to initialize TextMate registry:', err);
    }
  } catch (err) {
    textMateRegistry = undefined;
    console.error('Error in reloadConfiguration:', err);
  }

  const configuration = vscode.workspace.getConfiguration("mdPrettify");
  settings = {
    substitutions: configuration.get<LanguageEntry[]>("substitutions", []),
    revealOn: configuration.get<UglyRevelation>("revealOn", "cursor"),
    adjustCursorMovement: configuration.get<boolean>("adjustCursorMovement", false),
    prettyCursor: configuration.get<PrettyCursor>("prettyCursor", "boxed"),
    hideTextMethod: configuration.get<HideTextMethod>("hideTextMethod", "hack-letterSpacing"),
    debug: configuration.get<boolean>("debug", false),
  };

  // Set default values for language-properties that were not specified
  for (const language of settings.substitutions) {
    if (language.revealOn === undefined)
      language.revealOn = settings.revealOn;
    if (language.adjustCursorMovement === undefined)
      language.adjustCursorMovement = settings.adjustCursorMovement;
    if (language.prettyCursor === undefined)
      language.prettyCursor = settings.prettyCursor;
    if (language.combineIdenticalScopes === undefined)
      language.combineIdenticalScopes = true;
  }

  // Recreate the documents
  unloadDocuments();
  for (const doc of vscode.workspace.textDocuments) {
    console.log(`Opening document ${doc.fileName}`);
    openDocument(doc);
  }
}

export function refreshPage() {
  disablePrettySymbols();
  enablePrettySymbols();
}

function disablePrettySymbols() {
  prettySymbolsEnabled = false;
  onEnabledChangeHandlers.forEach(h => h(false));
  unloadDocuments();
}

function enablePrettySymbols() {
  prettySymbolsEnabled = true;
  onEnabledChangeHandlers.forEach(h => h(true));
  reloadConfiguration();
}


/** Attempts to find the best-matching language entry for the language-id of the given document.
 * @param the document to match
 * @returns the best-matching language entry, or else `undefined` if none was found */
function getLanguageEntry(doc: vscode.TextDocument): LanguageEntry {
  const rankings = settings.substitutions
    .map((entry) => ({ rank: vscode.languages.match(entry.language, doc), entry: entry }))
    .filter(score => score.rank > 0)
    .sort((x, y) => (x.rank > y.rank) ? -1 : (x.rank == y.rank) ? 0 : 1);

  let entry: LanguageEntry = rankings.length > 0
    ? Object.assign({}, rankings[0].entry)
    : {
      language: doc.languageId,
      substitutions: [],
      adjustCursorMovement: settings.adjustCursorMovement,
      revealOn: settings.revealOn,
      prettyCursor: settings.prettyCursor,
      combineIdenticalScopes: true,
    };

  for (const language of additionalSubstitutions) {
    if (vscode.languages.match(language.language, doc) > 0) {
      entry.substitutions.push(...language.substitutions);
    }
  }

  return entry;
}

async function loadGrammar(scopeName: string): Promise<any> {
  console.info(`Loading grammar for scope: ${scopeName}`);

  if (!textMateRegistry) {
    console.warn(`TextMate registry not available, cannot load grammar for ${scopeName}`);
    return undefined;
  }

  // Проверяем кэш
  if (loadedGrammars.has(scopeName)) {
    console.info(`Using cached grammar for ${scopeName}`);
    return loadedGrammars.get(scopeName);
  }

  try {
    const grammar = await textMateRegistry.loadGrammar(scopeName);
    if (grammar) {
      console.info(`Successfully loaded grammar for ${scopeName}`);
      loadedGrammars.set(scopeName, grammar);
      return grammar;
    } else {
      console.warn(`Grammar not found for ${scopeName}`);
      return undefined;
    }
  } catch (err) {
    console.error(`Exception in loadGrammar for ${scopeName}:`, err);
    return undefined;
  }
}

async function openDocument(doc: vscode.TextDocument) {
  // Check if a controller is already being created or exists
  if (documents.has(doc.uri)) {
    console.log(`Controller already exists or is being created for ${doc.uri}, skipping.`);
    return; // Already handled or in progress
  }

  if (!prettySymbolsEnabled) {
    console.log(`Pretty symbols disabled, not opening ${doc.fileName}`);
    return;
  }

  const entry = getLanguageEntry(doc);
  if (!entry) {
    console.log(`No language entry for ${doc.fileName}, not opening`);
    return;
  }

  console.log(`Attempting to create controller for ${doc.uri}`);
  const options: {
    hideTextMethod: HideTextMethod;
    debug: boolean;
    textMateGrammar?: tm.IGrammar | null;
    outputChannel: vscode.OutputChannel; // Re-add outputChannel to options type
  } = {
    hideTextMethod: settings.hideTextMethod,
    textMateGrammar: undefined,
    debug: settings.debug,
    outputChannel: outputChannel, // Re-add outputChannel
  };

  let grammar: tm.IGrammar | null = null;
  // Check if any substitution uses scopes OR if textMate properties are defined

  const scopeName = entry.textMateInitialScope || getLanguageScopeName(doc.languageId); // Use override if present
  console.info(`Attempting to load TextMate grammar for scope ${scopeName}`);
  try {
    grammar = await loadGrammar(scopeName); // Async operation
    if (grammar) {
      console.info(`Successfully loaded TextMate grammar for scope ${scopeName}`);
    } else {
      console.warn(`Could not load TextMate grammar for scope ${scopeName}`);
    }
  } catch (err) {
    console.error(`Error loading TextMate grammar for scope ${scopeName}:`, err);
  }
  options.textMateGrammar = grammar;

  // --- Re-check after await ---
  // Check *again* after the async grammar loading, in case another call completed
  // while this one was waiting.
  if (documents.has(doc.uri)) {
    console.log(`Controller was created for ${doc.uri} while waiting for grammar, skipping duplicate creation.`);
    return;
  }

  // --- Create and store the controller ---
  try {
    console.log(`Proceeding with controller creation for ${doc.uri}`);
    // Ensure the document didn't close while we were loading grammar
    if (doc.isClosed) {
      console.log(`Document ${doc.uri} closed while loading grammar, aborting controller creation.`);
      return;
    }
    const controller = new PrettyDocumentController(doc, entry, options);
    documents.set(doc.uri, controller);
    console.log(`Controller created and stored for ${doc.uri}`);
  } catch (err) {
    // Clean up if creation failed? Map entry wasn't added yet.
    console.error(`Error creating PrettyDocumentController for ${doc.uri}:`, err);
  }
}

function closeDocument(doc: vscode.TextDocument) {
  const prettyDoc = documents.get(doc.uri);
  if (prettyDoc) {
    prettyDoc.dispose();
    documents.delete(doc.uri);
  }
}

function unloadDocuments() {
  for (const prettyDoc of documents.values()) {
    prettyDoc.dispose();
  }
  documents.clear();
}

/** clean-up; this extension is being unloaded */
export function deactivate() {
  onEnabledChangeHandlers.forEach(h => h(false));
  unloadDocuments();
}

