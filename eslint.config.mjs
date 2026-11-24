import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Switches off every ESLint rule that would fight with Prettier. Must stay the
// LAST entry of the exported array (see the bottom of this file).
import prettierConfig from "eslint-config-prettier/flat";

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

// The architecture rule SCANS the repository itself (it builds the tree and the
// file list by walking the FS), so it needs its own skip list — ESLint's
// `ignores` does not feed a rule option; it only stops files from being linted.
// One list, one rule definition: two copies would let the same rule see two
// different trees depending on which file happened to trigger it.
const ARCH_IGNORED_DIRS = ["node_modules", "out", ".vsstage", ".vsix-stage", "reports", ".idea", ".claude", ".turbo"];
// Paths that are a deliberate exception to the architecture, globs included:
// - `debounce.ts` is a self-contained timer holder — its state is a private
//   `{ timer, callback }` living in a closure, not store state, and there is
//   nothing to move or reuse. It stays as it is, and the rule is not asked
//   about it.
// - `examples/**` is demo code copied from articles: it is not the product,
//   so no rule is asked about it (`ignores` above already keeps ESLint itself
//   out of that folder).
// - the two IDE adapters' event registration: a host event hands the adapter ONE
//   raw object and expects it to convert it and forward it to the backend
//   listener, so `(document) => listener(documentSnapshot(document))` is the ONLY
//   possible shape — there is no `map(documentSnapshot)` spot to pass the util
//   by value. The rule reads that wrapper as "an `extensionCode` re-declares the
//   `pureFunction` `documentSnapshot`/`editorSnapshot`", which is a false
//   positive: the adapter calls the util, it does not re-implement it. An
//   adapter file IS the host boundary, so no rule is asked about it.
const ARCH_IGNORED_PATHS = [
	"packages/utils/debounce.ts",
	"examples/**",
	"packages/vscode-extension/ide-adapter.ts",
	"packages/webstorm-extension/ide-adapter.ts",
];
// The rule writes its own report: by default to `reports/architecture-report.md`
// (the same `reports/` convention as the three uniqueness catalogs below), so no
// `exportPath` option is needed here. Add `exportPath: "<path>"` to move it,
// `exportPath: false` to turn the file off.
//
// The overview HTML is OPT-IN on purpose: it is a 1.5 MB self-contained page
// rewritten on every lint, which is noise in a normal check loop. Pass the flag
// when you actually want to look at it:
//   ARCH_OVERVIEW=1 pnpm lint                      → reports/architecture-overview.html
//   ARCH_OVERVIEW=reports/graph.html pnpm lint     → that path instead
const ARCH_OVERVIEW_PATH = process.env.ARCH_OVERVIEW
	? process.env.ARCH_OVERVIEW === "1"
		? "reports/architecture-overview.html"
		: process.env.ARCH_OVERVIEW
	: false;
const architectureRule = [
	"error",
	{
		config: "architecture.yaml",
		ignoreDirs: ARCH_IGNORED_DIRS,
		ignores: ARCH_IGNORED_PATHS,
		exportPath: ARCH_OVERVIEW_PATH,
		// The TOOL's own inputs, not the architecture's: files whose CONTENT a rule
		// may need. A key declared here and missing on disk is reported by the rule
		// instead of silently reading nothing.
		configs: {
			tsconfig: "tsconfig.json",
		},
	},
];

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
		// The architecture describes the whole product, so the rule runs on every
		// source folder it can name — a package outside the pattern is a blind
		// spot: code moved there silently stops being checked.
		basePath: here,
		files: ["packages/**/*.ts"],
		plugins: { "md-code": followArchitecture },
		rules: { "md-code/follow-architecture": architectureRule },
	},
	{
		basePath: here,
		// The uniqueness rules judge CODE, not a folder: a util duplicated inside a package
		// is the same duplicate it would be in the app. Scoped to `apps/backend` only, every
		// `packages/**` file was a blind spot — and that is where the shared helpers live.
		files: ["apps/backend/**/*.ts", "packages/**/*.ts"],
		plugins: {
			"md-code": followArchitecture,
			"md-code-utils": utilsUniqueness,
			"md-code-entities": entitiesUniqueness,
			"md-code-components": componentUniqueness,
		},
		rules: {
			// Scan scope lives here, not in architecture.yaml: the yaml describes
			// the code, the rule options describe how to scan.
			"md-code/follow-architecture": architectureRule,
			"md-code-utils/utils-uniqueness": [
				"error",
				{
					root: here,
					tsconfig: "tsconfig.json",
					// Types come from the checker, so the rule needs a PROGRAM: `paths`,
					// `baseUrl` and module resolution live in a tsconfig. Each file is read
					// against its nearest config (this repo keeps one per package); this
					// path is the fallback for a file whose tree has none.
					utilsFolder: ["apps", "packages"],
					// Single-layer folder: without compareAll a file in layer 0
					// sees no canons (canSeeCanon requires an earlier layer),
					// so the rule would never fire. compareAll compares each
					// file against the whole catalog.
					compareAll: true,
					parts: true,
					proposeFromLib: true,
					exportPath: "reports/utils-catalog.json",
					// Same twins as the entity rule: the two IDE adapters
					// duplicate each other by construction. Only that pair is
					// excused; anything else is still reported.
					knownDuplicates: [["packages/vscode-extension/**", "packages/webstorm-extension/**"]],
				},
			],
			"md-code-components/component-uniqueness": [
				"error",
				{
					root: here,
					tsconfig: "tsconfig.json",
					// Imported components are resolved with TypeScript, so an alias resolves
					// through the same config. Nearest tsconfig first; this is the fallback.
					componentsFolder: ["apps", "packages"],
					// Same single-layer rationale as utils-uniqueness above.
					compareAll: true,
					exportPath: "reports/component-catalog.json",
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
					tsconfig: "tsconfig.json",
					// Member types come from the checker: without a program an imported type
					// reads as `any` and two different shapes compare equal. Nearest tsconfig
					// wins; this is the fallback.
					roots: ["apps", "packages"],
					exportPath: "reports/entities-catalog.json",
					// Test fakes (FakeHost, OPTIONS, ...) are intentionally
					// duplicated per test file — the architecture keeps
					// tests self-contained (*.test.ts only, no shared
					// helper).
					exclude: ["**/*.test.ts"],
					// The two IDE adapters are twins by construction: the same
					// Host contract, the same conversions, two IDE SDKs. Their
					// duplication is known and accepted; duplicates anywhere
					// else are still reported.
					knownDuplicates: [["packages/vscode-extension/**", "packages/webstorm-extension/**"]],
				},
			],
		},
		},
	{
		// Prettier normalises whitespace but never CREATES a separator: an empty
		// line between declarations is content, and Prettier keeps or drops it
		// without an opinion on where it belongs. So the separator is a review
		// rule, not a formatting one — `padding-line-between-statements` is the
		// only place that can say it, and Prettier still has the last word on
		// everything else (it collapses three blank lines into one).
		basePath: here,
		files: ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts", "packages/**/*.tsx"],
		rules: {
			"padding-line-between-statements": [
				"error",
				// One blank line before and after every function, and between any
				// two top-level declarations: reading a file must never require
				// scanning for where one unit ends. `export` is listed separately
				// because a `export function foo()` is an export statement to
				// ESLint, not a `function` one.
				{ blankLine: "always", prev: "function", next: "*" },
				{ blankLine: "always", prev: "*", next: "function" },
				{ blankLine: "always", prev: "export", next: "export" },
				{ blankLine: "always", prev: "multiline-block-like", next: "export" },
			],
		},
	},
	// Formatting belongs to Prettier and to `prettier.config.mjs`. This block
	// turns off every ESLint rule that would re-decide it, so `pnpm check` has
	// exactly one authority per concern and always gives the same result.
	// Keep it LAST: any rule added after it would be able to fight Prettier.
	prettierConfig,
];
