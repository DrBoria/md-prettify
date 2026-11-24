/**
 * The text of a line as the rules see it: the scope-carrying segments, the spans
 * the rules match, and the decorated text a copy reads back.
 */
import type { DecorationListEntry, Range, TextDocument, TextEditorDecorationType } from '@md-prettify/types';
import { offsetOf, positionFrom, positionIsEqual, rangeFromPositions } from './index';
import { classifyRuleScopes, getDecorationCacheKey, isScopeApplicable, segmentExcluded } from './scope-match';

/** matchesOf: every non-empty match of a rule's pattern in a piece of text, with the
 * @param {string} text the text the rule is matched against
 * @param {RegExp} pattern the rule's pattern
 * @param {string} pretty the template the rule wants to show in place of the match
 * @returns {{ start: number; length: number; rendered: string }[]} the matches, in text order */
function matchesOf(text: string, pattern: RegExp, pretty: string): { start: number; length: number; rendered: string }[] {
	const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
	const found: { start: number; length: number; rendered: string }[] = [];
	for (const match of text.matchAll(new RegExp(pattern.source, flags))) {
		if (match[0].length === 0) continue;
		found.push({
			start: match.index ?? 0,
			length: match[0].length,
			rendered: pretty.replace(/\$(\d+|&)/g, (placeholder, group: string) =>
				group === '&' ? match[0] : (match[Number(group)] ?? ''),
			),
		});
	}

	return found;
}

/**
 * spansOfLine: every span the rules match on one line, each with the key of the rule
 * that matched it. A rule is matched against the whole line, because `^` and `$` in a
 * rule mean the line's ends — matching one token at a time made `$` mean "end of this
 * token", which hid a `}` that was not the last character of the line.
 * @param {string} line the text of the line
 * @param {number} lineIdx the line index the spans belong to
 * @param {readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[]} tokens the tokenized line
 * @param {readonly { ugly: RegExp; pretty: string; scope?: string | string[] }[]} rules the rules to apply
 * @param {Set<string>} excludedScopes the scope prefixes that veto a match
 * @param {string} defaultScope the scope a rule without its own falls back to
 * @returns {{ key: string; pretty: string; span: Range }[]} the matched spans and their rendered text
 */
export function spansOfLine(
	line: string,
	lineIdx: number,
	tokens: readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[],
	rules: readonly { ugly: RegExp; pretty: string; scope?: string | string[] }[],
	excludedScopes: Set<string>,
	defaultScope: string,
): { key: string; pretty: string; span: Range }[] {
	const found: { key: string; pretty: string; span: Range }[] = [];
	for (const rule of rules) {
		const classified = classifyRuleScopes(rule);
		for (const match of matchesOf(line, rule.ugly, rule.pretty)) {
			const start = match.start;
			const end = start + match.length;
			const scopes = scopesForRange(tokens, start, end, defaultScope);
			if (segmentExcluded(excludedScopes, scopes)) continue;
			if (!isScopeApplicable(classified.positiveScopes, classified.negativeScopesByPrefix, classified.highPriorityScopes, scopes))
				continue;
			found.push({
				key: getDecorationCacheKey(rule),
				pretty: match.rendered,
				span: rangeFromPositions(positionFrom(lineIdx, start), positionFrom(lineIdx, end)),
			});
		}
	}

	return found;
}

/** scopesForRange: the scopes the tokens carry over a stretch, falling back to the document's default scope.
 * @param {readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[]} tokens the tokenized line
 * @param {number} start the first column of the stretch
 * @param {number} end the column the stretch ends at
 * @param {string} defaultScope the scope a rule without its own scope falls back to
 * @returns {Set<string>} the scopes of the tokens the stretch touches
 */
function scopesForRange(
	tokens: readonly { startIndex: number; endIndex: number; scopes: readonly string[] }[],
	start: number,
	end: number,
	defaultScope: string,
): Set<string> {
	const scopes = new Set<string>();
	for (const token of tokens) {
		if (token.endIndex <= start || token.startIndex >= end) continue;
		for (const scope of token.scopes) scopes.add(scope);
	}
	if (scopes.size === 0 && defaultScope) scopes.add(defaultScope);

	return scopes;
}

/** withoutDisabledLines: drops the spans that sit on a line the user switched off.
 * @param {Iterable<Range>} spans the spans to filter
 * @param {Set<number>} disabled the lines whose symbols were switched off
 * @returns {Range[]} the spans still shown
 */
function withoutDisabledLines(spans: Iterable<Range>, disabled: Set<number>): Range[] {
	const kept: Range[] = [];
	for (const span of spans) {
		if (!disabled.has(span.start.line)) kept.push(span);
	}

	return kept;
}

/** buildDecorationsList: turns the store's spans into the entries one repaint applies.
 * @param {Set<number>} disabled the lines whose symbols were switched off
 * @param {Map<string, TextEditorDecorationType>} decorationTypes the type of every rule
 * @param {Map<string, { ranges: Set<Range> }>} prettySpans the spans of every rule
 * @param {TextEditorDecorationType | null} hiddenType the type that hides the ugly text
 * @returns {DecorationListEntry[]} the entries to paint
 */
export function buildDecorationsList(
	disabled: Set<number>,
	decorationTypes: Map<string, TextEditorDecorationType>,
	prettySpans: Map<string, { ranges: Set<Range> }>,
	hiddenType: TextEditorDecorationType | null,
): DecorationListEntry[] {
	const entries: DecorationListEntry[] = [];
	const all: Range[] = [];
	for (const [key, entry] of prettySpans) {
		const type = decorationTypes.get(key);
		const enabled = withoutDisabledLines(entry.ranges, disabled);
		all.push(...enabled);
		if (type && enabled.length > 0) entries.push({ decoration: type, ranges: enabled });
	}
	if (hiddenType && all.length > 0) entries.push({ decoration: hiddenType, ranges: all });

	return entries;
}

/** getDecoratedText: the text of a span as the user reads it, every matched span replaced by its pretty form.
 * @param {Map<string, { pretty: string; ranges: Set<Range> }>} prettySpans the spans of every rule, with its pretty text
 * @param {TextDocument | null} document the document the span belongs to
 * @param {Range} range the span whose decorated text is wanted
 * @returns {string} the text with the substitutions applied
 */
export function getDecoratedText(
	prettySpans: Map<string, { pretty: string; ranges: Set<Range> }>,
	document: TextDocument | null,
	range: Range,
): string {
	if (!document) return '';
	const from = offsetOf(document, range.start);
	const to = offsetOf(document, range.end);
	const parts: { start: number; end: number; pretty: string }[] = [];
	for (const entry of prettySpans.values()) {
		for (const span of entry.ranges) {
			const start = offsetOf(document, span.start);
			const end = offsetOf(document, span.end);
			if (start >= from && end <= to) parts.push({ start, end, pretty: entry.pretty });
		}
	}
	parts.sort((a, b) => a.start - b.start);

	let text = '';
	let cursor = from;
	for (const part of parts) {
		if (part.start < cursor) continue;
		text += document.text.slice(cursor, part.start) + part.pretty;
		cursor = part.end;
	}

	return text + document.text.slice(cursor, to);
}

/** hiddenRangesOf: drops the ranges the selection revealed, so they show their ugly text.
 * @param {Range[]} ranges the ranges the decoration type covers
 * @param {Range[]} revealed the ranges that must stay ugly
 * @returns {Range[]} the ranges that keep the pretty text
 */
export function hiddenRangesOf(ranges: Range[], revealed: Range[]): Range[] {
	const hidden: Range[] = [];
	for (const range of ranges) {
		const isRevealed = revealed.some((span) => positionIsEqual(span.start, range.start) || positionIsEqual(span.end, range.end));
		if (!isRevealed) hidden.push(range);
	}

	return hidden;
}
