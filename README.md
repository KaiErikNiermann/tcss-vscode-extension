# Textual CSS Syntax Highlighter (Community)

Syntax highlighting for [Textual](https://github.com/Textualize/textual) CSS: `.tcss`
files, and TCSS embedded in Python.

![A view of a highlighted file.](./tcss.png)

Highlighting also applies inside `CSS` and `DEFAULT_CSS` class variables in Python files:

![A Python file and a `CSS` class variable highlighted.](./python_injection.png)

## About this fork

This is a community-maintained fork of
[Textualize/tcss-vscode-extension](https://github.com/Textualize/tcss-vscode-extension),
whose last commit was 2024-01-09 and whose last maintainer reply on an issue was
2023-11-22. The open bugs are fixed here. It is not endorsed by Textualize.

Fixed relative to upstream 1.3.1:

| Upstream issue | Symptom |
| --- | --- |
| [extension#6](https://github.com/Textualize/tcss-vscode-extension/issues/6) | A commented-out `DEFAULT_CSS` block broke highlighting for the rest of the Python file |
| [extension#7](https://github.com/Textualize/tcss-vscode-extension/issues/7) | A one-line `CSS = "..."` broke highlighting for the rest of the Python file, including when the name belonged to unrelated code |
| [extension#8](https://github.com/Textualize/tcss-vscode-extension/issues/8) | No downloadable `.vsix`, so Cursor could not install it |
| [extension#10](https://github.com/Textualize/tcss-vscode-extension/issues/10) | Not published to Open VSX, so VSCodium could not install it |
| [grammar#2](https://github.com/Textualize/tcss-textmate-grammar/issues/2) | Quoted property values were not highlighted as strings |
| [grammar#5](https://github.com/Textualize/tcss-textmate-grammar/issues/5) | `transition`, duration units and easing names were unknown |
| [grammar#8](https://github.com/Textualize/tcss-textmate-grammar/issues/8) | The first selector of a nested rule was read as a property name, which unbalanced every brace after it |

The linting and formatting feature requests (extension
[#1](https://github.com/Textualize/tcss-vscode-extension/issues/1),
[#2](https://github.com/Textualize/tcss-vscode-extension/issues/2),
[#3](https://github.com/Textualize/tcss-vscode-extension/issues/3),
[#5](https://github.com/Textualize/tcss-vscode-extension/issues/5)) need a language
server rather than a TextMate grammar, and are planned on top of
[Langium](https://langium.org).

## Install

**VS Code** — search the Marketplace for *Textual Syntax Highlighter (Community)*, or:

```bash
code --install-extension kaierikniermann.textual-syntax-highlighter
```

**VSCodium** — the extension is published to [Open VSX](https://open-vsx.org), so the
built-in marketplace finds it.

**Cursor, or any editor without a marketplace entry** — every release attaches a
`.vsix`, and every build of `main` uploads one as a workflow artifact:

```bash
# from https://github.com/KaiErikNiermann/tcss-vscode-extension/releases
code --install-extension textual-syntax-highlighter-<version>.vsix
```

## Development

```bash
pnpm install
pnpm run check      # lint, typecheck and tests
pnpm run package    # build the .vsix
```

`pnpm run test` tokenises the grammars through `vscode-textmate` the same way the
editor does, so grammar changes are testable without starting an editor. Tests live in
`test/`; `test/tokenize.mts` is the harness.

### The grammar

Upstream generated `syntaxes/tcss.tmGrammar.json` from a YAML source in
[tcss-textmate-grammar](https://github.com/Textualize/tcss-textmate-grammar). That
repository is as dormant as this one was, so the JSON here is the source of truth and is
edited directly. `syntaxes/python.injection.json` is the injection that finds TCSS inside
Python.

## Release notes

See the [change log](./CHANGELOG.md).

## License

MIT, as upstream. See [LICENSE](./LICENSE).
