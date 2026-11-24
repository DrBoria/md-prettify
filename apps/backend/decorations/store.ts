/**
 * The decorations store: the view model of one document — the decoration types
 * that are live, the spans each rule matched and what was painted. How a
 * document is drawn (reveal strategy, cursor, hide method) is config, so it is
 * read from the config feature, never copied here.
 *
 * A repaint needs a context — the scope the rules match against, the selections
 * to reveal around, the reveal strategy of the config and the editors to paint on
 * — so each of those is a field here, filled once by its own action and read by
 * the step that needs it, instead of being recomputed inside one expression.
 */
import { types as t } from 'mobx-state-tree';
import type { Instance } from 'mobx-state-tree';
import { registerActions } from '@md-prettify/utils';
import type {
	Disposable,
	EditorSnapshot,
	PrettyStyle,
	Range,
	Selection,
	TextEditorDecorationType,
	UglyRevelation,
} from '@md-prettify/types';
import type { UpdateDecorationEntry } from '../document/type';
import { registerSpanAction } from './actions/spans';
import {
	decorateSpansAction,
	disposeDecorationsAction,
	loadDecorationsAction,
	paintDocumentAction,
	toggleLineAction,
} from './actions/decorate';

const DecorationsStoreBase = t
	.model('DecorationsStore', {
		/** The document this store is the view model of. */
		uri: t.frozen<string>(''),
		/** The entries last painted on the editors. */
		currentDecorations: t.frozen<UpdateDecorationEntry[]>([]),
		/** The spans a reveal exposed last time. */
		revealedSpans: t.frozen<Range[]>([]),
	})
	.volatile(() => ({
		/** The decoration type each rule paints with, keyed by the rule key. */
		decorationTypes: new Map<string, TextEditorDecorationType>(),
		/** The spans each rule matched, keyed by the rule key, with the rule's pretty text. */
		prettySpans: new Map<string, { pretty: string; ranges: Set<Range> }>(),
		/** The style each rule paints with, keyed by the rule's cache key. */
		ruleStyles: new Map<string, PrettyStyle | undefined>(),
		/** The type that hides the ugly text, and the one that reveals it. */
		hiddenType: null as TextEditorDecorationType | null,
		revealedType: null as TextEditorDecorationType | null,
		/** The lines whose symbols the user switched off. */
		disabledLines: new Set<number>(),
		/** The disposables the feature owns. */
		subscriptions: [] as Disposable[],
		/** The selections last seen in each editor. */
		lastSelections: new Map<string, Selection[]>(),
		/** The TextMate scope the document's rules are matched against. */
		scope: '',
		/** The selections a repaint reveals around. */
		selections: [] as Selection[],
		/** The reveal strategy the config gave this document. */
		revealOn: 'active-line' as UglyRevelation,
		/** The editors a repaint targets. */
		paintTargets: [] as EditorSnapshot[],
	}));

/** The decorations store the orchestrators read and the actions write. */
export type DecorationsStore = Instance<typeof DecorationsStoreBase>;

export const DecorationsStoreModel = DecorationsStoreBase.actions((self) =>
	registerActions(self, {
		disposeDecorations: disposeDecorationsAction,
		loadDecorations: loadDecorationsAction,
		decorateSpans: decorateSpansAction,
		paintDocument: paintDocumentAction,
		toggleLine: toggleLineAction,
		registerSpan: registerSpanAction,
	}),
);
