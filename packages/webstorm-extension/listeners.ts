/**
 * Event listener registration for the WebStorm adapter.
 *
 * The event *handlers* (open/close document, config change, selection, active
 * editor) live in the backend and are wired to the IDE purely through the
 * `Host` interface. This file is the thin IDE-side entry point that
 * `activate.ts` calls, plus the `onDid*` event adapters that `host-adapter.ts`
 * composes into the `Host` object.
 */
import * as webstorm from 'webstorm';
import type {
  Host,
  TextDocument,
  TextEditor,
  TextDocumentChange,
  ConfigurationChangeEvent,
  TextEditorSelectionEvent,
  Disposable,
} from '../../apps/backend/host';
import {
  toHostTextDocument,
  toHostTextEditor,
  toHostRange,
  toHostSelection,
} from './webstorm';
import { registerListeners as backendRegisterListeners } from '../../apps/backend/index';

export const registerListeners = (host: Host): Disposable[] => {
  return backendRegisterListeners(host);
};

/**
 * The `onDid*` event adapters of the `Host` interface. They close over the
 * decoration map (the two editor events convert editors, which need it), so
 * the map is passed in by `createHost`.
 */
export const createHostEvents = (
  decorationMap: Map<string, webstorm.TextEditorDecorationType>,
) => ({
  onDidOpenTextDocument(listener: (document: TextDocument) => void): Disposable {
    return webstorm.workspace.onDidOpenTextDocument((doc) =>
      listener(toHostTextDocument(doc)),
    );
  },

  onDidCloseTextDocument(listener: (document: TextDocument) => void): Disposable {
    return webstorm.workspace.onDidCloseTextDocument((doc) =>
      listener(toHostTextDocument(doc)),
    );
  },

  onDidChangeTextDocument(
    listener: (document: TextDocument, changes: TextDocumentChange[]) => void,
  ): Disposable {
    return webstorm.workspace.onDidChangeTextDocument((e) => {
      const doc = toHostTextDocument(e.document);
      const changes: TextDocumentChange[] = e.contentChanges.map((c) => ({
        range: toHostRange(c.range),
        text: c.text,
      }));
      listener(doc, changes);
    });
  },

  onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable {
    return webstorm.workspace.onDidChangeConfiguration((e) =>
      listener({
        affectsConfiguration: (section: string) => e.affectsConfiguration(section),
      }),
    );
  },

  onDidChangeActiveTextEditor(
    listener: (editor: TextEditor | null) => void,
  ): Disposable {
    return webstorm.window.onDidChangeActiveTextEditor((e) => {
      listener(e ? toHostTextEditor(e, decorationMap) : null);
    });
  },

  onDidChangeTextEditorSelection(
    listener: (event: TextEditorSelectionEvent) => void,
  ): Disposable {
    return webstorm.window.onDidChangeTextEditorSelection((e) => {
      listener({
        editor: toHostTextEditor(e.textEditor, decorationMap),
        selections: e.selections.map(toHostSelection),
      });
    });
  },
});
