/**
 * The dev-only state probe: it reports what the decorations feature has recorded for
 * every open document, so the devtool bridge can answer with real editor state.
 */
import type { Range } from '@md-prettify/types';
import { getRoot } from './store';

/** A rendered span as the probe reports it. */
interface SpanState {
	pretty: string;
	ranges: string[];
}

/**
 * decorationsState: the decoration state of every open document — the editors it was
 * painted on, the revealed spans and every rule's rendered text with its ranges.
 * @returns {Record<string, unknown>} one entry per document uri
 */
export function decorationsState(): Record<string, unknown> {
	const root = getRoot();
	const state: Record<string, unknown> = {};
	root.decorations.forEach((doc, uri) => {
		const spans: SpanState[] = [];
		doc.prettySpans.forEach((entry, key) => {
			spans.push({ pretty: entry.pretty, ranges: [...entry.ranges].map((range: Range) => `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`) });
			void key;
		});
		state[uri] = {
			revealed: doc.revealedSpans?.length ?? 0,
			painted: doc.currentDecorations?.length ?? 0,
			spans,
		};
	});

	return state;
}

/**
 * textsState: the text of every open document, so a probe can compare the source with
 * what the decorations render for it.
 * @returns {Record<string, string>} the text of each open document, by uri
 */
export function textsState(): Record<string, string> {
	const state: Record<string, string> = {};
	getRoot().documents.forEach((doc, uri) => {
		state[uri] = doc.document?.text ?? '';
	});

	return state;
}
