/** The ide contract an IDE adapter implements, plus the ide-like shapes it converts from. */
import type { ContentBlock } from './document';
import type { Range } from './index';
import type { TextDocument, EditorSnapshot, TextEditorSelectionEvent } from './document';
import type { DecorationRenderOptions, TextEditorDecorationType } from './decorations';
import type { ConfigurationChangeEvent, Disposable, OutputChannel } from './config';

/** An installed extension/plugin as any supported IDE reports it. */
export interface IdeExtension {
	readonly extensionUri: { readonly fsPath: string };
	readonly packageJSON?: {
		contributes?: {
			languages?: readonly { id?: string; grammarPath?: string }[];
			grammars?: readonly {
				scopeName?: string;
				language?: string;
				path?: string;
				injectionSelector?: string;
			}[];
		};
	};
}

/** A single text change reported by the IDE for a document. */
export interface TextDocumentChange {
	readonly range: Range;
	readonly text: string;
}

/** How the ugly text is hidden behind the pretty symbol. */
export type HideTextMethod = 'hack-fontSize' | 'hack-letterSpacing' | 'none';

/** The IDE surface the backend talks to; an adapter implements it per IDE. */
export interface Ide {
	/** @param {string} id the command id to register
	 *  @param {Function} handler the callback the IDE invokes */
	registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;

	/** All currently open text documents. */
	readonly textDocuments: TextDocument[];

	/** All visible editors. */
	readonly visibleTextEditors: EditorSnapshot[];

	/** The active editor, or null. */
	readonly activeTextEditor: EditorSnapshot | null;

	/** @param {string} section the configuration section to read */
	getConfiguration(section: string): unknown;

	/** @param {string|string[]} language a language selector
	 *  @param {TextDocument} document the document to score against */
	matchLanguage(language: string | string[], document: TextDocument): number;

	/** Every extension/plugin the IDE has installed, as it reports them. */
	getInstalledExtensions(): IdeExtension[];

	/** @param {string} text the text to put on the system clipboard */
	copyToClipboard(text: string): Promise<void>;

	/** @param {DecorationRenderOptions} options how the decoration should look */
	createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;

	/** @param {EditorSnapshot} editor the editor to paint
	 *  @param {TextEditorDecorationType} decorationType the decoration to paint
	 *  @param {Range[]} ranges the spans to paint it on */
	setDecorations(editor: EditorSnapshot, decorationType: TextEditorDecorationType, ranges: Range[]): void;

	/** @param {string} name the channel name shown in the IDE */
	createOutputChannel(name: string): OutputChannel;

	/** @param {Function} listener called when a document opens */
	onDidOpenTextDocument(listener: (document: TextDocument) => void): Disposable;

	/** @param {Function} listener called when a document closes */
	onDidCloseTextDocument(listener: (document: TextDocument) => void): Disposable;

	/** @param {Function} listener called when a document changes */
	onDidChangeTextDocument(listener: (document: TextDocument, changes: TextDocumentChange[]) => void): Disposable;

	/** @param {Function} listener called when configuration changes */
	onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable;

	/** @param {Function} listener called when the active editor changes */
	onDidChangeActiveTextEditor(listener: (editor: EditorSnapshot | null) => void): Disposable;

	/** @param {Function} listener called when the selections change */
	onDidChangeTextEditorSelection(listener: (event: TextEditorSelectionEvent) => void): Disposable;
}

// ---------------------------------------------------------------------------
// TextMate grammar shapes
// ---------------------------------------------------------------------------

/** A position as any supported IDE produces it. */
export interface IdePosition {
	readonly line: number;
	readonly character: number;
}

/** A range as any supported IDE produces it. */
export interface IdeRange {
	readonly start: IdePosition;
	readonly end: IdePosition;
}

/** A selection as any supported IDE produces it. */
export interface IdeSelection {
	readonly anchor: IdePosition;
	readonly active: IdePosition;
}

/** The constructors an IDE module offers for its geometry types. */
export interface IdeGeometryApi<TPosition extends IdePosition, TRange extends IdeRange, TSelection extends IdeSelection> {
	Position: new (line: number, character: number) => TPosition;
	Range: new (start: TPosition, end: TPosition) => TRange;
	Selection: new (anchor: TPosition, active: TPosition) => TSelection;
}

/** A text document as any supported IDE produces it. */
export interface IdeTextDocument {
	readonly uri: { toString(): string };
	readonly languageId: string;
	readonly fileName: string;
	readonly isClosed: boolean;
	readonly lineCount: number;
	getText(): string;
}

/** A text editor as any supported IDE produces it. */
export interface IdeTextEditor<TRange extends IdeRange, TSelection extends IdeSelection> {
	readonly document: IdeTextDocument;
	readonly selections: readonly TSelection[];
	readonly visibleRanges: readonly TRange[];
}

/** The range-behavior enum an IDE module offers. */
export interface IdeDecorationApi<TBehavior> {
	readonly DecorationRangeBehavior: {
		readonly OpenOpen: TBehavior;
		readonly ClosedClosed: TBehavior;
		readonly OpenClosed: TBehavior;
		readonly ClosedOpen: TBehavior;
	};
}

/** Render options shaped like the IDE's own options. */
export type IdeDecorationOptions<TBehavior> = Omit<DecorationRenderOptions, 'rangeBehavior' | 'before' | 'after' | 'dark' | 'light'> & {
	rangeBehavior?: TBehavior;
	before?: ContentBlock;
	after?: ContentBlock;
	dark?: IdeDecorationOptions<TBehavior>;
	light?: IdeDecorationOptions<TBehavior>;
};

/** The payload an IDE reports for a text-document change. */
export interface IdeChangeEvent<TRange extends IdeRange> {
	readonly document: IdeTextDocument;
	readonly contentChanges: readonly {
		readonly range: TRange;
		readonly text: string;
	}[];
}

/** The payload an IDE reports for a configuration change. */
export interface IdeConfigurationChange {
	readonly affectsConfiguration: (section: string) => boolean;
}

/** The payload an IDE reports for a selection change. */
export interface IdeSelectionEvent<TRange extends IdeRange, TSelection extends IdeSelection> {
	readonly textEditor: IdeTextEditor<TRange, TSelection>;
	readonly selections: readonly TSelection[];
}

/** The event surface an IDE module offers. */
export interface IdeEventsApi<
	TPosition extends IdePosition,
	TRange extends IdeRange,
	TSelection extends IdeSelection,
> extends IdeGeometryApi<TPosition, TRange, TSelection> {
	readonly workspace: {
		onDidOpenTextDocument(listener: (document: IdeTextDocument) => void): Disposable;
		onDidCloseTextDocument(listener: (document: IdeTextDocument) => void): Disposable;
		onDidChangeTextDocument(listener: (event: IdeChangeEvent<TRange>) => void): Disposable;
		onDidChangeConfiguration(listener: (event: IdeConfigurationChange) => void): Disposable;
	};
	readonly window: {
		onDidChangeActiveTextEditor(listener: (editor: IdeTextEditor<TRange, TSelection> | null) => void): Disposable;
		onDidChangeTextEditorSelection(listener: (event: IdeSelectionEvent<TRange, TSelection>) => void): Disposable;
	};
}
