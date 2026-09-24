# Textual CSS Syntax Highlighter (Community)

[![ci](https://github.com/KaiErikNiermann/tcss-vscode-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/KaiErikNiermann/tcss-vscode-extension/actions/workflows/ci.yml) [![VS Marketplace](https://vsmarketplacebadges.dev/version-short/KaiErikNiermann.tcss-syntax-highlighter.svg?label=VS%20Marketplace&color=0066b8)](https://marketplace.visualstudio.com/items?itemName=KaiErikNiermann.tcss-syntax-highlighter) [![Open VSX](https://img.shields.io/open-vsx/v/KaiErikNiermann/tcss-syntax-highlighter?label=Open%20VSX&color=c160ef)](https://open-vsx.org/extension/KaiErikNiermann/tcss-syntax-highlighter)

Language support for [Textual](https://github.com/Textualize/textual) CSS: syntax highlighting for `.tcss` files and for TCSS embedded in Python, plus a language server that parses the document.

![A view of a highlighted file.](./tcss.png)

Highlighting also applies inside `CSS` and `DEFAULT_CSS` class variables in Python files:

![A Python file and a `CSS` class variable highlighted.](./python_injection.png)

## Language features

Beyond highlighting, `.tcss` files get:

| Feature | What it does |
| --- | --- |
| Diagnostics | Syntax errors, and warnings for an unknown style or pseudo-class with a nearest-match suggestion |
| Formatting | One declaration per line, four-space indent, normalised spacing. The default formatter for the language |
| Outline and folding | Variables and rules in the breadcrumb and outline view; a folding range per rule body |
| Navigation | Go-to-definition, find-references and rename on `$variables` |
| Completion | Variables the document defines |

Unresolved variable references are deliberately not flagged. Textual injects a design system—`$primary`, `$surface`, `$panel`, their `-lighten-N` and `-darken-N` shades, and a long tail of component variables—that no stylesheet declares, so "not defined in this file" is not an error.

The linting feature requests (extension [#1](https://github.com/Textualize/tcss-vscode-extension/issues/1), [#2](https://github.com/Textualize/tcss-vscode-extension/issues/2), [#3](https://github.com/Textualize/tcss-vscode-extension/issues/3)) are about Python rather than TCSS—`BINDINGS`, watcher methods, event handlers—so they need a different tool and are not covered here.

## About this fork

This is a community-maintained fork of [Textualize/tcss-vscode-extension](https://github.com/Textualize/tcss-vscode-extension), whose last commit was 2024-01-09 and whose last maintainer reply on an issue was 2023-11-22. The open bugs are fixed here. It is not endorsed by Textualize.

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
| [extension#5](https://github.com/Textualize/tcss-vscode-extension/issues/5) | No formatter, and VS Code's CSS formatter cannot be borrowed for TCSS |

## Install

**VS Code** — search the Marketplace for *Textual Syntax Highlighter (Community)*, or:

```bash
code --install-extension KaiErikNiermann.tcss-syntax-highlighter
```

**VSCodium** — the extension is published to [Open VSX](https://open-vsx.org), so the built-in marketplace finds it.

**Cursor, or any editor without a marketplace entry** — every release attaches a `.vsix`, and every build of `main` uploads one as a workflow artifact:

```bash
# from https://github.com/KaiErikNiermann/tcss-vscode-extension/releases
code --install-extension tcss-syntax-highlighter-<version>.vsix
```

## Development

```bash
just dev            # install dependencies and the pre-push hook
just check          # generate-check, lint, typecheck, tests
just install-local  # build, package and install into your editor
```

`just --list` has the rest. Without `just`, the same things are `pnpm install`, `pnpm run check` and `pnpm run package`.

### Tests

Everything runs headless, in about a second:

- **TextMate** — `test/tokenize.mts` drives both grammars through `vscode-textmate` exactly as the editor does, so highlighting is testable per rule.
- **Corpus** — the 161 `.tcss` files Textual and textual-dev ship, vendored under `test/fixtures/corpus` with their commit SHAs. `just corpus-refresh` re-downloads them. Three grammar defects came straight out of this.
- **Fuzzing** — seven fast-check properties over the parser and formatter. Deterministic by default; `just fuzz 50000` runs longer and unseeded.

`just test-e2e` is separate and slower: it downloads a VS Code build into `.vscode-test/`, launches it with the extension loaded, opens the files in `test/e2e/workspace` and checks activation, diagnostics, Format Document, symbols, navigation, rename, completion and folding through the real editor API. It needs a display; on a headless Linux box wrap it in `xvfb-run -a`.

### The grammars

There are two, and they do different jobs.

`syntaxes/*.tmLanguage.json` are TextMate grammars, responsible only for colour. Upstream generated `tcss.tmGrammar.json` from a YAML source in [tcss-textmate-grammar](https://github.com/Textualize/tcss-textmate-grammar), which is as dormant as this repository was, so the JSON here is the source of truth and is edited directly. `syntaxes/python.injection.json` is the injection that finds TCSS inside Python.

`src/language/tcss.langium` is the Langium grammar behind everything else. It follows `textual.css.tokenize`, which is the authority on what Textual accepts. Run `just generate` after editing it; the generated sources are committed and the pre-push hook refuses a push where they have drifted.

## Release notes

See the [change log](./CHANGELOG.md).

## License

MIT, as upstream. See [LICENSE](./LICENSE).
