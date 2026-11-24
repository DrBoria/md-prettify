/**
 * The document lifecycle action: it builds the map of one open document — its
 * lines and where each line starts — every other feature reads.
 */
import type { TextDocument } from '@md-prettify/types';
import { lineStartsOf } from '@md-prettify/utils';
import type { DocumentStore } from '../store';

/**
 * refreshDocumentAction: rebuilds the document map from the document the ide
 * reports, on open and after every edit.
 * @param {DocumentStore} self the document store being written
 * @param {TextDocument} doc the document as the ide reports it now
 */
export function refreshDocumentAction(self: DocumentStore, doc: TextDocument): void {
	self.document = doc;
	self.lines = doc.text.split('\n');
	self.lineStarts = lineStartsOf(doc.text);
}
