## Main Logic for Creating a Configuration

MD Prettify allows you to transform "ugly" code patterns into "pretty" versions using JSON-based configurations. Each configuration targets specific languages (e.g., TypeScript, TypeScript React) and defines substitution rules. Below is the basic process:

### 1. Understand Substitution Basics

**Structure:** A configuration has a:
 * `"language"` field (array of target languages) 
 * `"substitutions"` array containing substitution objects.
 * `"excludedScopes"` scopes that will be excluded for every substitution.

**Substitution Object Fields:**
* `"ugly"`: A regular expression (regex) to match the code you want to replace.
* `"pretty"`: The replacement string, where $0 is the full match, $1 is the first captured group, $2 is the second, etc.
* `"style"`: Optional styling (e.g., "color", "hackCSS" for font weight).
* `"scope"`: Optional array of syntax scopes (e.g., "source.ts", "keyword.operator.comparison.ts") to limit where the substitution applies.

### 2. Steps to Create Your Own Substitution

Identify the Pattern: Decide what code you want to prettify (e.g., if (condition) {, ==, true).
Write the "ugly" Regex:
* Use regex to match the pattern. For example, `"if\\s*(\\(.*?\\))\\s*\\{"` matches `if` followed by a condition in parentheses and an opening brace.
* Use parentheses `( )` to capture groups you want to reuse in the replacement (e.g., `(.*?)` captures the condition).
* Define the `"pretty"` String:
* * Replace the matched pattern with a prettier version. Use `$0`, `$1`, etc., to insert the full match or captured groups. 
* * For example, `"if $1:"` keeps the condition but swaps `{` for `:`.
* Set the Style (Optional):
* * Add visual flair, e.g., "style": { "color": "#da70d1", "hackCSS": "font-weight: 600;" }.
* Specify the Scope (Optional):
* * Limit the substitution to specific contexts using scopes like `"source.ts" `(whole file) or `"keyword.operator.relational.ts"` (specific operators). This prevents unwanted replacements (e.g., inside strings).

### 3. Rule Precedence

If **two rules** have similar `"ugly"` patterns (e.g., `"if ("` and `"$1 if ("`, the more specific or "expanded" version applies.

For example, a rule matching a longer or more detailed pattern takes priority.

### 3.1. Advanced: Prioritizing Rules with `!`

To give a rule higher priority, add an exclamation mark (`!`) to the end of a scope name in its `"scope"` array (e.g., `"comment.line.double-slash.ts!"`). This ensures that very specific rules (for instance, for text within comments or strings) are applied even if they overlap with broader, more general rules.

*   **How it Works:** A rule with a scope ending in `!` will take precedence over a rule with a standard scope if they both match the same piece of code. The prioritized rule applies even if the other rule's scope is broader or would normally apply due to matching a larger text segment.

*   **Example:**
    Suppose you have two rules:
    1.  A general rule: `"TODO"` becomes `"TASK"` (scope: `["source.ts"]`).
    2.  A specific, prioritized rule: `"TODO"` becomes `"[PENDING]"` but *only* in comments (scope: `["comment.line.double-slash.ts!"]`).

    With this setup, `// TODO: Fix this` will change to `// [PENDING]: Fix this` (due to the `!` priority), while `TODO` elsewhere will become `TASK`.

### 4. Debugging Your Configuration

Enable debug mode by adding "mdPrettify.debug": true to your config.
Check the output in your IDE (e.g., Output -> MD Prettify Debug Output). You'll see:
* **Segments**: Code broken into parts with their scopes and positions (e.g., 'if (qty > 0) {' at [0-22] with scopes [source.tsx, meta.function.tsx]).
* **Substitution Mapping**: How each part of "pretty" corresponds to the original code (e.g., 'if ' maps to [8-11], $1 to (qty > 0)).
Use this to refine your regex and scopes.

#### 4.1 Debug Example:
```
--- Line 3 ---
  Segment [0-22]: '        if (qty > 0) {', Scopes: [source.tsx, meta.function.tsx, meta.block.tsx]
  Segment [8-10]: 'if', Scopes: [keyword.control.conditional.tsx]
  Segment [11-12]: '(', Scopes: [meta.brace.round.tsx]
  Segment [19-20]: ')', Scopes: [meta.brace.round.tsx]
  Segment [12-15]: 'qty', Scopes: [variable.other.readwrite.tsx]
  Segment [16-17]: '>', Scopes: [keyword.operator.relational.tsx]
  Segment [18-19]: '0', Scopes: [constant.numeric.decimal.tsx]
  Segment [21-22]: '{', Scopes: [punctuation.definition.block.tsx]
  Static Part 'if ' corresponds to original substring 'if ' [0-3] -> Range [8-11]
  Part '$1' corresponds to original substring '(qty > 0)' [3-12]
  Part '$2' maps to invalid/unmatched group (Index 2)
  Static Part ':' corresponds to original substring ' {' [12-14] -> Range [20-22]
```

### Example Breakdown

For the rule:

```
{
  "ugly": "if\\s*(\\(.*?\\))\\s*\\{",
  "pretty": "if $1:",
  "style": { "color": "#da70d1", "hackCSS": "font-weight: 600;" },
  "scope": ["source.ts", "source.tsx"]
}
```
* Matches: if (qty > 0) { (with optional spaces).
* Replaces With: if (qty > 0): (keeps the condition as $1, swaps { for :).
* Applies In: TypeScript and TypeScript React files.
* Styled: Purple and bold.

Tips for Success

* Test Simple Patterns First: Start with something like replacing "==" with "is" in "keyword.operator.comparison.ts".
* Use Specific Scopes: Avoid broad scopes like "source.ts" for simple patterns (e.g., operators) to prevent mismatches in comments or strings.
* Leverage Debug Output: Adjust your regex if the wrong parts of the code are matched or replaced.

By following this process, you can craft custom substitutions to make your code more readable or styled to your liking!
