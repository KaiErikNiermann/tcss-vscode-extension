# TCSS corpus

Real stylesheets, vendored so the parser is tested against what people actually
write rather than against fixtures written to match the grammar. Every file parses
with zero lexer and parser errors, which `test/corpus.test.mts` enforces.

Refresh with `just corpus-refresh`. Collected 2026-09-17.

| Source | Commit | Files |
| --- | --- | --- |
| [Textualize/textual](https://github.com/Textualize/textual) | `06dbeef4bb70` | 160 |
| [Textualize/textual-dev](https://github.com/Textualize/textual-dev) | `e563f96f32d5` | 1 |

All sources are MIT licensed. File names encode their origin path, with `/`
replaced by `__`.
