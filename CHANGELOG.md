# Change Log

## 1.4.1

Formatter fixes.

- `color: ;` and `$foo: ;` never settled. The colon asked for a space after it and the semicolon for none before it, so with no value between them the formatter alternated between `color:;` and `color: ;` on successive runs, and format-on-save rewrote the file every time.
- `A {}` was split across two lines. Empty rules stay on one line.
- Blank lines between declarations were collapsed, while blank lines between top-level rules survived. Both are kept now.
- A selector list the author split one per line was joined back onto a single line. Line breaks a person put there are left alone; a value split across lines is still joined, and every spelling of it converges on the same line.
- Variable definitions are formatted, which they were not before.

## 1.4.0

First release of the community fork (`KaiErikNiermann.tcss-syntax-highlighter`).

Fixes:

- A one-line `CSS = "..."` or `DEFAULT_CSS = "..."` no longer swallows the rest of the Python file. Single-line assignments are matched by a rule that cannot leave a region open, and an ordinary string assigned to something merely named `CSS` is left alone. [extension#7](https://github.com/Textualize/tcss-vscode-extension/issues/7)
- A commented-out CSS assignment is no longer treated as one. All injection rules now require the assignment to be the first thing on its line. [extension#6](https://github.com/Textualize/tcss-vscode-extension/issues/6)
- Nested rules parse. The first nested selector was read as a property name and the nested `{` opened nothing, which left every brace after it off by one. [grammar#8](https://github.com/Textualize/tcss-textmate-grammar/issues/8)

Features:

- Quoted strings are highlighted as property values. [grammar#2](https://github.com/Textualize/tcss-textmate-grammar/issues/2)
- `transition` is a known property, `ms` and `s` are known duration units, and all 33 easing names are known values. [grammar#5](https://github.com/Textualize/tcss-textmate-grammar/issues/5)

Distribution:

- Published to Open VSX for VSCodium. [extension#10](https://github.com/Textualize/tcss-vscode-extension/issues/10)
- Every release attaches a `.vsix`, and every build of `main` uploads one, so Cursor and other editors without a marketplace entry can install it. [extension#8](https://github.com/Textualize/tcss-vscode-extension/issues/8)

Language server:

- A TCSS language server built on [Langium](https://langium.org). A TextMate grammar colours characters; this parses the document, so the editor now offers diagnostics (syntax errors, plus unknown styles and pseudo-classes with a nearest-match suggestion), an outline, folding, and go-to-definition, find-references, rename and completion for `$variables`.
- Formatting, contributed as the default formatter for the language. [extension#5](https://github.com/Textualize/tcss-vscode-extension/issues/5)
- Unresolved variable references are deliberately not reported: Textual injects a design system (`$primary`, `$surface`, their shades, and a long tail of component variables) that no stylesheet declares.

Project:

- pnpm, ESLint 10 flat config with sonarjs/unicorn/security, strict TypeScript, a pre-push hook, a Justfile, and a test suite that runs headless in CI: unit tests for both grammars, the 161 real stylesheets Textual ships, and seven fast-check properties fuzzing the parser and the formatter.

## 1.3.1

- Add support for `panel` border type

## 1.3.0

- Fix rules `link-hover-*` which have been renamed as `link-*-hover` https://github.com/Textualize/tcss-textmate-grammar/issues/4
- Add rule `keyline` https://github.com/Textualize/tcss-textmate-grammar/issues/6
- Add support for nested TCSS https://github.com/Textualize/tcss-textmate-grammar/issues/7

## 1.2.0

- Add support for the TCSS rules `overlay` and `constrain` (and their respective values)
- Add support for the value `initial`

## 1.1.0

- Add language configuration to enable line/block comments, auto-closing brackets, and more

## 1.0.1

- Add icon

## 1.0.0

- Make extension generally available

## 0.3.0

- Highlight TCSS inside `CSS` and `DEFAULT_CSS` class variables in Python

## 0.2.0

- Add highlighting for all types of values
- Add highlighting for variable use and assignment

## 0.1.0

- Initial release
