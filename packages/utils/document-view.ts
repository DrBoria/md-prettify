import type { DocumentView, DocumentModelData } from '@md-prettify/types';
import { rangeFrom } from './range';

/** Builds the read-only document view the engine operates on. */
export const createDocumentModel = (state: DocumentModelData): DocumentView => ({
  uri: state.document?.uri ?? '',
  getText(range) {
    return state.document?.getText(range) ?? '';
  },
  getLine(line: number): string {
    return state.document?.lineAt(line)?.text ?? '';
  },
  getLineRange(line: number) {
    return state.document?.lineAt(line)?.range ?? rangeFrom(line, 0, line, 0);
  },
  getLineCount(): number {
    return state.document?.lineCount ?? 0;
  },
  validateRange(range) {
    return state.document?.validateRange(range) ?? range;
  },
});
