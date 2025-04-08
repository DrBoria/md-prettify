import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// The three uniqueness rules self-maintain their on-disk catalogs: on every
// lint they walk their folders with a per-file mtime+size cache in os.tmpdir()
// and re-parse only changed files (fast path ~0ms). No external scripts.
const backendConfig = require("@md-prettify/eslint/backend");
const followArchitecture = require("@md-code/follow-architecture");
const utilsUniqueness = require("@md-code/utils-uniqueness");
const entitiesUniqueness = require("@md-code/entities-uniqueness");
const componentUniqueness = require("@md-code/component-uniqueness");

// `basePath` pins every `files` pattern to this repo root, so the config
// behaves identically no matter which directory the ESLint server was
// started from (the vscode-eslint server resolves its cwd to the nearest
// package.json of the linted file, which for apps/backend sources is
// apps/backend itself — a glob like "apps/backend/**/*.ts" would not match
// from there).
export default [
	{
		// Scratch/sample data, lint catalogs, and build output — not source,
		// not typed, not linted.
		ignores: ["examples/**", "reports/**", "out/**", "apps/backend/out/**"],
	},
	{
		basePath: here,
		files: ["apps/backend/test/**/*.test.ts"],
		languageOptions: {
			globals: {
				suite: "readonly",
				test: "readonly",
			},
		},
	},
	...backendConfig.map((c) =>
		c.languageOptions?.parserOptions
			? {
					...c,
					basePath: here,
					languageOptions: {
						...c.languageOptions,
						parserOptions: {
							...c.languageOptions.parserOptions,
							// Each file lints against its own nearest tsconfig
							// (apps/backend or packages/vscode-extension).
							project: true,
						},
					},
				}
			: { ...c, basePath: here },
	),
	{
		basePath: here,
		files: ["apps/backend/**/*.ts"],
		plugins: {
			"md-code": followArchitecture,
			"md-code-utils": utilsUniqueness,
			"md-code-entities": entitiesUniqueness,
			"md-code-components": componentUniqueness,
		},
		rules: {
			"md-code/follow-architecture": [
				"error",
				{
					config: "architecture.yaml",
					// Scan scope lives here, not in architecture.yaml: the yaml
					// describes the code, the rule options describe how to scan.
					ignoreDirs: [".vsix-stage", "reports", ".idea", ".claude", ".turbo", "out"],
				},
			],
			"md-code-utils/utils-uniqueness": [
				"error",
				{
					root: here,
					utilsFolder: ["apps/backend"],
					// Single-layer folder: without compareAll a file in layer 0
					// sees no canons (canSeeCanon requires an earlier layer),
					// so the rule would never fire. compareAll compares each
					// file against the whole catalog.
					compareAll: true,
					parts: true,
					proposeFromLib: true,
					catalogPath: "reports/utils-catalog.json",
				},
			],
			"md-code-components/component-uniqueness": [
				"error",
				{
					root: here,
					componentsFolder: ["apps/backend"],
					// Same single-layer rationale as utils-uniqueness above.
					compareAll: true,
					catalogPath: "reports/component-catalog.json",
				},
			],
			// "error" on purpose: ESLint applies one severity per rule
			// (per-report severity is ignored) AND the user's global
			// "eslint.quiet": true hides all warnings in VS Code — at
			// "warn" the rule would be invisible in the editor while the
			// CLI still shows it. The tier is conveyed via the message
			// text: "duplicate" (confidence >= 0.85) vs "near-duplicate"
			// (>= 0.50).
			"md-code-entities/entities-uniqueness": [
				"error",
				{
					root: here,
					roots: ["apps/backend"],
					exportPath: "reports/entities-catalog.json",
					// Test fakes (FakeHost, OPTIONS, ...) are intentionally
					// duplicated per test file — the architecture keeps
					// tests self-contained (*.test.ts only, no shared
					// helper).
					exclude: ["**/*.test.ts"],
				},
			],
		},
	},
];
