// Runs inside a real VS Code extension host (see .vscode-test.mjs), against the built
// extension in out/. The vitest suites drive the Langium services in-process; these
// prove the pieces between them and the editor are wired up: the manifest, the
// language client, the server bundle and the configurationDefaults formatter id.

/// <reference types="mocha" />
// Mocha's globals, not an import: @vscode/test-cli runs its own copy of mocha, and a
// second copy imported here would register suites with a runner that never starts.

import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

const EXTENSION_ID = 'KaiErikNiermann.tcss-syntax-highlighter';
const LANGUAGE_ID = 'Textual CSS';

function workspaceFile(name: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'the e2e run must open test/e2e/workspace');
  return vscode.Uri.joinPath(folder.uri, name);
}

async function open(name: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(workspaceFile(name));
  await vscode.window.showTextDocument(document);
  return document;
}

/** Position of the `nth` character inside the first occurrence of `needle`. */
function positionOf(document: vscode.TextDocument, needle: string, nth = 0): vscode.Position {
  const offset = document.getText().indexOf(needle);
  assert.ok(offset !== -1, `"${needle}" is not in ${document.uri.path}`);
  return document.positionAt(offset + nth);
}

/**
 * Retries `probe` until it returns a value `accept` likes. The language server starts
 * asynchronously after activation, so the first requests can legitimately come back
 * empty.
 */
async function eventually<T>(
  probe: () => Thenable<T>,
  accept: (value: T) => boolean,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (accept(value) || Date.now() > deadline) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('Textual CSS extension', () => {
  let variables: vscode.TextDocument;

  before(async () => {
    variables = await open('variables.tcss');
    // Waiting on a server-backed answer once here keeps the individual tests free of
    // start-up timing.
    const symbols = await eventually(
      () => vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
        'vscode.executeDocumentSymbolProvider',
        variables.uri,
      ),
      (value) => (value?.length ?? 0) > 0,
    );
    assert.ok(symbols?.length, 'the language server never answered');
  });

  it('assigns the Textual CSS language to .tcss files', () => {
    assert.equal(variables.languageId, LANGUAGE_ID);
  });

  it('activates when a .tcss file is opened', () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is not installed in the test host`);
    assert.ok(extension.isActive);
  });

  it('warns about unknown styles and pseudo-classes, with a suggestion', async () => {
    const typos = await open('typos.tcss');
    const diagnostics = await eventually(
      () => Promise.resolve(vscode.languages.getDiagnostics(typos.uri)),
      (value) => value.length >= 2,
    );
    const messages = diagnostics
      .map((diagnostic) => diagnostic.message)
      .toSorted((a, b) => a.localeCompare(b));
    assert.deepEqual(messages, [
      "Unknown pseudo-class 'hovr'. Did you mean 'hover'?",
      "Unknown style 'colr'. Did you mean 'color'?",
    ]);
    for (const diagnostic of diagnostics) {
      assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    }
  });

  it('does not report design-system variables the file does not define', async () => {
    const typos = await open('typos.tcss');
    const diagnostics = await eventually(
      () => Promise.resolve(vscode.languages.getDiagnostics(typos.uri)),
      (value) => value.length >= 2,
    );
    const onSurface = diagnostics.filter((diagnostic) =>
      typos.getText(diagnostic.range).includes('surface'),
    );
    assert.deepEqual(onSurface, []);
  });

  it('is the default formatter, and Format Document applies it', async () => {
    const document = await open('unformatted.tcss');
    try {
      await vscode.commands.executeCommand('editor.action.formatDocument');
      assert.equal(
        document.getText(),
        'Screen {\n    align: center middle;\n    Label {\n        color: red !important;\n    }\n}\n',
      );
    } finally {
      await vscode.commands.executeCommand('workbench.action.files.revert');
    }
  });

  it('lists variables and rules as document symbols', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      variables.uri,
    );
    const names = symbols.map((symbol) => symbol.name);
    assert.ok(names.includes('$accent'), `symbols were ${JSON.stringify(names)}`);
  });

  it('goes from a variable use to its definition', async () => {
    const targets = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      variables.uri,
      positionOf(variables, 'color: $accent', 'color: $'.length),
    );
    assert.equal(targets.length, 1);
    const target = targets[0]!;
    const range = 'targetRange' in target ? target.targetRange : target.range;
    assert.equal(range.start.line, 0);
  });

  it('finds every use of a variable', async () => {
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      variables.uri,
      positionOf(variables, '$accent', 1),
    );
    // The declaration plus its two uses.
    assert.deepEqual(
      references.map((location) => location.range.start.line).toSorted((a, b) => a - b),
      [0, 3, 7],
    );
  });

  it('renames a variable everywhere it is used', async () => {
    const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      variables.uri,
      positionOf(variables, '$accent', 1),
      '$highlight',
    );
    const edits = edit.get(variables.uri);
    assert.equal(edits.length, 3);
    for (const textEdit of edits) {
      assert.equal(textEdit.newText, '$highlight');
    }
  });

  it('completes variables the document defines', async () => {
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      variables.uri,
      positionOf(variables, 'color: $accent', 'color: $'.length),
    );
    const labels = list.items.map((item) =>
      typeof item.label === 'string' ? item.label : item.label.label,
    );
    assert.ok(labels.includes('$accent'), `completions were ${JSON.stringify(labels)}`);
  });

  it('offers folding ranges for rule bodies', async () => {
    const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
      'vscode.executeFoldingRangeProvider',
      variables.uri,
    );
    assert.ok(ranges.some((range) => range.start === 2 && range.end >= 3));
  });
});
