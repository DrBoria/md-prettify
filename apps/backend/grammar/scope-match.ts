export const matchScope = (scope: string | string[], scopes: string[]): boolean => {
  if (!scope)
    return true;

  // If scope is an array, check if any of the scope strings match
  if (Array.isArray(scope)) {
    for (const s of scope) {
      if (matchSingleScope(s, scopes)) return true;
    }
    return false;
  }

  return matchSingleScope(scope, scopes);
};

const matchSingleScope = (scope: string, scopes: string[]): boolean => {
  // For better detection of nested scopes:
  // 1. Check whether any of the token scopes fully contains the scope we are looking for
  for (const tokenScope of scopes) {
    if (tokenScope.includes(scope)) {
      return true;
    }
  }

  // 2. Check part by part
  const parts = scope.split(/\s+/);
  for (const part of parts) {
    let found = false;
    for (const tokenScope of scopes) {
      if (tokenScope.includes(part)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }

  return true;
};
