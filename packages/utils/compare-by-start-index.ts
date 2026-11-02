import type { IToken } from './vscode-textmate';

/** Orders token ranges by their start offset. */
export const compareByStartIndex = (a: { startIndex: number }, b: { startIndex: number }): number => a.startIndex - b.startIndex;
