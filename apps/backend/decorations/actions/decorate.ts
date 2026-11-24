/**
 * The decoration actions: install what one document is drawn with, apply the
 * config it was given and paint the result. Each action writes the decorations
 * store it belongs to and reaches the other features through the root store.
 */
import { getRoot as rootOf } from 'mobx-state-tree';
import {
	buildDecorationsList,
	getDecorationCacheKey,
	hiddenRangesOf,
	revealedSpansOf,
	rulesInPriorityOrder,
	spansOfLine,
} from '@md-prettify/utils';
import type { IGrammar } from 'vscode-textmate';
import type { LanguageEntry } from '@md-prettify/types';
import type { DecorationsStore } from '../store';
import { resolveRevealAction, resolveScopeAction, resolveSelectionsAction, resolveTargetsAction } from './context';
import { registerSpanAction } from './spans';
import type { PrettySubstitution } from '../../document/type';
import type { RootStore } from '../../store';

/**
 * disposeDecorationsAction: releases every type and subscription of one document
 * and drops its store.
 * @param {DecorationsStore} self the decorations store being released
 */
export function disposeDecorationsAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	for (const type of [self.hiddenType, self.revealedType, ...self.decorationTypes.values()]) type?.dispose();
	for (const subscription of self.subscriptions) subscription.dispose();
	root.decorations.delete(self.uri);
}

/**
 * loadDecorationsAction: compiles the document's rules and builds one type per rule.
 * @param {DecorationsStore} self the decorations store being installed
 */
export function loadDecorationsAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	const ide = root.settings.ide;
	if (!ide) return;
	for (const type of [self.hiddenType, self.revealedType, ...self.decorationTypes.values()]) type?.dispose();
	self.decorationTypes.clear();
	self.prettySpans.clear();
	self.hiddenType = ide.createDecorationType({
		letterSpacing: '-0.55em; font-size: 0.1em; visibility: hidden',
		rangeBehavior: 'ClosedClosed',
	});
	self.revealedType = ide.createDecorationType({
		letterSpacing: 'normal !important; visibility: visible !important',
		rangeBehavior: 'ClosedClosed',
	});
	self.ruleStyles.clear();
	for (const rule of root.config.rules.get(self.uri) ?? []) self.ruleStyles.set(getDecorationCacheKey(rule), rule.style);
}

/**
 * decorateSpansAction: tokenizes the document and records, per rule, the spans it matched.
 * @param {DecorationsStore} self the decorations store being written
 * @param {IGrammar | null} grammar the grammar the document is tokenized with
 * @param {LanguageEntry} entry the entry config resolved for the document
 */
export function decorateSpansAction(self: DecorationsStore, grammar: IGrammar | null, entry: LanguageEntry): void {
	const root: RootStore = rootOf(self);
	const doc = root.documents.get(self.uri);
	if (!doc) return;
	for (const spans of self.prettySpans.values()) spans.ranges.clear();
	if (!grammar) return;
	const rules = rulesInPriorityOrder<PrettySubstitution>(root.config.rules.get(self.uri) ?? []);
	const stacks: unknown[] = [];
	const excluded = new Set(entry.excludedScopes);
	resolveScopeAction(self, entry, doc.languageId);
	for (let lineIdx = 0; lineIdx < doc.lines.length; ++lineIdx) {
		const line = doc.lines[lineIdx];
		const parsed = grammar.tokenizeLine(line, stacks[lineIdx - 1] as never);
		stacks[lineIdx] = parsed.ruleStack;
		for (const found of spansOfLine(line, lineIdx, parsed.tokens, rules, excluded, self.scope)) {
			registerSpanAction(self, found.key, found.pretty, found.span);
		}
	}
}

/**
 * paintDocumentAction: reveals the spans the selection touches and paints every
 * editor showing the document.
 * @param {DecorationsStore} self the decorations store being painted
 */
export function paintDocumentAction(self: DecorationsStore): void {
	const root: RootStore = rootOf(self);
	const ide = root.settings.ide;
	const doc = root.documents.get(self.uri);
	if (!ide || !doc) return;
	const editor = ide.activeTextEditor;
	resolveSelectionsAction(self);
	resolveRevealAction(self);
	resolveTargetsAction(self);
	self.revealedSpans = revealedSpansOf(self.prettySpans, doc.document, self.selections, self.revealOn, self.disabledLines);
	self.currentDecorations = buildDecorationsList(self.disabledLines, self.decorationTypes, self.prettySpans, self.hiddenType);
	for (const target of self.selections.length > 0 ? [...self.paintTargets, editor] : self.paintTargets) {
		for (const entry of self.currentDecorations) {
			ide.setDecorations(target, entry.decoration, hiddenRangesOf(entry.ranges, self.revealedSpans));
		}
	}
}

/**
 * toggleLineAction: switches pretty symbols on the given line (0-based).
 * @param {DecorationsStore} self the decorations store being written
 * @param {number} line the line whose symbols are switched
 * @returns {boolean} true when the line is now disabled
 */
export function toggleLineAction(self: DecorationsStore, line: number): boolean {
	const disabled = self.disabledLines.has(line);
	if (disabled) self.disabledLines.delete(line);
	else self.disabledLines.add(line);

	return disabled;
}
