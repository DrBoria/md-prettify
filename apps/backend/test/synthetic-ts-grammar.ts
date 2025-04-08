// Shared synthetic TypeScript TextMate grammar for unit tests.
//
// The real VS Code TypeScript grammar (typescript-basics) is a large
// tmLanguage; the unit tests only need a grammar that produces the same
// scope names the typescript-to-python predefined config targets:
//   - meta.function.ts / meta.function.tsx   (named function declarations)
//   - meta.arrow.ts / meta.arrow.tsx         (arrow functions)
//   - meta.block.ts                          (curly-brace blocks)
//   - meta.objectliteral.ts                  (object literals)
//   - comment.line.ts                        (// comments, excluded by config)
//
// Keep the scope names in sync with apps/backend/package.json
// (mdPrettify.predefinedConfigurations.typescript-to-python).

export const tsScope = "source.ts";

export const grammarJson = JSON.stringify({
  scopeName: "source.ts",
  patterns: [
    { include: "#comment" },
    { include: "#function" },
    { include: "#arrow" },
    { include: "#block" },
  ],
  repository: {
    comment: {
      match: "//.*$",
      name: "comment.line.double-slash.ts",
    },
    function: {
      begin: "function\\s+[A-Za-z_]\\w*",
      end: "(?=\\{)",
      name: "meta.function.ts",
      patterns: [{ match: "[A-Za-z_]\\w*", name: "entity.name.function.ts" }],
    },
    arrow: {
      begin: "=>",
      end: "$",
      name: "meta.arrow.ts",
    },
    block: {
      begin: "\\{",
      end: "\\}",
      name: "meta.block.ts",
    },
  },
});
