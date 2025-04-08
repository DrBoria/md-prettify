import type { Disposable } from '../host';
import { logInfo, logWarn } from '../config/logger';
import { getHost, reloadConfiguration } from '../config/settings';
import { getDocument, unloadAllDocuments } from '../document/manager';
import { requireRootStore } from '../store';

export type OnEnabledChangeHandler = (enabled: boolean) => void;

export function onEnabledChange(handler: OnEnabledChangeHandler): Disposable {
  const root = requireRootStore();
  root.enabledHandlers.add(handler);
  return {
    dispose() {
      root.enabledHandlers.delete(handler);
    },
  };
}

export function notifyEnabledChange(enabled: boolean): void {
  for (const h of requireRootStore().enabledHandlers) h(enabled);
}

export function setEnabled(value: boolean): void {
  const root = requireRootStore();
  if (root.enabled === value) return;
  root.enabled = value;
  if (!value) unloadAllDocuments();
  else reloadConfiguration();
  notifyEnabledChange(value);
}

export function enablePrettySymbols(): void {
  setEnabled(true);
}

export function disablePrettySymbols(): void {
  setEnabled(false);
}

/**
 * Toggles pretty symbols on the line under the active editor's cursor.
 * Unlike enable/disable, this is per-line: the rest of the file keeps
 * rendering normally.
 */
export function togglePrettySymbols(): void {
  const host = getHost();
  const editor = host?.activeTextEditor;
  if (!editor) {
    logWarn('togglePrettySymbols: no active editor');
    return;
  }
  const controller = getDocument(editor.document);
  if (!controller) {
    logInfo(`togglePrettySymbols: no controller for ${editor.document.fileName}`);
    return;
  }
  const line = editor.selections[0]?.active.line;
  if (line === undefined) {
    logWarn('togglePrettySymbols: no cursor position');
    return;
  }
  const disabled = controller.toggleLine(line);
  logInfo(`togglePrettySymbols: line ${line} ${disabled ? 'disabled' : 'enabled'}`);
}
