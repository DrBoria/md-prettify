import type { TextDocument, TextEditor, TextDocumentChange, Range } from '../host';
import { rangeIntersection } from '../host';
import type { UpdateDecorationEntry, UpdateDecorationInstanceEntry } from './type';
import { logError, logWarn } from '../config/logger';
import type { DocumentStore } from './type';

/** All visible editors showing the controlled document. */
export const getEditors = (state: DocumentStore): TextEditor[] => {
  const editors: TextEditor[] = [];
  for (const editor of state.host.visibleTextEditors) {
    if (editor && editor.document && editor.document.uri === state.document?.uri) editors.push(editor);
  }
  return editors;
};

/** Applies one decoration entry's ranges to one editor, skipping revealed ranges. */
const applyDecorationEntry = (state: DocumentStore, editor: TextEditor, d: UpdateDecorationEntry, reveal: Range[]): void => {
  if (d && d.decoration) {
    const visible: Range[] = [];
    for (const r of d.ranges) {
      let intersectsReveal = false;
      for (const s of reveal) {
        if (rangeIntersection(s, r) !== null) { intersectsReveal = true; break; }
      }
      if (!intersectsReveal) visible.push(r);
    }
    editor.setDecorations(d.decoration, visible)
  } else {
    logWarn(`Skipping invalid decoration entry in applyActiveEditorDecorations for ${state.document?.uri}`);
  }
};

/** Computes the reveal ranges: explicit ones, or derived from the active editor's selections. */
const computeRevealRanges = (state: DocumentStore, prettyModel: NonNullable<DocumentStore['prettyModel']>, document: NonNullable<DocumentStore['document']>, revealRanges?: Range[]): Range[] => {
  if (revealRanges) return revealRanges;
  const activeEditor = state.host.activeTextEditor;
  const currentSelections = activeEditor?.document?.uri === document.uri
    ? activeEditor.selections
    : [];
  return prettyModel.revealSelections(currentSelections).ranges;
};

/** Applies every decoration entry to one open editor. */
const applyEntriesToEditor = (state: DocumentStore, editor: TextEditor, decs: UpdateDecorationEntry[], reveal: Range[]): void => {
  for (const d of decs) {
    applyDecorationEntry(state, editor, d, reveal);
  }
};

/** Whether the editor is usable for decoration updates. */
const isEditorUsable = (editor: TextEditor | undefined): boolean =>
  !!editor && !!editor.document && !editor.document.isClosed;

/** The debounced decoration-application body. */
const runDecorationUpdate = (
  state: DocumentStore,
  editors: Iterable<TextEditor>,
  decs: UpdateDecorationEntry[],
  revealRanges?: Range[],
): void => {
  if (!state.prettyModel || !state.document) return;
  try {
    const reveal = computeRevealRanges(state, state.prettyModel, state.document, revealRanges);

    for (const editor of editors) {
      if (!isEditorUsable(editor)) continue;
      applyEntriesToEditor(state, editor, decs, reveal);
    }
  } catch (err) {
    logError(`Error in applyActiveEditorDecorations callback for ${state.document?.uri}:`, err)
  }
};

/** Debounced application of decorations to the given editors plus the active one. */
export const applyActiveEditorDecorations = (
  state: DocumentStore,
  editors: Iterable<TextEditor>,
  decs: UpdateDecorationEntry[],
  revealRanges?: Range[],
  _prettyCursors?: UpdateDecorationInstanceEntry,
): void => {
  if (!state.prettyModel || !state.document) return;
  state.updateActiveEditor.call(function () {
    runDecorationUpdate(state, editors, decs, revealRanges);
  });
};

/** Stores the decorations and applies them to the given editors plus the active one. */
export const applyDecorations = (state: DocumentStore, editors: Iterable<TextEditor>, decs: UpdateDecorationEntry[]): void => {
  if (!state.prettyModel || !state.document) return;
  state.currentDecorations.replace(decs);
  const activeEditor = state.host.activeTextEditor;
  const editorSet = new Set(editors);
  if (activeEditor && activeEditor.document.uri === state.document.uri) {
    editorSet.add(activeEditor);
  }
  applyActiveEditorDecorations(state, Array.from(editorSet), decs);
};

/** Applies the document changes to the model and reapplies the decorations. */
export const onChangeDocument = (state: DocumentStore, document: TextDocument, changes: TextDocumentChange[]): void => {
  if (!state.prettyModel || !state.document || document.uri !== state.document.uri) return;

  state.prettyModel.applyChanges(changes);
  state.prettyModel.recomputeDecorations();

  applyDecorations(state, getEditors(state), Array.from(state.prettyModel.getDecorationsList()));
};

/** Recomputes the decorations and reapplies them to all editors of the document. */
export const refresh = (state: DocumentStore): void => {
  if (!state.prettyModel || !state.document) return;
  state.prettyModel.recomputeDecorations();
  applyDecorations(state, getEditors(state), Array.from(state.prettyModel.getDecorationsList()));
};
