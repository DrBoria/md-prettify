/**
 * Single source of truth for formatting.
 *
 * Paired with `eslint-config-prettier` (last entry in `eslint.config.mjs`),
 * which switches off every ESLint rule that would fight with Prettier. That
 * pairing is what makes `pnpm check` deterministic: formatting is decided by
 * Prettier only, and ESLint only judges the things Prettier does not own.
 *
 * Style mirrors the codebase that existed before Prettier was introduced:
 * tabs, single quotes, semicolons, long lines.
 *
 * @type {import('prettier').Config}
 */
export default {
	useTabs: true,
	tabWidth: 4,
	printWidth: 140,
	singleQuote: true,
	semi: true,
	trailingComma: 'all',
	arrowParens: 'always',
	bracketSpacing: true,
	endOfLine: 'lf',
};
