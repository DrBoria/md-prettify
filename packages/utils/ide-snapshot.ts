/**
 * Reading an IDE's own objects into the plain data the backend works with.
 */
import type {
	IdeRange,
	IdeSelection,
	IdeTextDocument,
	IdeTextEditor,
	Position,
	Range,
	RangeDelta,
	Selection,
	TextDocument,
	TextDocumentChange,
	EditorSnapshot,
} from '@md-prettify/types';
import { positionFrom } from './index';
import { rangeFromPositions, selectionFrom, lineStartsOf } from './spans';

/** documentSnapshot: reads one IDE document into the text and facts the backend needs.
 * @param {IdeTextDocument} document the IDE's own document
 * @returns {TextDocument} the snapshot the backend reads
 */
export function documentSnapshot(document: IdeTextDocument): TextDocument {
	// A ide can fire a close event for a document it already detached; asking
	// that document for its text throws deep inside the SDK, so the failure is
	// named here instead.
	if (!document) throw new TypeError('documentSnapshot needs the ide document');
	const text = document.getText();

	return {
		uri: document.uri.toString(),
		languageId: document.languageId,
		fileName: document.fileName,
		isClosed: document.isClosed,
		lineCount: document.lineCount,
		text,
		lineStarts: lineStartsOf(text),
	};
}

/** selectionsSnapshot: reads the IDE's selections into ide spans.
 * @param {readonly IdeSelection[]} selections the IDE's own selections
 * @returns {Selection[]} the selections the backend reads
 */
export function selectionsSnapshot(selections: readonly IdeSelection[]): Selection[] {
	const snapshots: Selection[] = [];
	for (const selection of selections) {
		const anchor = positionFrom(selection.anchor.line, selection.anchor.character);
		const active = positionFrom(selection.active.line, selection.active.character);
		snapshots.push(selectionFrom(anchor, active));
	}

	return snapshots;
}

/** editorSnapshot: reads one ide editor into the document, the selections and the
 * @param {IdeTextEditor<IdeRange, IdeSelection>} editor the ide's own editor
 * @param {TNative} native the editor as the ide's own code refers to it
 * @returns {EditorSnapshot} the snapshot the backend reads */
export function editorSnapshot<TNative>(editor: IdeTextEditor<IdeRange, IdeSelection>, native: TNative): EditorSnapshot {
	const visibleRanges: Range[] = [];
	for (const range of editor.visibleRanges) {
		visibleRanges.push(
			rangeFromPositions(positionFrom(range.start.line, range.start.character), positionFrom(range.end.line, range.end.character)),
		);
	}

	return {
		document: documentSnapshot(editor.document),
		selections: selectionsSnapshot(editor.selections),
		visibleRanges,
		native,
	};
}

/** changesSnapshot: reads one IDE change event's spans into the edits the backend applies.
 * @param {readonly { range: IdeRange; text: string }[]} changes the IDE's own content changes
 * @returns {TextDocumentChange[]} the changes the backend applies
 */
export function changesSnapshot(changes: readonly { range: IdeRange; text: string }[]): TextDocumentChange[] {
	const snapshots: TextDocumentChange[] = [];
	for (const change of changes) {
		const { range } = change;
		snapshots.push({
			range: rangeFromPositions(
				positionFrom(range.start.line, range.start.character),
				positionFrom(range.end.line, range.end.character),
			),
			text: change.text,
		});
	}

	return snapshots;
}

/**
 * What an edit does to a cached span: the delta it produced and the move every
 * range has to make to keep covering the same text.
 */

/**
 * adjustSameLineCharacter: corrects the column of a point that sits on the line an
 * edit ended on, because the edit moved the rest of that line sideways.
 * @param {number} character the column the point had before the edit
 * @param {RangeDelta} delta the change the edit produced
 * @returns {number} the column the point has after the edit
 */
function adjustSameLineCharacter(character: number, delta: RangeDelta): number {
	let x = character + delta.endCharactersDelta;
	if (delta.linesDelta > 0) {
		x = x - delta.end.character;
	} else if (delta.start.line == delta.end.line + delta.linesDelta && delta.linesDelta < 0) {
		x = x + delta.start.character;
	}
	return x;
}

/** movedPoint: moves one end of a cached range by an edit's delta, so the range keeps
 * @param {Position} point the end of the range before the edit
 * @param {RangeDelta} delta the change the edit produced
 * @param {boolean} onEndLine true when the point sits on the line the edit ended on
 * @param {boolean} beforeEnd true when the point is before the edit and stays put
 * @returns {Position} the point after the edit */
function movedPoint(point: Position, delta: RangeDelta, onEndLine: boolean, beforeEnd: boolean): Position {
	if (beforeEnd) return point;
	if (!onEndLine) return { line: point.line + delta.linesDelta, character: point.character };

	return { line: point.line + delta.linesDelta, character: adjustSameLineCharacter(point.character, delta) };
}

/** rangeTranslateByDelta: moves one cached range by an edit's delta so it keeps covering the same text.
 * @param {Range} range the cached range to move
 * @param {RangeDelta} delta the change produced by the edit
 * @returns {Range} the moved range
 */
export function rangeTranslateByDelta(range: Range, delta: RangeDelta): Range {
	if (delta.linesDelta === 0 && delta.endCharactersDelta === 0) return range;
	const startOnEndLine = delta.end.line == range.start.line;
	const startBeforeEnd = range.start.line < delta.end.line || (startOnEndLine && range.start.character < delta.end.character);
	const endOnEndLine = delta.end.line == range.end.line;
	const endBeforeEnd = range.end.line < delta.end.line || (endOnEndLine && range.end.character <= delta.end.character);

	return {
		__range: true,
		start: movedPoint(range.start, delta, startOnEndLine, startBeforeEnd),
		end: movedPoint(range.end, delta, endOnEndLine, endBeforeEnd),
	};
}

/** toRangeDelta: measures what an inserted text does to a span, so every cached
 * @param {Range} oldRange the span the edit replaced
 * @param {string} text the text that replaced it
 * @returns {RangeDelta} the line and character change the edit produced */
export function toRangeDelta(oldRange: Range, text: string): RangeDelta {
	// position of the end of `text`
	let newEndLine = 0;
	let newEndCharacter = 0;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '\n') {
			newEndLine++;
			newEndCharacter = 0;
			i++;
		} else if (ch === '\r') {
			newEndLine++;
			newEndCharacter = 0;
			i++;
			if (text[i] === '\n') i++;
		} else {
			newEndCharacter++;
			i++;
		}
	}
	let charsDelta;
	if (oldRange.start.line == oldRange.end.line) charsDelta = newEndCharacter - (oldRange.end.character - oldRange.start.character);
	else charsDelta = newEndCharacter - oldRange.end.character;

	return {
		start: oldRange.start,
		end: oldRange.end,
		linesDelta: newEndLine - (oldRange.end.line - oldRange.start.line),
		endCharactersDelta: charsDelta,
	};
}
