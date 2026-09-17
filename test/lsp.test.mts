import { EmptyFileSystem, type LangiumDocument } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentSymbol, Location } from 'vscode-languageserver-types';

import type { Stylesheet } from '../src/language/generated/ast.js';
import { createTcssServices } from '../src/language/tcssModule.js';

const { Tcss } = createTcssServices(EmptyFileSystem);
const parse = parseHelper<Stylesheet>(Tcss);

// Langium ships expectFormatting/expectSymbols helpers, but they call node:assert with
// an undefined message, which Node 20+ rejects. Driving the services directly is a few
// more lines and says exactly what is being asserted.

async function format(before: string): Promise<string> {
  const document = await parse(before);
  const edits = await Tcss.lsp.Formatter!.formatDocument(document, {
    textDocument: { uri: document.textDocument.uri },
    options: { insertSpaces: true, tabSize: 4 },
  });
  return TextDocument.applyEdits(document.textDocument, edits);
}

function offsetOf(document: LangiumDocument, needle: string): number {
  const offset = document.textDocument.getText().indexOf(needle);
  expect(offset, `"${needle}" is not in the document`).toBeGreaterThanOrEqual(0);
  return offset;
}

// https://github.com/Textualize/tcss-vscode-extension/issues/5
describe('formatting', () => {
  it('indents a block and puts one declaration per line', async () => {
    expect(await format('Screen{align:center middle;color:red;}')).toBe(
      'Screen {\n    align: center middle;\n    color: red;\n}',
    );
  });

  it('normalises spacing around colons, commas and semicolons', async () => {
    expect(await format('.error,.warning{color   :   red ;}')).toBe(
      '.error, .warning {\n    color: red;\n}',
    );
  });

  it('indents nested rules one level further', async () => {
    expect(await format('Screen{Label{color:red;}}')).toBe(
      'Screen {\n    Label {\n        color: red;\n    }\n}',
    );
  });

  it('keeps !important attached to the value', async () => {
    expect(await format('Button{color:red!important;}')).toBe(
      'Button {\n    color: red !important;\n}',
    );
  });

  it('leaves already-formatted input alone', async () => {
    const formatted = 'Button {\n    color: red;\n}';
    expect(await format(formatted)).toBe(formatted);
  });
});

describe('document symbols', () => {
  it('puts variables and rules in the outline', async () => {
    const document = await parse('$accent: red;\n\nButton {\n    color: $accent;\n}');
    const symbols: DocumentSymbol[] = await Tcss.lsp.DocumentSymbolProvider!.getSymbols(document, {
      textDocument: { uri: document.textDocument.uri },
    });
    expect(symbols.map((symbol) => symbol.name)).toContain('$accent');
  });
});

describe('folding', () => {
  it('offers a folding range for a rule body', async () => {
    const document = await parse('Button {\n    color: red;\n    background: blue;\n}');
    const ranges = await Tcss.lsp.FoldingRangeProvider!.getFoldingRanges(document, {
      textDocument: { uri: document.textDocument.uri },
    });
    expect(ranges.length).toBeGreaterThanOrEqual(1);
    expect(ranges[0]?.startLine).toBe(0);
  });
});

describe('variable navigation', () => {
  const SOURCE =
    '$accent: red;\n\nButton {\n    color: $accent;\n}\n\nLabel {\n    background: $accent;\n}';

  it('goes from a use to the definition', async () => {
    const document = await parse(SOURCE);
    const offset = offsetOf(document, 'color: $accent') + 'color: '.length + 1;
    const targets = await Tcss.lsp.DefinitionProvider!.getDefinition(document, {
      textDocument: { uri: document.textDocument.uri },
      position: document.textDocument.positionAt(offset),
    });
    expect(targets).toHaveLength(1);
    expect(targets?.[0]?.targetRange.start.line).toBe(0);
  });

  it('finds every use of a variable', async () => {
    const document = await parse(SOURCE);
    const offset = offsetOf(document, '$accent') + 1;
    const references: Location[] = await Tcss.lsp.ReferencesProvider!.findReferences(document, {
      textDocument: { uri: document.textDocument.uri },
      position: document.textDocument.positionAt(offset),
      context: { includeDeclaration: false },
    });
    expect(references).toHaveLength(2);
  });

  it('renames a variable everywhere it is used', async () => {
    const document = await parse(SOURCE);
    const offset = offsetOf(document, '$accent') + 1;
    const edit = await Tcss.lsp.RenameProvider!.rename(document, {
      textDocument: { uri: document.textDocument.uri },
      position: document.textDocument.positionAt(offset),
      newName: '$highlight',
    });
    const edits = Object.values(edit?.changes ?? {}).flat();
    expect(edits).toHaveLength(3);
  });
});

describe('completion', () => {
  it('offers the variables a document defines', async () => {
    const source = '$accent: red;\n\nButton {\n    color: $\n}';
    const document = await parse(source);
    const offset = source.indexOf('color: $') + 'color: $'.length;
    const completions = await Tcss.lsp.CompletionProvider!.getCompletion(document, {
      textDocument: { uri: document.textDocument.uri },
      position: document.textDocument.positionAt(offset),
    });
    expect(completions?.items.map((item) => item.label)).toContain('$accent');
  });
});
