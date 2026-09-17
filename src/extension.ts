import type * as vscode from 'vscode';

/**
 * Everything this extension currently ships — the `.tcss` grammar, the language
 * configuration and the Python injection — is declarative and applies without any
 * code running. The entry point exists so that later work (a TCSS language server,
 * the linting in issues #1-#3, the formatter in issue #5) has somewhere to attach.
 */
export function activate(_context: vscode.ExtensionContext): void {
  // No runtime behaviour yet.
}

export function deactivate(): void {
  // No runtime behaviour yet.
}
