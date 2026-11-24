/**
 * The WebStorm ide adapter: the whole `Ide` surface for WebStorm in one module.
 *
 * Everything here is a thin translation of a WebStorm API into the contract the
 * IDE-agnostic backend calls — the SDK objects are read once into plain
 * snapshots, and the writes (decorations, clipboard, commands) go back through
 * the SDK. Nothing in the application imports this file.
 */
import * as webstorm from 'webstorm';
import { decorationOptionsOf } from './render-options';
import type {
	ConfigurationChangeEvent,
	DecorationRenderOptions,
	Disposable,
	Ide,
	Range,
	IdeChangeEvent,
	IdeConfigurationChange,
	IdeExtension,
	IdeRange,
	IdeSelectionEvent,
	IdeSelection,
	IdeTextDocument,
	IdeTextEditor,
	TextDocument,
	TextDocumentChange,
	EditorSnapshot,
	TextEditorDecorationType,
	TextEditorSelectionEvent,
} from '@md-prettify/types';
import { changesSnapshot, documentSnapshot, editorSnapshot, selectionsSnapshot } from '@md-prettify/utils';

/** createIde: builds the WebStorm implementation of the contract the backend calls. */
export function createIde(): Ide {
	return {
		/** registerCommand: The IDE's command registration, forwarded as-is: the backend decides which
		 *  commands exist, and only the ide can create the disposable.
		 *  @param {string} id the command id the manifest declares
		 *  @param {Function} handler the callback the IDE invokes */
		registerCommand: webstorm.commands.registerCommand.bind(webstorm.commands),

		/** textDocuments: The documents the IDE currently has open, read once into snapshots so the
		 *  backend never holds an SDK object. */
		get textDocuments(): TextDocument[] {
			return webstorm.workspace.textDocuments.map((document) => documentSnapshot(document));
		},

		/** visibleTextEditors: The editors the IDE is showing, as snapshots the backend can read. */
		get visibleTextEditors(): EditorSnapshot[] {
			return webstorm.window.visibleTextEditors.map((editor) => editorSnapshot(editor, editor));
		},

		/** activeTextEditor: The editor with focus, or null: the backend repaints only the document the
		 *  user is looking at. */
		get activeTextEditor(): EditorSnapshot | null {
			const editor = webstorm.window.activeTextEditor;

			return editor ? editorSnapshot(editor, editor) : null;
		},

		/** getConfiguration: The configuration reader, forwarded as-is: the section names belong to the
		 *  backend's settings, so the ide cannot know them.
		 *  @param {string} section the configuration section the backend reads */
		getConfiguration: webstorm.workspace.getConfiguration.bind(webstorm.workspace),

		/** matchLanguage: Why the backend cannot do this itself: matching a language selector against
		 *  a document is the IDE's own rule, and its answer decides which settings a
		 *  document is decorated with.
		 *  @param {string|string[]} language the selector a settings entry declares
		 *  @param {TextDocument} document the document the selector is scored against */
		matchLanguage(language: string | string[], document: TextDocument): number {
			if (!language || (Array.isArray(language) && language.length === 0)) return 0;
			const target = { languageId: document.languageId, uri: webstorm.Uri.parse(document.uri) };

			return webstorm.languages.match(language, target as webstorm.TextDocument);
		},

		/** The installed extensions with their contribution data: the grammar feature
		 *  scans them for the grammar a scope resolves to, so the ide only reports
		 *  what is installed and never picks a file. */
		getInstalledExtensions(): IdeExtension[] {
			const installed = [...webstorm.extensions.all];
			// No installed extension means no grammar is contributed at all: the
			// document then tokenizes as plain text, which is worth reporting once.
			if (installed.length === 0) console.info('no extensions installed: no TextMate grammar can be found');

			return installed;
		},

		/** copyToClipboard: Writes into the system clipboard, which only the IDE can reach.
		 *  @param {string} text the decorated text the user asked to copy */
		async copyToClipboard(text: string): Promise<void> {
			await webstorm.env.clipboard.writeText(text);
		},

		/** createDecorationType: Builds the IDE's own decoration type: the backend keeps the render options,
		 *  the SDK handle stays here (as `native`) so a paint can use it.
		 *  @param {DecorationRenderOptions} options how the decoration should look */
		createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
			if (!options) throw new TypeError('createDecorationType needs the render options');
			const real = webstorm.window.createTextEditorDecorationType(decorationOptionsOf(options));

			return { key: real.key, options, native: real, dispose: () => real.dispose() };
		},

		/** setDecorations: Paints one decoration on one editor: the ranges are the backend's, the call
		 *  is the IDE's, and this is the only place the two meet.
		 *  @param {EditorSnapshot} editor the editor the spans belong to
		 *  @param {TextEditorDecorationType} decorationType the decoration to paint
		 *  @param {Range[]} ranges the spans to paint it on */
		setDecorations(editor: EditorSnapshot, decorationType: TextEditorDecorationType, ranges: Range[]): void {
			const real = editor.native as webstorm.TextEditor;
			real.setDecorations(
				decorationType.native as webstorm.TextEditorDecorationType,
				ranges.map(
					(range) =>
						new webstorm.Range(
							new webstorm.Position(range.start.line, range.start.character),
							new webstorm.Position(range.end.line, range.end.character),
						),
				),
			);
		},

		/** createOutputChannel: The channel the backend logs into, created by the IDE.
		 *  @param {string} name the channel name the user sees */
		createOutputChannel: webstorm.window.createOutputChannel.bind(webstorm.window),

		/** onDidOpenTextDocument: The document-open event, read into a snapshot before the backend sees it.
		 *  @param {Function} listener the backend's opener */
		onDidOpenTextDocument(listener: (document: TextDocument) => void): Disposable {
			if (!listener) throw new TypeError('onDidOpenTextDocument needs the backend listener');
			return webstorm.workspace.onDidOpenTextDocument((document: IdeTextDocument): void => {
				listener(documentSnapshot(document));
			});
		},

		/** onDidCloseTextDocument: The document-close event, read into a snapshot before the backend sees it.
		 *  @param {Function} listener the backend's closer */
		onDidCloseTextDocument(listener: (document: TextDocument) => void): Disposable {
			if (!listener) throw new TypeError('onDidCloseTextDocument needs the backend listener');
			return webstorm.workspace.onDidCloseTextDocument((document: IdeTextDocument): void => {
				const closed = documentSnapshot(document);
				listener(closed);
			});
		},

		/** onDidChangeTextDocument: The document-change event, with its content changes read into ide spans so
		 *  the backend can shift its cached ranges without knowing the SDK.
		 *  @param {Function} listener the backend's change handler */
		onDidChangeTextDocument(listener: (document: TextDocument, changes: TextDocumentChange[]) => void): Disposable {
			if (!listener) throw new TypeError('onDidChangeTextDocument needs the backend listener');
			const adapt = (event: IdeChangeEvent<IdeRange>): void => {
				listener(documentSnapshot(event.document), changesSnapshot(event.contentChanges));
			};

			return webstorm.workspace.onDidChangeTextDocument(adapt);
		},

		/** onDidChangeConfiguration: The configuration-change event, narrowed to the one question the backend
		 *  asks of it: whether a section was affected.
		 *  @param {Function} listener the backend's reload */
		onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable {
			if (!listener) throw new TypeError('onDidChangeConfiguration needs the backend listener');
			const adapt = (event: IdeConfigurationChange): void => {
				listener({ affectsConfiguration: (section: string) => event.affectsConfiguration(section) });
			};

			return webstorm.workspace.onDidChangeConfiguration(adapt);
		},

		/** onDidChangeActiveTextEditor: The active-editor event, read into a snapshot before the backend sees it.
		 *  @param {Function} listener the backend's focus handler */
		onDidChangeActiveTextEditor(listener: (editor: EditorSnapshot | null) => void): Disposable {
			if (!listener) throw new TypeError('onDidChangeActiveTextEditor needs the backend listener');
			const adapt = (editor: IdeTextEditor<IdeRange, IdeSelection> | null): void => {
				listener(editor ? editorSnapshot(editor, editor) : null);
			};

			return webstorm.window.onDidChangeActiveTextEditor(adapt);
		},

		/** onDidChangeTextEditorSelection: The selection-change event, read into snapshots so the backend can reveal
		 *  what the cursor points at.
		 *  @param {Function} listener the backend's selection handler */
		onDidChangeTextEditorSelection(listener: (event: TextEditorSelectionEvent) => void): Disposable {
			if (!listener) throw new TypeError('onDidChangeTextEditorSelection needs the backend listener');
			const adapt = (event: IdeSelectionEvent<IdeRange, IdeSelection>): void => {
				listener({
					editor: editorSnapshot(event.textEditor, event.textEditor),
					selections: selectionsSnapshot(event.selections),
				});
			};

			return webstorm.window.onDidChangeTextEditorSelection(adapt);
		},
	};
}
