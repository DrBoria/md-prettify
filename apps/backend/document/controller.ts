import type { Host, Disposable, TextDocument, TextEditor, Selection } from '../host';
import type { LanguageEntry } from '../config/configuration';
import { logInfo } from '../config/logger';
import type { DocumentStore } from './type';
import type { ControllerOptions } from './type';
import { DocumentStoreModel, disposeController, initializeController, getDecorationsList, toggleLine } from './store';
import { createDebounce, activeEditorDecorationTimeout, updateSelectionTimeout } from './debounce';
import { createDocumentModel } from './model';
import { getEditors, applyDecorations, refresh } from './editor-decorations';
import { adjustCursor, selectionChanged } from './cursor';
import { unprotect } from 'mobx-state-tree';

/** The controller facade: a state bag plus the operations that delegate to the `controller-*` modules. */
export interface PrettyDocumentController extends Disposable {
  gotFocus(editor: TextEditor): void;
  copyDecorated(editor: TextEditor): Promise<void>;
  refresh(): void;
  adjustCursor(editor: TextEditor): null | Selection[];
  selectionChanged(editor: TextEditor): void;
  toggleLine(line: number): boolean;
}

const gotFocusAction = (state: DocumentStore, _editor: TextEditor): void => {
  if (!state.prettyModel || !state.document) return;
  applyDecorations(state, getEditors(state), state.currentDecorations);
};

const copyDecoratedAction = (state: DocumentStore, editor: TextEditor): Promise<void> => {
  const model = state.prettyModel;
  if (!model || !state.document) return Promise.resolve();
  const copy: string[] = [];
  for (const sel of editor.selections) copy.push(model.getDecoratedText(sel));
  if (copy.length === 0)
    return Promise.resolve();
  else
    return state.host.copyToClipboard(copy.join('\n'));
};

/** Toggles pretty symbols on the given line (0-based). Returns true if the line was disabled. */
const toggleLineAction = (state: DocumentStore, line: number): boolean => {
  if (!state.prettyModel) return false;
  const toggled = toggleLine(state, line);
  if (toggled) {
    applyDecorations(state, getEditors(state), Array.from(getDecorationsList(state)));
  }
  return toggled;
};

/**
 * Creates the pretty-document controller: a facade over the document store and
 * the functional modules. All logic lives in the store actions; this factory
 * creates the MST instance and wires the facade callbacks.
 */
export const createPrettyDocumentController = (
  host: Host,
  doc: TextDocument,
  settings: LanguageEntry,
  options: ControllerOptions,
): PrettyDocumentController => {
  const state = DocumentStoreModel.create({
    document: createDocumentModel({ document: doc }),
    textDocument: doc,
    host,
    prettySubstitutions: new Set(),
    decorationCache: new Map(),
    hiddeDecorationsRanges: new Set(),
    lineIndex: new Map(),
    rangeKeyToCacheKey: new Map(),
    changedUglies: false,
    hiddenDecoration: null,
    revealedUglyDecoration: null,
    boxedSymbolDecoration: null,
    debug: options.debug,
    outputChannel: options.outputChannel,
    defaultScope: settings.textMateInitialScope ?? '',
    excludedScopes: new Set(settings.excludedScopes ?? []),
    hideTextMethod: options.hideTextMethod,
    revealStrategy: settings.revealOn ?? 'cursor',
    prettyCursor: settings.prettyCursor ?? 'boxed',
    disabledLines: new Set(),
    prettyModel: null,
    subscriptions: [],
    currentDecorations: [],
    updateActiveEditor: createDebounce(activeEditorDecorationTimeout),
    updateSelection: createDebounce(updateSelectionTimeout),
    adjustCursorMovement: false,
    lastSelections: new Map(),
    revealedRanges: [],
    cursorRanges: [],
    grammar: null,
    grammarState: [],
  });
  unprotect(state);

  // Skip initialization for the prettify debug output channel
  if (doc.fileName.includes('.md-prettify')) {
    logInfo(`Skipping PrettyDocumentController initialization for debug channel: ${doc.fileName}`);
  } else {
    initializeController(state, settings, options);
  }

  return {
    dispose() {
      disposeController(state);
    },
    gotFocus(editor) {
      gotFocusAction(state, editor);
    },
    copyDecorated(editor) {
      return copyDecoratedAction(state, editor);
    },
    refresh() {
      refresh(state);
    },
    adjustCursor(editor) {
      return adjustCursor(state, editor);
    },
    selectionChanged(editor) {
      selectionChanged(state, editor);
    },
    toggleLine(line) {
      return toggleLineAction(state, line);
    },
  };
};