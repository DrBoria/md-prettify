import type { DocumentStore } from "../type";

/** Switches pretty symbols on the given line (0-based); true when the line was disabled. */
export const toggleLineAction = (state: DocumentStore, line: number): boolean => {
	const disabled = state.disabledLines.has(line);
	if (disabled) {
		state.disabledLines.delete(line);
	} else {
		state.disabledLines.add(line);
	}
	return disabled;
};
