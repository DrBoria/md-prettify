import type { IToken } from './vscode-textmate';

/** True when two token scope lists are element-wise identical. */
export const sameScopes = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let idx = 0; idx < a.length; idx++) {
    if (a[idx] !== b[idx]) return false;
  }
  return true;
};
