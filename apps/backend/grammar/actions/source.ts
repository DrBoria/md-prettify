/**
 * The source actions: the file read and the parse are two steps of their own, so
 * the text stays in the store between them and a second request for the same
 * scope costs neither a disk read nor a parse.
 */
import * as fs from 'fs';

import type { GrammarStore } from '../store';

/**
 * readSourceTextAction: reads the located grammar file into the store's text
 * cache, so the parse step works off state instead of touching the disk again.
 * @param {GrammarStore} state the grammar store the source text is cached in
 * @param {string} scopeName the scope whose file is read
 * @returns {Promise<string | null>} the grammar text, or null when nothing serves the scope
 */
export async function readSourceTextAction(state: GrammarStore, scopeName: string): Promise<string | null> {
	const cached = state.sourceTexts.get(scopeName);
	if (cached) return cached;
	const file = state.located.get(scopeName);
	if (!file) return null;
	const text = await fs.promises.readFile(file, 'utf8');
	state.sourceTexts.set(scopeName, text);

	return text;
}

/**
 * loadSourceAction: the registry's callback — it reads the grammar text and parses
 * it, and keeps the parsed grammar in the store so a second ask costs nothing.
 * @param {GrammarStore} state the grammar store the text and the parse live in
 * @param {(text: string, file: string) => T} parse the parser the registry tokenizes with
 * @param {string} scopeName the scope whose grammar is loaded
 * @returns {Promise<T | null>} the parsed grammar, or null when nothing serves the scope
 */
export async function loadSourceAction<T>(
	state: GrammarStore,
	parse: (text: string, file: string) => T,
	scopeName: string,
): Promise<T | null> {
	const text = await readSourceTextAction(state, scopeName);
	if (!text) return null;
	const parsed = parse(text, state.located.get(scopeName) ?? '');
	state.sources.set(scopeName, parsed);

	return parsed;
}
