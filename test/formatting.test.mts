import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { FormattingOptions } from 'vscode-languageserver-types';

import type { Stylesheet } from '../src/language/generated/ast.js';
import { createTcssServices } from '../src/language/tcssModule.js';

const { Tcss } = createTcssServices(EmptyFileSystem);
const parse = parseHelper<Stylesheet>(Tcss);

const DEFAULT_OPTIONS: FormattingOptions = { insertSpaces: true, tabSize: 4 };

async function format(source: string, options: FormattingOptions = DEFAULT_OPTIONS): Promise<string> {
  const document = await parse(source);
  const edits = await Tcss.lsp.Formatter!.formatDocument(document, {
    textDocument: { uri: document.textDocument.uri },
    options,
  });
  return TextDocument.applyEdits(document.textDocument, edits);
}

/** Every token image in order, which is everything formatting is not allowed to change. */
function tokens(source: string): string[] {
  return Tcss.parser.Lexer.tokenize(source).tokens.map((token) => token.image);
}

async function parserErrors(source: string): Promise<string[]> {
  const document = await parse(source);
  return document.parseResult.parserErrors.map((error) => error.message);
}

/**
 * The three things a formatter must never do, checked together so a failure names the
 * input: change what the document says, stop it parsing, or fail to reach a fixed point.
 */
async function expectStable(source: string): Promise<string> {
  const once = await format(source);
  expect(tokens(once), 'formatting changed the token stream').toEqual(tokens(source));
  expect(await parserErrors(once), 'formatting broke the parse').toEqual(await parserErrors(source));
  expect(await format(once), 'formatting is not idempotent').toBe(once);
  return once;
}

// Cases chosen for the shapes that tend to break a whitespace-driven formatter: empty
// constructs, comments in awkward positions, missing optional punctuation, and anything
// where the formatter has to decide between two reasonable outputs.
const EDGE_CASES: Readonly<Record<string, string>> = {
  'an empty document': '',
  'whitespace only': '\n\n   \n\t\n',
  'a line comment alone': '# just a comment\n',
  'a block comment alone': '/* just a comment */\n',
  'an empty rule': 'Screen {}',
  'an empty rule with a newline inside': 'Screen {\n}',
  'a rule with one declaration': 'Screen { color: red; }',
  'a declaration with no trailing semicolon': 'Screen { color: red }',
  'an empty declaration value': 'Screen { color: ; }',
  'an empty variable value': '$foo:;',
  'a variable with no semicolon': '$foo: red',
  'no trailing newline': 'Screen {\n    color: red;\n}',
  'a trailing newline': 'Screen {\n    color: red;\n}\n',
  'CRLF line endings': 'Screen {\r\n    color: red;\r\n}\r\n',
  'tabs for indentation': 'Screen {\n\tcolor: red;\n}',
  'no whitespace anywhere': 'Screen{color:red;background:blue;}',
  'excessive whitespace': 'Screen    {\n\n\n    color    :    red   ;\n\n\n}',
  'a comment between declarations': 'Screen {\n    color: red;\n    /* why */\n    background: blue;\n}',
  'a comment inside a declaration': 'Screen {\n    width: /* here */ 12;\n}',
  'a trailing line comment': 'Screen {\n    color: red; # why\n}',
  'three levels of nesting': 'A {\n    B {\n        C {\n            color: red;\n        }\n    }\n}',
  'a selector list across lines': 'A,\nB,\nC {\n    color: red;\n}',
  'a nested rule beside a declaration': 'A {\n    color: red;\n\n    B {\n        color: blue;\n    }\n}',
  'the nesting selector': 'A {\n    &:hover {\n        color: red;\n    }\n}',
  'a child combinator': 'A > B > C {\n    color: red;\n}',
  'important': 'A {\n    color: red !important;\n}',
  'a multi-part value': 'A {\n    padding: 1 2 3 4;\n}',
  'a comma-separated value': 'A {\n    transition: background 500ms linear, color 200ms linear;\n}',
  'a colour function': 'A {\n    color: rgb(1, 2, 3);\n}',
  'a string value': 'A {\n    border-title: "hello";\n}',
  'a string holding a brace': 'A {\n    border-title: "a { b";\n}',
  'unicode in a comment': '/* 床前明月光 */\nA {\n    color: red;\n}',
  'an id that looks like a colour': '#a00 {\n    color: #a00;\n}',
  'consecutive pseudo-classes': 'A:focus:hover {\n    color: red;\n}',
  'a rule after a variable': '$a: red;\nA {\n    color: $a;\n}',
  'an empty nested rule': 'A {\n    B {}\n    color: red;\n}',
  'a blank line after the opening brace': 'A {\n\n    color: red;\n}',
  'two blank lines between declarations': 'A {\n    color: red;\n\n\n    background: blue;\n}',
  'a value split across lines': 'A {\n    transition:\n        background 500ms linear,\n        color 200ms linear;\n}',
  'a selector list split one per line': '.aaa,\n.bbb,\n.ccc {\n    color: red;\n}',
  'a badly spaced selector list': '.aaa ,.bbb ,  .ccc {\n    color: red;\n}',
  'an unindented body': 'A {\ncolor: red;\nbackground: blue;\n}',
  'an over-indented body': 'A {\n            color: red;\n}',
  'a variable with messy spacing': '$a   :   red ;',
};

describe('formatter stability', () => {
  it.each(Object.entries(EDGE_CASES))('is stable on %s', async (_name, source) => {
    await expectStable(source);
  });
});

describe('formatter stability on real stylesheets', () => {
  const corpusDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'corpus');
  const corpus = readdirSync(corpusDirectory)
    .filter((name) => name.endsWith('.tcss'))
    .toSorted((a, b) => a.localeCompare(b, 'en'));

  it.each(corpus)('is stable on %s', async (name) => {
    await expectStable(readFileSync(join(corpusDirectory, name), 'utf8'));
  });
});

// These pin decisions about output *shape* rather than stability. Each one was a case
// where the formatter was stable but the result read badly.
describe('formatter output', () => {
  it('keeps an empty rule on one line', async () => {
    expect(await format('A   {   }')).toBe('A {}');
    expect(await format('A {}\nB {}\n')).toBe('A {}\nB {}\n');
  });

  // Line breaks a person put there on purpose. The formatter fixes indentation and
  // spacing; it does not get an opinion about these.
  it.each([
    ['blank lines that group declarations', 'A {\n    color: red;\n\n    background: blue;\n}\n'],
    ['a blank line before a nested rule', 'A {\n    color: red;\n\n    B {\n        color: blue;\n    }\n}\n'],
    ['a blank line after the opening brace', 'A {\n\n    color: red;\n}\n'],
    ['a selector list split one per line', '.aaa,\n.bbb,\n.ccc {\n    color: red;\n}\n'],
  ])('leaves %s alone', async (_name, source) => {
    expect(await format(source)).toBe(source);
  });

  it('still fixes the spacing of a split selector list', async () => {
    expect(await format('.aaa ,\n.bbb  {\n    color: red;\n}\n')).toBe(
      '.aaa,\n.bbb {\n    color: red;\n}\n',
    );
  });

  it('joins a value onto the declaration line however it was split', async () => {
    const canonical = 'A {\n    transition: background 500ms linear, color 200ms linear;\n}\n';
    const spellings = [
      canonical,
      'A {\n    transition:\n        background 500ms linear,\n        color 200ms linear;\n}\n',
      'A {\n    transition: background 500ms linear,\n        color 200ms linear;\n}\n',
      'A {\n    transition:background 500ms linear,color 200ms linear;\n}\n',
    ];
    for (const spelling of spellings) {
      expect(await format(spelling)).toBe(canonical);
    }
  });

  it('indents a body that had no indentation', async () => {
    expect(await format('A {\ncolor: red;\nbackground: blue;\n}\n')).toBe(
      'A {\n    color: red;\n    background: blue;\n}\n',
    );
  });

  it('re-indents a body that had too much', async () => {
    expect(await format('A {\n            color: red;\n}\n')).toBe('A {\n    color: red;\n}\n');
  });
});

describe('formatter options', () => {
  const SOURCE = 'A{B{color:red;}}';

  it('honours a two-space indent', async () => {
    expect(await format(SOURCE, { insertSpaces: true, tabSize: 2 })).toBe(
      'A {\n  B {\n    color: red;\n  }\n}',
    );
  });

  it('honours tab indentation', async () => {
    expect(await format(SOURCE, { insertSpaces: false, tabSize: 4 })).toBe(
      'A {\n\tB {\n\t\tcolor: red;\n\t}\n}',
    );
  });

  it('reaches a fixed point under every option set', async () => {
    for (const options of [
      { insertSpaces: true, tabSize: 2 },
      { insertSpaces: true, tabSize: 4 },
      { insertSpaces: true, tabSize: 8 },
      { insertSpaces: false, tabSize: 4 },
    ] satisfies FormattingOptions[]) {
      const once = await format(SOURCE, options);
      expect(await format(once, options)).toBe(once);
    }
  });
});
