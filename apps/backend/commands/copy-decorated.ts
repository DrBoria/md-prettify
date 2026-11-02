import type { TextEditor } from "../host";
import type { DocumentStore } from "../document/type";
import { getDecoratedText } from "@md-prettify/utils";

/** Copies every selection's decorated text, joined by newlines, to the clipboard. */
export const copyDecoratedAction = async (state: DocumentStore, editor: TextEditor): Promise<void> => {
	if (!state.prettyModel || !state.document) return;
	const copy = editor.selections.map((sel) => getDecoratedText(state, sel));
	if (copy.length === 0) return;
	await state.host.copyToClipboard(copy.join('\n'));
};
