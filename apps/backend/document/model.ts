import type { TextDocument, Range } from '../host';
import { rangeFrom } from '../host';
import type { DocumentView } from './type';

type DocumentModelData = { document: TextDocument | null };

/** Builds the read-only document view the PrettyModel operates on. */
export const createDocumentModel = (state: DocumentModelData): DocumentView => ({
  uri: state.document?.uri ?? '',
  getText(range?: Range): string {
    return state.document?.getText(range) ?? '';
  },
  getLine(line: number): string {
    return state.document?.lineAt(line)?.text ?? '';
  },
  getLineRange(line: number): Range {
    return state.document?.lineAt(line)?.range ?? rangeFrom(line, 0, line, 0);
  },
  getLineCount(): number {
    return state.document?.lineCount ?? 0;
  },
  validateRange(range: Range): Range {
    return state.document?.validateRange(range) ?? range;
  },
});
