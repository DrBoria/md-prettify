"use strict";

const js = require("@eslint/js");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
	{
		ignores: [
			"**/node_modules/**",
			"**/out/**",
			"**/dist/**",
			"**/*.d.ts",
			"**/*.config.js",
			"**/*.config.mjs",
			"**/*.config.cjs",
		],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: { "@typescript-eslint": typescriptEslint },
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: "module",
			parserOptions: {
				project: true,
			},
		},
		rules: {
			...js.configs.recommended.rules,
			...typescriptEslint.configs["recommended-type-checked"].rules,
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "error",
			// No `as unknown` (incl. the `as unknown as X` double cast):
			// the first hop is a TSAsExpression to a TSUnknownKeyword.
			"@typescript-eslint/consistent-type-assertions": [
				"error",
				{
					assertionStyle: "as",
					// Only the `as unknown` hop is banned via
					// no-restricted-syntax below; plain `as X` stays legal.
					objectLiteralTypeAssertions: "allow",
				},
			],
			// No comments that silence linters or the type checker.
			// (ban-ts-comment in the installed @typescript-eslint v7 has no
			// "never" option, so ts-* comments are banned here too.)
			"no-warning-comments": [
				"error",
				{
					terms: [
						"eslint-disable",
						"eslint:off",
						"ts-ignore",
						"ts-expect-error",
						"ts-nocheck",
					],
					location: "start",
				},
			],
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{
					prefer: "type-imports",
					fixStyle: "separate-type-imports",
				},
			],
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-floating-promises": "warn",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/no-non-null-assertion": "warn",
			// Functions must stay small and readable: cyclomatic complexity
			// above 8 means the function is doing too many things.
			complexity: ["error", 8],
			"no-restricted-syntax": [
				"error",
				{
					selector:
						"VariableDeclarator[id.name=/^[A-Z][A-Z0-9_]*$/][init.type='Literal'][init.value=/^-?\\d+(\\.\\d+)?(px|rem|em|vh|vw|%)$/]",
					message:
						"Do not define CSS unit constants. Use theme variables instead.",
				},
				{
					// `x as unknown` is a TSAsExpression whose type child is a TSUnknownKeyword.
					selector: "TSAsExpression > TSUnknownKeyword",
					message:
						"Cast through `unknown` is forbidden. Type the value so it needs no double cast.",
				},
			],
		},
	},
];
