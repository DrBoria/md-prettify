/**
 * Local type declarations for the `webstorm` module.
 *
 * Mirrors the `vscode` surface the adapter uses, so the WebStorm adapter is a
 * drop-in twin of the VS Code one. The real `webstorm` module is injected by
 * the IDE at runtime (there is no npm package to install); this file only
 * gives the TypeScript compiler the shape it needs.
 */
declare module 'webstorm' {
	export type Position = import('@md-prettify/types').Position;
	export const Position: {
		new (line: number, character: number): Position;
	};

	export type Range = import('@md-prettify/types').Range;
	export const Range: {
		new (start: Position, end: Position): Range;
	};

	export type Selection = import('@md-prettify/types').Selection;
	export const Selection: {
		new (anchor: Position, active: Position): Selection;
	};

	export type TextDocument = import('@md-prettify/types').IdeTextDocument & {
		readonly uri: Uri;
	};

	// The decoration shapes are the backend's own contract: the adapter hands the
	// same options to the IDE that the engine built, so the types are reused, not
	// mirrored.
	export type TextEditorDecorationType = import('@md-prettify/types').TextEditorDecorationType;

	export type DecorationRenderOptions = Omit<import('@md-prettify/types').DecorationRenderOptions, 'rangeBehavior' | 'dark' | 'light'> & {
		rangeBehavior?: DecorationRangeBehavior | import('@md-prettify/types').DecorationRangeBehaviorValue;
		dark?: DecorationRenderOptions;
		light?: DecorationRenderOptions;
	};

	export interface TextEditor {
		readonly document: TextDocument;
		selections: Selection[];
		readonly visibleRanges: Range[];
		setDecorations(type: TextEditorDecorationType, ranges: Range[]): void;
	}

	export interface TextEditorSelectionEvent {
		readonly textEditor: TextEditor;
		readonly selections: Selection[];
	}

	export type ConfigurationChangeEvent = import('@md-prettify/types').ConfigurationChangeEvent;

	export type Disposable = import('@md-prettify/types').Disposable;

	export type OutputChannel = import('@md-prettify/types').OutputChannel;

	export interface Extension {
		readonly extensionUri: Uri;
		readonly packageJSON: {
			contributes?: {
				languages?: {
					id?: string;
					grammarPath?: string;
				}[];
				grammars?: {
					scopeName?: string;
					language?: string;
					path?: string;
					injectionSelector?: string;
				}[];
			};
		};
	}

	export interface ExtensionContext {
		readonly subscriptions: Disposable[];
		readonly extensionUri: Uri;
	}

	export enum DecorationRangeBehavior {
		OpenOpen = 1,
		ClosedClosed = 2,
		OpenClosed = 3,
		ClosedOpen = 4,
	}

	export const commands: {
		registerCommand(id: string, cb: (...args: unknown[]) => unknown): Disposable;
		executeCommand(id: string, ...args: unknown[]): unknown;
	};

	export const workspace: {
		readonly textDocuments: TextDocument[];
		readonly workspaceFolders: { uri: Uri }[] | undefined;
		getConfiguration(section: string): unknown;
		onDidOpenTextDocument(cb: (doc: TextDocument) => void): Disposable;
		onDidCloseTextDocument(cb: (doc: TextDocument) => void): Disposable;
		onDidChangeTextDocument(cb: (e: { document: TextDocument; contentChanges: { range: Range; text: string }[] }) => void): Disposable;
		onDidChangeConfiguration(cb: (e: ConfigurationChangeEvent) => void): Disposable;
	};

	export const window: {
		readonly visibleTextEditors: TextEditor[];
		readonly activeTextEditor: TextEditor | null;
		readonly state: { focused: boolean };
		onDidChangeActiveTextEditor(cb: (e: TextEditor | null) => void): Disposable;
		onDidChangeTextEditorSelection(cb: (e: TextEditorSelectionEvent) => void): Disposable;
		createOutputChannel(name: string): OutputChannel;
		createTextEditorDecorationType(options: DecorationRenderOptions): TextEditorDecorationType;
	};

	export const languages: {
		match(language: string | string[], doc: TextDocument): number;
	};

	export const extensions: {
		readonly all: Extension[];
	};

	export const env: {
		clipboard: { writeText(text: string): Promise<void> };
	};

	export interface Uri {
		readonly fsPath: string;
		toString(): string;
	}
	export const Uri: {
		readonly parse: (value: string) => Uri;
		readonly joinPath: (base: Uri, path: string) => Uri;
	};
}
