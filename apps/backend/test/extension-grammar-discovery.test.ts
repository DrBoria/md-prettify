/**
 * Regression tests for TextMate grammar auto-discovery (packages/vscode-extension).
 *
 * Built-in typescript-basics contributes its grammar WITHOUT a grammarPath on
 * the languages entry — the grammar entry carries language + scopeName instead.
 * Auto-discovery must resolve "typescript" (and the "source.ts" convention) to
 * that grammar, or the extension is a no-op for TypeScript out of the box.
 *
 * Runs in the extension's mocha process AFTER extension-host-adapter.test.ts,
 * which patches the fake vscode module onto globalThis; when the adapter is not
 * yet compiled the suite self-skips, mirroring the other extension-*.test.ts.
 */

import * as assert from 'assert';

const sharedFake = (globalThis as Record<string, unknown>).mdPrettifyFake as
  | { extensions: { all: unknown[] } }
  | undefined;

const hasAdapter = (() => {
  try {
    require('../../../packages/vscode-extension/host-adapter.js');
    return true;
  } catch {
    return false;
  }
})();
const s = hasAdapter ? suite : suite.skip.bind(suite);

s('grammar auto-discovery (typescript-basics shape)', () => {
  if (!hasAdapter || !sharedFake) return;
  const { createHost } = (() => require('../../../packages/vscode-extension/host-adapter.js'))();

  // The exact contribution shape of VS Code's built-in typescript-basics:
  // languages[0] has no grammarPath; grammars[0] has language + scopeName.
  const typescriptBasics = {
    packageJSON: {
      contributes: {
        languages: [{ id: 'typescript', extensions: ['.ts', '.tsx', '.mts', '.cts'] }],
        grammars: [{ language: 'typescript', scopeName: 'source.ts', path: 'syntaxes/TypeScript.tmLanguage.json' }],
      },
    },
    extensionUri: { fsPath: '/fake/typescript-basics' },
  };
  // Pushed once for the whole suite: the fake vscode module is process-scoped
  // and discarded after the run, so no per-test teardown is needed (and mocha's
  // teardown would strip it after the first test).
  sharedFake.extensions.all.push(typescriptBasics);

  test('getLanguageScopeName resolves typescript via the grammars contribution', () => {
    const host = createHost();
    assert.strictEqual(host.getLanguageScopeName('typescript'), 'source.ts');
  });

  test('getGrammarFilePath resolves the real scope and the source.<id> convention', () => {
    const host = createHost();
    // The fake Uri.joinPath always joins with '/', so the expected path uses
    // forward slashes regardless of platform.
    const expected = '/fake/typescript-basics/syntaxes/TypeScript.tmLanguage.json';
    // For TypeScript the real scope IS the source.<id> convention (source.ts),
    // so both lookups resolve to the same grammar path.
    assert.strictEqual(host.getGrammarFilePath('source.ts'), expected);
  });

  test('getGrammarFilePath returns null for unknown scopes', () => {
    const host = createHost();
    assert.strictEqual(host.getGrammarFilePath('source.does-not-exist'), null);
  });
});
