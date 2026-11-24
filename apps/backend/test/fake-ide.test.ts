import type { Ide } from '@md-prettify/types';
import * as assert from 'assert';
import * as backend from '../index';
import {
	positionFrom,
	positionIsEqual,
	positionCompare,
	rangeFrom,
	rangeFromPositions,
	rangeIsEqual,
	selectionFrom,
} from '@md-prettify/utils';
import type { TextEditorDecorationType, DecorationRenderOptions, OutputChannel, Disposable } from '@md-prettify/types';

/**
 * A fake ide: the minimum Ide implementation needed to run the backend
 * without an IDE. Proves the backend is IDE-agnostic (step-5 acceptance).
 */
class FakeIde implements Ide {
	getInstalledExtensions(): never[] {
		return [];
	}
	commands = new Map<string, (...args: unknown[]) => unknown>();
	textDocuments: never[] = [];
	visibleTextEditors: never[] = [];
	activeTextEditor = null;

	registerCommand(id: string, callback: (...args: unknown[]) => unknown): Disposable {
		this.commands.set(id, callback);
		return { dispose: () => this.commands.delete(id) };
	}

	getConfiguration(section: string): unknown {
		void section;
		return {};
	}

	matchLanguage(language: string | string[], document: { languageId: string }): number {
		const langs = Array.isArray(language) ? language : [language];
		return langs.includes(document.languageId) ? 1 : 0;
	}

	getGrammarInjections(languageScopeName: string): { scopeName: string; path: string }[] {
		void languageScopeName;
		return [];
	}

	copyToClipboard(text: string): Promise<void> {
		void text;
		return Promise.resolve();
	}

	setDecorations(): void {}

	createDecorationType(options: DecorationRenderOptions): TextEditorDecorationType {
		return { key: `deco-${Math.random()}`, options, dispose: () => {} };
	}

	createOutputChannel(name: string): OutputChannel {
		void name;
		return { appendLine: () => {}, dispose: () => {} };
	}

	onDidOpenTextDocument(): Disposable {
		return { dispose: () => {} };
	}
	onDidCloseTextDocument(): Disposable {
		return { dispose: () => {} };
	}
	onDidChangeTextDocument(): Disposable {
		return { dispose: () => {} };
	}
	onDidChangeConfiguration(): Disposable {
		return { dispose: () => {} };
	}
	onDidChangeActiveTextEditor(): Disposable {
		return { dispose: () => {} };
	}
	onDidChangeTextEditorSelection(): Disposable {
		return { dispose: () => {} };
	}
}

suite('fake ide', () => {
	test('the backend activates and registers its commands against a fake ide', () => {
		const ide = new FakeIde();
		backend.activate(ide);
		backend.registerCommands(ide);
		backend.registerListeners(ide);

		assert.ok(ide.commands.has('md-prettify.enablePrettySymbols'), 'enable command registered');
		assert.ok(ide.commands.has('md-prettify.disablePrettySymbols'), 'disable command registered');
		assert.ok(ide.commands.has('md-prettify.togglePrettySymbols'), 'toggle command registered');
	});

	test('ide geometry types work without an IDE', () => {
		const p1 = positionFrom(1, 2);
		const p2 = positionFrom(1, 2);
		const p3 = positionFrom(3, 4);
		assert.ok(positionIsEqual(p1, p2));
		assert.ok(!positionIsEqual(p1, p3));
		assert.ok(positionCompare(p1, p3) < 0);
		assert.ok(positionCompare(p3, p1) > 0);

		const r = rangeFrom(0, 1, 2, 3);
		assert.strictEqual(r.start.line, 0);
		assert.strictEqual(r.end.character, 3);
		assert.ok(rangeIsEqual(r, rangeFromPositions(positionFrom(0, 1), positionFrom(2, 3))));

		const s = selectionFrom(positionFrom(0, 0), positionFrom(1, 0));
		assert.strictEqual(s.anchor.line, 0);
		assert.strictEqual(s.active.line, 1);
	});
});
