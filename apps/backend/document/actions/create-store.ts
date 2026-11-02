import type { Host, TextDocument, Disposable } from "../../host";
import type { LanguageEntry } from "../../store.d/type";
import type { ControllerOptions, DocumentStore } from "../type";
import { activeEditorDecorationTimeout, createDebounce, updateSelectionTimeout, createDocumentModel } from "@md-prettify/utils";



/**
 * Registers one document store on the root store: the document's fields are
 * filled from the caller's parameters and added to `documents`, never a
 * second copy.
 */
export const registerDocumentStoreAction = (state: DocumentStore, host: Host, doc: TextDocument, settings: LanguageEntry, options: ControllerOptions): void => {
  state.document = createDocumentModel({ document: doc });
  state.textDocument = doc;
  state.host = host;
  state.prettySubstitutions = new Set();
  state.decorationCache = new Map();
  state.hiddeDecorationsRanges = new Set();
  state.lineIndex = new Map();
  state.rangeKeyToCacheKey = new Map();
  state.changedUglies = false;
  state.hiddenDecoration = null;
  state.revealedUglyDecoration = null;
  state.boxedSymbolDecoration = null;
  state.debug = options.debug;
  state.outputChannel = options.outputChannel;
  state.defaultScope = settings.textMateInitialScope ?? "";
  state.excludedScopes = new Set(settings.excludedScopes ?? []);
  state.hideTextMethod = options.hideTextMethod;
  state.revealStrategy = settings.revealOn ?? "cursor";
  state.prettyCursor = settings.prettyCursor ?? "boxed";
  state.disabledLines = new Set<number>();
  state.prettyModel = null;
  state.subscriptions = [] as Disposable[];
  state.currentDecorations.clear();
  state.updateActiveEditor = createDebounce(activeEditorDecorationTimeout);
  state.updateSelection = createDebounce(updateSelectionTimeout);
  state.adjustCursorMovement = false;
  state.lastSelections = new Map();
  state.revealedRanges.clear();
  state.cursorRanges.clear();
  state.grammar = options.textMateGrammar ?? null;
  state.grammarState = [];
};
