import type { IToken } from './vscode-textmate';

import { sameScopes } from './same-scopes';

/** Joins adjacent tokens that carry identical scope lists. */
export const combineIdenticalTokenScopes = (tokens: IToken[]): IToken[] => {
  if (!tokens || tokens.length === 0)
    return [];
  const result = [tokens[0]];
  let prevToken = tokens[0];
  for (let idx = 1; idx < tokens.length; ++idx) {
    const token = tokens[idx];
    if (prevToken.endIndex === token.startIndex && sameScopes(prevToken.scopes, token.scopes)) {
      // Note: create a copy of the object so the source tokens are unmodified
      result[result.length - 1] = { startIndex: prevToken.startIndex, endIndex: token.endIndex, scopes: prevToken.scopes };
      prevToken = result[result.length - 1];
    } else {
      result.push(token);
      prevToken = token;
    }
  }
  return result;
};
