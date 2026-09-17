import { EmptyFileSystem, type LangiumDocument } from 'langium';
import { parseHelper } from 'langium/test';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Stylesheet } from '../src/language/generated/ast.js';
import { createTcssServices } from '../src/language/tcssModule.js';

const services = createTcssServices(EmptyFileSystem);
const parse = parseHelper<Stylesheet>(services.Tcss);

/** Parse `text` and run validation over it. */
async function check(text: string): Promise<LangiumDocument<Stylesheet>> {
  return parse(text, { validation: true });
}

function lexerAndParserErrors(document: LangiumDocument<Stylesheet>): string[] {
  return [
    ...document.parseResult.lexerErrors.map((e) => e.message),
    ...document.parseResult.parserErrors.map((e) => e.message),
  ];
}

describe('the TCSS parser', () => {
  it('parses a rule with declarations', async () => {
    const document = await parse('Screen {\n    align: center middle;\n    color: red;\n}');
    expect(lexerAndParserErrors(document)).toEqual([]);
    const [rule] = document.parseResult.value.rules;
    expect(rule?.entries).toHaveLength(2);
  });

  it('parses variable definitions and references', async () => {
    const document = await parse('$accent: red;\n\nButton {\n    color: $accent;\n}');
    expect(lexerAndParserErrors(document)).toEqual([]);
    expect(document.parseResult.value.variables.map((v) => v.name)).toEqual(['$accent']);
  });

  it('parses nested rules', async () => {
    const document = await parse('Screen {\n    align: center middle;\n\n    Label {\n        color: red;\n    }\n}');
    expect(lexerAndParserErrors(document)).toEqual([]);
    const [rule] = document.parseResult.value.rules;
    expect(rule?.entries).toHaveLength(2);
  });

  it('parses a selector list with a child combinator', async () => {
    const document = await parse('Screen > Button, .error:hover {\n    color: red;\n}');
    expect(lexerAndParserErrors(document)).toEqual([]);
  });

  it('treats "# " as a line comment and "#id" as a selector', async () => {
    const document = await parse('# a comment\n#sidebar {\n    color: red;\n}');
    expect(lexerAndParserErrors(document)).toEqual([]);
    expect(document.parseResult.value.rules).toHaveLength(1);
  });

  it('parses scalars, durations, colors and strings', async () => {
    const document = await parse(
      'Button {\n    width: 50%;\n    height: 3fr;\n    transition: background 500ms in_out_cubic;\n    background: #ff0000;\n    border-title: "hello";\n}',
    );
    expect(lexerAndParserErrors(document)).toEqual([]);
  });

  it('parses every construct in the valid fixture', async () => {
    const { readFileSync } = await import('node:fs');
    const document = await parse(readFileSync('test/fixtures/valid.tcss', 'utf8'));
    expect(lexerAndParserErrors(document)).toEqual([]);
  });
});

describe('TCSS validation', () => {
  it('accepts a known style', async () => {
    const document = await check('Button {\n    color: red;\n}');
    expect(document.diagnostics ?? []).toEqual([]);
  });

  it('warns about an unknown style and suggests the closest one', async () => {
    const document = await check('Button {\n    colour: red;\n}');
    const [diagnostic] = document.diagnostics ?? [];
    expect(diagnostic?.message).toContain("Unknown style 'colour'");
    expect(diagnostic?.message).toContain("Did you mean 'color'?");
  });

  it('accepts every pseudo-class Textual knows', async () => {
    const document = await check('Button:focus-within {\n    color: red;\n}');
    expect(document.diagnostics ?? []).toEqual([]);
  });

  it('warns about an unknown pseudo-class', async () => {
    const document = await check('Button:hoverr {\n    color: red;\n}');
    const [diagnostic] = document.diagnostics ?? [];
    expect(diagnostic?.message).toContain("Unknown pseudo-class 'hoverr'");
    expect(diagnostic?.message).toContain("Did you mean 'hover'?");
  });
});

describe('the bundled example', () => {
  let document: LangiumDocument<Stylesheet>;

  beforeAll(async () => {
    const { readFileSync } = await import('node:fs');
    document = await check(readFileSync('example.tcss', 'utf8'));
  });

  // example.tcss is a showcase that deliberately mixes in invalid input -- a five-digit
  // hex colour, a lower-case type selector -- so it is not expected to be diagnostic
  // free. What matters is that the planted typo on line 315 is caught.
  it('catches the planted typo', () => {
    expect((document.diagnostics ?? []).map((d) => d.message)).toContain(
      "Unknown style 'brder'. Did you mean 'border'?",
    );
  });

  it('does not invent complaints about its pseudo-classes', () => {
    const pseudo = (document.diagnostics ?? []).filter((d) =>
      typeof d.message === 'string' && d.message.startsWith('Unknown pseudo-class'),
    );
    expect(pseudo).toEqual([]);
  });

  it('does not complain about variables the design system provides', async () => {
    const themed = await check('Button {\n    background: $surface;\n    color: $text-muted;\n}');
    expect(themed.diagnostics ?? []).toEqual([]);
  });

  it('still links a variable the file does define', async () => {
    const linked = await check('$accent: red;\n\nButton {\n    color: $accent;\n}');
    expect(linked.diagnostics ?? []).toEqual([]);
    const value = linked.parseResult.value.rules[0]?.entries[0];
    expect(value?.$type).toBe('Declaration');
  });
});
