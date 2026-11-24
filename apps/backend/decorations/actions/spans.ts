/**
 * The span registration action: a rule renders different text for different matches
 * (`$1` takes the match's group), so the decoration type is chosen by the rendered
 * text and not by the rule alone.
 */
import { getRoot as rootOf } from 'mobx-state-tree';

import { decorationOptionsFor } from '@md-prettify/utils';
import type { Range } from '@md-prettify/types';
import type { DecorationsStore } from '../store';
import type { RootStore } from '../../store';

/**
 * registerSpanAction: records one matched span under the text it renders to, and
 * creates that decoration type on first use.
 * @param {DecorationsStore} self the decorations store the span is recorded in
 * @param {string} ruleKey the cache key of the rule that matched
 * @param {string} rendered the text the rule renders for this match
 * @param {Range} span the range the match covers
 */
export function registerSpanAction(self: DecorationsStore, ruleKey: string, rendered: string, span: Range): void {
	const renderKey = `${ruleKey}\u0000${rendered}`;
	const root: RootStore = rootOf(self);
	const ide = root.settings.ide;
	if (!self.prettySpans.has(renderKey)) {
		if (!ide) return;
		self.decorationTypes.set(renderKey, ide.createDecorationType(decorationOptionsFor(rendered, self.ruleStyles.get(ruleKey))));
		self.prettySpans.set(renderKey, { pretty: rendered, ranges: new Set() });
	}
	self.prettySpans.get(renderKey)?.ranges.add(span);
}
