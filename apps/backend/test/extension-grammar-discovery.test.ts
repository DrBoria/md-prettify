/**
 * The grammar feature's discovery over the contributions an IDE declares.
 *
 * Built-in typescript-basics contributes its grammar WITHOUT a grammarPath on
 * the languages entry — the grammar entry carries language + scopeName instead.
 * Discovery must resolve "source.ts" (and the "source.<id>" convention) to that
 * grammar, or the extension is a no-op for TypeScript out of the box.
 */
import * as assert from 'assert';
import type { IdeExtension } from '@md-prettify/types';
import { getRoot } from '../store';

// The exact contribution shape of VS Code's built-in typescript-basics:
// languages[0] has no grammarPath; grammars[0] has language + scopeName.
const typescriptBasics: IdeExtension = {
	extensionUri: { fsPath: '/fake/typescript-basics' },
	packageJSON: {
		contributes: {
			languages: [{ id: 'typescript' }],
			grammars: [{ language: 'typescript', scopeName: 'source.ts', path: 'syntaxes/TypeScript.tmLanguage.json' }],
		},
	},
};

suite('grammar discovery', () => {
	/** grammar discovery answers off the extensions the store holds, so each test installs its own and indexes them. */
	const installed = (extensions: IdeExtension[]) => {
		const grammar = getRoot().grammar;
		grammar.extensions = extensions;
		grammar.indexScopePaths();
		grammar.indexLanguagePaths();
		grammar.indexDeclaredLanguagePaths();
		grammar.indexInjections();

		return grammar;
	};

	test('a grammar contributed for a language resolves the source.<id> scope', () => {
		const expected = '/fake/typescript-basics/syntaxes/TypeScript.tmLanguage.json';
		const grammar = installed([typescriptBasics]);
		grammar.locateGrammar('source.ts');
		assert.strictEqual(grammar.located.get('source.ts'), expected);
	});

	test('the grammar path declared on a language contribution wins', () => {
		const withPath: IdeExtension = {
			extensionUri: { fsPath: '/fake/with-path' },
			packageJSON: { contributes: { languages: [{ id: 'rust', grammarPath: 'syntaxes/rust.json' }] } },
		};
		const grammar = installed([withPath]);
		grammar.locateGrammar('source.rust');
		assert.strictEqual(grammar.located.get('source.rust'), '/fake/with-path/syntaxes/rust.json');
	});

	test('an unknown scope resolves to nothing', () => {
		const grammar = installed([typescriptBasics]);
		grammar.locateGrammar('source.does-not-exist');
		assert.strictEqual(grammar.located.get('source.does-not-exist'), null);
	});

	test('injection grammars are collected for the extensions that declare them', () => {
		const injecting: IdeExtension = {
			extensionUri: { fsPath: '/fake/injections' },
			packageJSON: {
				contributes: {
					grammars: [{ scopeName: 'source.ts.inject', path: 'syntaxes/inject.json', injectionSelector: 'L:source.ts' }],
				},
			},
		};
		assert.deepStrictEqual(installed([injecting]).injectionsFor('source.ts'), ['source.ts.inject']);
		assert.deepStrictEqual(installed([typescriptBasics]).injectionsFor('source.ts'), []);
	});
});
