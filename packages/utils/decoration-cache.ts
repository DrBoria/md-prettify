import type { Substitution } from "@md-prettify/types";

/** Generates a unique string key for caching decorations based on substitution parameters. */
export const getDecorationCacheKey = (params: Substitution): string => {
	const scopeStr = Array.isArray(params.scope) ? [...params.scope].sort().join(",") : params.scope || '';
	const styleStr = params.style ? JSON.stringify(Object.entries(params.style).sort()) : '';
	const uglyStr = params.ugly instanceof RegExp ? `${params.ugly.source}|${params.ugly.flags}` : params.ugly;
	return `${uglyStr}:::${params.pretty}:::${scopeStr}:::${styleStr}`;
};
