# Test fixtures

`MagicPython.tmLanguage.json` is a verbatim copy of VS Code's bundled Python
grammar, taken from `microsoft/vscode` at tag `1.138.0`
(`extensions/python/syntaxes/MagicPython.tmLanguage.json`). It is vendored so the
injection tests can tokenise Python exactly the way the editor does, without
reaching for a VS Code install or the network.

Upstream: https://github.com/MagicStack/MagicPython (MIT), as redistributed by
https://github.com/microsoft/vscode (MIT).
