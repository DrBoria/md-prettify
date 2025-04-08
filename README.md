# MD Prettify

MD Prettify makes *visual* substitutions to your source code, e.g. displaying `False` as `lie`, and `1` with `1000000` while never touching your code.

This feature is inspired by [md-prettify for Emacs](https://www.emacswiki.org/emacs/PrettySymbol).

### Scopes

*Note: scope support is experimental and only available on versions of vscode older than 1.21.1*.

By default, regular expressions match against a whole line of text. If `"scope"` is specified, then regular expression matches will only be performed on the parsed [TextMate] tokens that match the given scope. A small subset of TextMate scope expressions are supported. For example, a substitution with scope `"source.js comment"` will match tokens whose scope list includes *both* `"source.js"` and `"comment"`, such as `"text.html.basic source.js comment.block.html"`. The order and other scopes in the token do not matter as long as all components of the specified scope are present. A scoped `"ugly"` regular expression must match the entire token by default -- i.e. `"pre"` and `"post"` are respectively set to `"^"` and `"$"` by default when a scope is specified. However, `"pre"` and `"post"` can be overriden to allow multiple substitutions within a single token (e.g. a comment).

Note: Negative scope matching (e.g., `!comment`) is not currently supported.

*Tip: use [scope-info](https://marketplace.visualstudio.com/items?itemName=siegebell.scope-info) to see the scope assigned to each token in your source.*

### Revealing symbols

By default, "ugly" text will be revealed while contacted by a cursor. You may override this behavior by specifying `"mdPrettify.revealOn"`, or per-language by specifying `"revealOn"` within a language entry. Options are:
* `"cursor"`: reveal while a cursor contacts the symbol (default);
* `"cursor-inside"`: reveal while a cursor is *inside* the symbol;
* `"active-line"`: reveal all symbols while on the same line as a cursor;
* `"selection"`: reveal all symbols while being selected or in contact with a cursor; or
* `"none"`: do not reveal symbols.

### Pretty cursor

By default, any "pretty" symbol that comes into contact with the cursor will be rendered with a box outline around it. This effect is only visible if the "ugly" text is not revealed (e.g. `"revealOn": "none"`). You can control this setting by specifying `"mdPrettify.prettyCursor"`, or per-language by specifying `"prettyCursor"` within a language entry. Options are:
* `"boxed"`: display a box around a symbol (only visible if the "ugly" text is not revealed); or
* `"none"`: do not change the appearance of the symbol.

### Adjust cursor movement

By default, cursor movement will traverse the characters of the "ugly" text -- this will cause it to become invisible while inside the text if it is not revealed (see `"revealOn"`). Setting `"mdPrettify.adjustCursorMovement"` to `true` will tweak cursor movement so that "pretty" symbols behave as a single character. This can be overriden per-language by specifying `"adjustCursorMovement"` in a language entry. In particular, left or right movement will cause the cursor to jump over the symbol instead of going inside. However, this setting does not currently account for all kinds of cursor movement, e.g. up/down.

### Styling

A tiny subset of CSS can be used to apply styling to the substitution text by setting `"style"`; styles can be specialized for light and dark themes. If `"pretty"` is not specified, then`"style"` must be specified: the result being that all "ugly" matches will have the style applied to them instead of being substituted.

* Supported styles: `"border", "backgroundColor", "color", "textDecoration"` (this list is limited by vscode).
* Themed: e.g. `"dark": {"color": "white"}, "light": {"color": "black"}`
* Unsupported styles: e.g. `"hackCSS": "font-style: italic, font-size: 2em"` (this can easily break rendering)

### Regular expressions

This extension uses [Javascript's regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) syntax for `"ugly"`, `"pre"`, and `"post"` (but double-escaped because it is parsed by both JSON and regexp).

You can use standard JavaScript capture group references (like `$1`, `$2`) in the `"pretty"` string if your `"ugly"` pattern contains capturing groups `(...)`. However, you must avoid using mis-parenthesized expressions or unintended capture groups, as it will cause substitutions to behave unpredictably (validation is not performed, so you will not receive an error message).

### Commands

The following commands are available for keybinding:
* `mdPrettify.copyWithSubstitutions`: copy selected text with "pretty" substitutions applied
* `mdPrettify.enablePrettySymbols`: globally *enable* MD Prettify
* `mdPrettify.disablePrettySymbols`: globally *disable* MD Prettify
* `mdPrettify.togglePrettySymbols`: globally *toggle* MD Prettify

### Common settings for `settings.json`

* **Default:** symbols are unfolded as they are traversed by the cursor. 
```json
"mdPrettify.renderOn": "cursor",
"mdPrettify.adjustCursorMovement": false,
```
* Suggested alternative: symbols are never unfolded and generally act like a single character w.r.t. cursor movement. 
```json
"mdPrettify.renderOn": "none",
"mdPrettify.adjustCursorMovement": true,
```

## Known issues:

* You can write bad regular expressions that break substitutions and you will not get an error message.
* The substitutions sometimes get into an inconsistent state when editing. To resolve, reenable md-prettify -- this will cause the whole document to be reparsed.

## Configuration Examples

Explore pre-configured substitution settings for various languages in the [examples/](./examples) directory:

*   **[TypeScript/React](./examples/typescript-react.json):** Example substitutions tailored for TypeScript and React development, including common symbols and JSX elements.

Feel free to contribute your own configurations for other languages!

## Support Me:

If you find this extension useful, please consider donating to support its development:

<a href="https://www.buymeacoffee.com/miki_du" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

<a href="https://etherscan.io/address/0x1A3471C0Fa1b8512b5423d3Bd715560639AF04Ea" target="_blank"><img src="img/eth.png" alt="Donate with Ethereum" style="height: 75px !important;width: 217px !important;" ></a>
