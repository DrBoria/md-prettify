/**
 * The context actions: a repaint needs the document's scope, the selections to
 * reveal around, the reveal strategy of the config and the editors to paint on.
 * Each of them is resolved once into a field of the decorations store, so the
 * steps that need it read state instead of reaching for the ide again.
 */
import { getRoot as rootOf } from 'mobx-state-tree';

import type { LanguageEntry, Selection, UglyRevelation } from '@md-prettify/types';
import type { DecorationsStore } from '../store';
import type { RootStore } from '../../store';

/**
 * resolveScopeAction: records the TextMate scope the document's rules match
 * against, taking the scope the entry declares and only then the language id.
 * @param {DecorationsStore} self the decorations store the scope is recorded in
 * @param {LanguageEntry} entry the entry config resolved for the document
 * @param {string} languageId the language the ide reports for the document
 */
export function resolveScopeAction(self: DecorationsStore, entry: LanguageEntry, languageId: string): void {
	const declared = entry.textMateInitialScope;
	self.scope = declared ? declared : languageId;
}

/**
 * resolveSelectionsAction: records the selections of the editor that shows this
 * document, so a repaint reveals around them without asking the ide twice.
 * @param {DecorationsStore} self the decorations store the selections are recorded in
 */
export function resolveSelectionsAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	const doc = root.documents.get(self.uri);
	const editor = root.settings.ide?.activeTextEditor;
	const shows = doc ? editor?.document.uri === doc.document.uri : false;
	self.selections = (shows ? (editor?.selections ?? []) : []) as Selection[];
}

/**
 * resolveRevealAction: records the reveal strategy the config applied to this
 * document, falling back to the setting when the document has no entry yet.
 * @param {DecorationsStore} self the decorations store the strategy is recorded in
 */
export function resolveRevealAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	const applied = root.config.applied.get(self.uri);
	const revealOn: UglyRevelation = applied ? applied.revealOn : root.settings.values.revealOn;
	self.revealOn = revealOn;
}

/**
 * resolveTargetsAction: records the editors that show this document, so the paint
 * step walks a field of the store and not the whole ide.
 * @param {DecorationsStore} self the decorations store the targets are recorded in
 */
export function resolveTargetsAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	const doc = root.documents.get(self.uri);
	const editors = root.settings.ide?.visibleTextEditors ?? [];
	self.paintTargets = [];
	for (const editor of editors) {
		if (doc && editor.document.uri === doc.document.uri) self.paintTargets.push(editor);
	}
}
