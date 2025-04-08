/**
 * Local type declarations for the `webstorm` module.
 *
 * Mirrors the `vscode` surface the adapter uses, so the WebStorm adapter is a
 * drop-in twin of the VS Code one. The real `webstorm` module is injected by
 * the IDE at runtime (there is no npm package to install); this file only
 * gives the TypeScript compiler the shape it needs.
 */
declare module 'webstorm' {
	export interface Position {
		readonly line: number;
		readonly character: number;
	}
	export const Position: {
		new (line: number, character: number): Position;
	};

	export interface Range {
		readonly start: Position;
		readonly end: Position;
	}
	export const Range: {
		new (start: Position, end: Position): Range;
	};

	export interface Selection {
		readonly anchor: Position;
		readonly active: Position;
	}
	export const Selection: {
		new (anchor: Position, active: Position): Selection;
	};

	export interface TextLine {
		readonly text: string;
		readonly range: Range;
		readonly rangeIncludingLineBreak: Range;
		readonly lineNumber: number;
		readonly firstNonWhitespaceCharacterIndex: number;
	}

	export interface TextDocument {
		readonly uri: Uri;
		readonly languageId: string;
		readonly fileName: string;
		readonly isClosed: boolean;
		readonly lineCount: number;
		getText(range?: Range): string;
		lineAt(line: number): TextLine;
		positionAt(offset: number): Position;
		offsetAt(position: Position): number;
		validateRange(range: Range): Range;
	}

	export interface TextEditorDecorationType {
		dispose(): void;
	}

	export interface DecorationRenderOptions {
		rangeBehavior?: DecorationRangeBehavior;
		color?: string;
		letterSpacing?: string;
		fontStyle?: string;
		fontWeight?: string;
		backgroundColor?: string;
		outline?: string;
		border?: string;
		borderRadius?: string;
		textDecoration?: string;
		cursor?: string;
		before?: { contentText?: string; color?: string; backgroundColor?: string };
		after?: { contentText?: string; color?: string; backgroundColor?: string };
		dark?: DecorationRenderOptions;
		light?: DecorationRenderOptions;
	}

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

	export interface ConfigurationChangeEvent {
		affectsConfiguration(section: string): boolean;
	}

	export interface Disposable {
		dispose(): void;
	}

	export interface OutputChannel {
		appendLine(value: string): void;
		dispose(): void;
	}

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
		onDidChangeTextDocument(
			cb: (e: { document: TextDocument; contentChanges: { range: Range; text: string }[] }) => void,
		): Disposable;
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
