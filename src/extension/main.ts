import * as path from 'node:path';

import type * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

/** Holds the running client so `deactivate` can stop it. */
const state: { client?: LanguageClient } = {};

export function activate(context: vscode.ExtensionContext): void {
  const module_ = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));

  const serverOptions: ServerOptions = {
    run: { module: module_, transport: TransportKind.ipc },
    debug: {
      module: module_,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'Textual CSS' }],
  };

  const client = new LanguageClient('tcss', 'Textual CSS', serverOptions, clientOptions);
  state.client = client;
  context.subscriptions.push({ dispose: () => void client.stop() });
  void client.start();
}

export function deactivate(): Promise<void> | undefined {
  return state.client?.stop();
}
