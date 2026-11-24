/**
 * The document store: one open document and the map built from it — its lines
 * and where each line starts. Nothing about rules, decoration or grammar: each
 * of those features keeps its own store.
 */
import { types as t } from 'mobx-state-tree';
import type { Instance } from 'mobx-state-tree';
import { registerActions } from '@md-prettify/utils';
import type { Disposable, TextDocument } from '@md-prettify/types';
import { refreshDocumentAction } from './actions/lifecycle';

const DocumentStoreBase = t
	.model('DocumentStore', {
		/** The document's lines, split once when the document is loaded. */
		lines: t.frozen<string[]>([]),
		/** The index each line starts at in the document text. */
		lineStarts: t.frozen<number[]>([]),
	})
	.volatile(() => ({
		/** The document as the ide reported it: a live object, not a snapshot. */
		document: {} as TextDocument,
		/** The ide subscriptions that keep the map up to date: live disposables. */
		subscriptions: [] as Disposable[],
	}))
	.views((self) => ({
		/** languageId: the language the ide declared for the document. */
		get languageId(): string {
			return self.document.languageId;
		},
		/** lineCount: how many lines the document map holds. */
		get lineCount(): number {
			return self.lines.length;
		},
	}));

/** The document store the orchestrators read and the actions write. */
export type DocumentStore = Instance<typeof DocumentStoreBase>;

export const DocumentStoreModel = DocumentStoreBase.actions((self) =>
	registerActions(self, {
		refresh: refreshDocumentAction,
	}),
);
