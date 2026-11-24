# md-prettify backend architecture

The backend is an IDE-agnostic application with exactly four features. Every
piece of state has one owner; everything else is either a pure value type or a
shared utility.

```
settings  ─┐
config    ─┼──► decorations ──► view (IDE)
document  ─┘
```

- `document`, `config` and `settings` never paint: only `decorations` creates
  editor decoration types and applies them. It is the only feature that produces
  what the user sees.
- `document` owns the document state and composes the decorations store next to
  it; it does not drive the decoration pipeline.

## Entry points — decorators, not imports

The backend never imports an IDE SDK, and an IDE package never imports the
backend. The two meet in one place: the build script.

```
apps/backend/index.ts ──► BackendApi
                              │
    apps/backend/scripts/build.sh <vscode|webstorm>
                              │
                              ▼
packages/<ide>-extension/activate.ts   decorateBackend(backend)
                              │
                              ▼
                 apps/backend/out/activate.js  (generated)
```

- `packages/vscode-extension` and `packages/webstorm-extension` export
  `decorateBackend(backend)`, which returns the `activate`/`deactivate` pair the
  IDE loads. They own the host construction, the devtool lifecycle and the IDE
  SDK imports.
- `apps/backend/scripts/build.sh <ide>` compiles the backend and the chosen
  decorator, then writes `out/activate.js` that wires the two together. That
  generated file is the only place the dependency runs application → decorator.
- `pnpm build:vscode` / `pnpm build:webstorm` are the two entry points; both
  take the same backend and differ only in the decorator they compose.

## 1. `config` — what the user chose

Owns the semantics of replacement.

- language entries (`typescript-to-python`, `typescript-to-trumpscript`, …);
- `Substitution` rules (`ugly`, `pretty`, `scope`, `style`);
- predefined configurations and user entries;
- programmatically registered entries;
- choosing the entry for a document by `languageId`;
- rule compilation and scope applicability.

**State:** language entries, predefined configurations, additional entries,
compiled rules, selected entry per language.

**Operations:** `load(rawConfiguration)`, `selectEntryFor(document)`,
`register(entry)`.

**Does not:** read IDE settings, know about editors or ranges, paint anything.

## 2. `settings` — how the extension behaves

Owns IDE-level behaviour.

- parsing VS Code / WebStorm settings (`enabled`, `revealOn`,
  `hideTextMethod`, `prettyCursor`, `adjustCursorMovement`, …);
- defaults and overrides;
- key bindings and command registration;
- the enabled/disabled flag and its subscribers.

**State:** raw and parsed settings, enabled flag, registered commands.

**Operations:** `reloadFromHost()`, `registerCommands()`, `setEnabled()`.

**Does not:** contain language replacement rules, know about ranges or
decorations.

## 3. `document` — document entities

Owns the per-document session.

- loading the IDE document and subscribing to open/change/close;
- `DocumentView`: text, lines, offsets, version;
- splitting into lines and tracking change deltas;
- loading the TextMate grammar for the document language and tokenizing lines.

**State (one per `uri`):** `DocumentView`, `textDocument`, version, lines,
offsets, grammar, grammar state, tokens.

**Operations:** `open` (installs the store and returns the rules config chose),
`close`, `unload`, internal re-tokenization of changed lines.

**Does not:** know replacement rules or decorations.

## 4. `decorations` — page binding and output

Owns what the user sees in an open document.

- combines `DocumentView`, `config` rules and `settings`;
- recomputes which fragments to hide/replace;
- stores ranges grouped by rule and their `TextEditorDecorationType`;
- resolves overlaps and priority;
- paints visible editors;
- hide/reveal, cursor, selections, disabled lines.

**State (a distinct store, one per open document, composed next to the document
store):** ranges, decoration
cache (`key → { decorationType, ranges }`), line index, range-key map, hide and
reveal decoration types, disabled lines, last selections, revealed ranges,
cursor ranges, current decorations.

**Operations:** `attach(document, rules)`, `recompute()`, `onChange()`,
`paint()`, `reparseViewport()`, `revealOnCursor/selection`, `dispose()`.

**Does not:** parse configuration, read document text itself, or decide whether
a rule applies (that is `config`).

## Stores

- `RootStore` composes `settings: SettingsStoreModel`,
  `config: ConfigStoreModel`, `documents: map<uri, DocumentStoreModel>` and
  `grammar: GrammarStoreModel`.
- `DocumentStore` composes `decorations: DecorationsStoreModel`. The document
  state itself is only the view, the text document, the grammar and the grammar
  state.
- `DecorationsStoreModel` owns ranges, cache, decoration types and reveal state.
- `ConfigStoreModel` owns predefined language entries and programmatic entries.
- `SettingsStoreModel` owns the parsed settings and the enabled flag.

## Data flow

```
IDE settings / key bindings ──► settings
IDE document ─────────────────► document (text, lines, tokens, grammar)
user configuration ───────────► config   (language → rules)

document + config + settings
        ↓
decorations.recompute()   what to hide/replace in this document
        ↓
decorations.paint()       editor.setDecorations → the user sees the result
```

Triggers:

- `document.onChange` → `decorations.recompute()` → `paint()`;
- `settings.reload` → `decorations.recompute()` → `paint()`;
- `config.load/register` → `decorations.recompute()` → `paint()`;
- active editor / selection change → `decorations` re-paints reveal/cursor only.

## Removed concepts

- `substitutions` is not a feature: its rules live in `config`.
- `reparse` is not a feature: recomputation is `decorations.recompute()` plus
  tokenization inside `document`.
- `resolve` is not a feature: overlap/priority resolution is internal to
  `decorations`.
- `grammar` is not a feature: loading the grammar for a document language is
  part of `document`.

## Utilities

`packages/utils` contains only shared generic helpers (debounce, sorting,
filtering, id creation). Domain value types and their constructors (`Position`,
`Range`, `Selection`) belong to the domain that owns them, not to utils.
