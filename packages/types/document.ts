/** What the backend reads about a document and an editor, plus the decoration content block. */
import type { DecorationRenderOptions } from './decorations';
import type { Range, Selection } from './index';

/**
 * A text document as the backend reads it: the text and the facts about it, no
 * behaviour. Every accessor a caller needs is a plain function in
 * `@md-prettify/utils` that takes this value, so the adapter's only job is to
 * read the IDE's document once.
 */
export interface TextDocument {
	readonly uri: string;
	readonly languageId: string;
	readonly fileName: string;
	readonly isClosed: boolean;
	readonly lineCount: number;

	/** The whole document text. */
	readonly text: string;

	/** The offset of the first character of each line; `lineStarts.length === lineCount`. */
	readonly lineStarts: readonly number[];
}

/** A visible editor, as the backend reads it. */
export interface EditorSnapshot {
	readonly document: TextDocument;

	/** The selections the user currently has, as the ide reported them; a
	 *  snapshot is read-only, so the list the adapter handed over is never
	 *  mutated through it. */
	readonly selections: ReadonlyArray<Selection>;

	/** The currently visible portion of the document (viewport). */
	readonly visibleRanges?: Range[];

	/** The IDE's own editor object; only the adapter's ide functions write through it. */
	readonly native: unknown;
}

/** A selection-change event an IDE reports for one editor. */
export interface TextEditorSelectionEvent {
	readonly editor: EditorSnapshot;
	readonly selections: Selection[];
}

/** A content block of a decoration: the `before`/`after` render options. */
export type ContentBlock = NonNullable<DecorationRenderOptions['before']>;
