// Declared constants of the backend: values every module reads.

/** Lines above which the initial reparse runs in background chunks. */
export const chunkedReparseThreshold = 500;

/** Debounce delay for re-decorating after the active editor changes (ms). */
export const activeEditorDecorationTimeout = 100;

/** Debounce delay for recomputing selections (ms). */
export const updateSelectionTimeout = 20;

/** Synthetic TypeScript TextMate grammar used by the backend tests. */
export const syntheticGrammarJson = `{"scopeName":"source.ts","patterns":[{"include":"#comment"},{"include":"#function"},{"include":"#arrow"},{"include":"#block"}],"repository":{"comment":{"match":"//.*$","name":"comment.line.double-slash.ts"},"function":{"begin":"function\\\\s+[A-Za-z_]\\\\w*","end":"(?=\\\\{)","name":"meta.function.ts","patterns":[{"match":"[A-Za-z_]\\\\w*","name":"entity.name.function.ts"}]},"arrow":{"begin":"=>","end":"$","name":"meta.arrow.ts"},"block":{"begin":"\\\\{","end":"\\\\}","name":"meta.block.ts"}}}`;
