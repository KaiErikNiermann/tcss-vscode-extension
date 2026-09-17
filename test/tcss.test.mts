import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { onLine, tokenFor, tokenize } from './tokenize.mts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The most specific scope on the token whose text is `text`. */
async function scopeOf(source: string, text: string): Promise<string | undefined> {
  const token = tokenFor(await tokenize(source), text);
  return token?.scopes.at(-1);
}

describe('the .tcss grammar', () => {
  it('scopes a widget selector as a tag name', async () => {
    expect(await scopeOf('Button { color: red; }', 'Button')).toContain('entity.name.tag');
  });

  it('scopes an id selector', async () => {
    expect(await scopeOf('#sidebar { color: red; }', 'sidebar')).toContain('entity.other');
  });

  it('scopes a class selector', async () => {
    expect(await scopeOf('.error { color: red; }', 'error')).toContain('entity.other');
  });

  it('scopes a known property name and its keyword value', async () => {
    const tokens = await tokenize('Screen {\n  align: center middle;\n}');
    const property = tokenFor(tokens, 'align');
    const value = tokenFor(tokens, 'center');
    expect(property?.scopes.at(-1)).toContain('support.type.property-name');
    expect(value?.scopes.at(-1)).toContain('support.constant.property-value');
  });

  it('scopes line and block comments', async () => {
    const line = await tokenize('/* a block comment */');
    expect(line[0]?.scopes.at(-1)).toContain('comment');

    const hash = await tokenize('Button {\n  /* padding: 1; */\n}');
    expect(onLine(hash, 2)[0]?.scopes.at(-1)).toContain('comment');
  });

  it('scopes a variable definition and its use', async () => {
    const tokens = await tokenize('$accent: red;\nButton {\n  color: $accent;\n}');
    const definition = onLine(tokens, 1);
    expect(definition[0]?.scopes).toContain('punctuation.definition.variable.tcss');
    expect(definition[1]?.scopes.at(-1)).toBe('variable.tcss');

    const use = onLine(tokens, 3).at(-2);
    expect(use?.text).toBe('accent');
    expect(use?.scopes.at(-1)).toBe('variable.tcss');
  });

  it('scopes a pseudo-class', async () => {
    expect(await scopeOf('Button:hover { color: red; }', 'hover')).toContain(
      'entity.other.attribute-name.pseudo-class',
    );
  });

  it('scopes a combinator', async () => {
    expect(await scopeOf('Screen > Button { color: red; }', '>')).toContain('keyword.operator');
  });
});

// https://github.com/Textualize/tcss-textmate-grammar/issues/8
describe('nested rules (grammar issue #8)', () => {
  const NESTED = [
    'Screen {',
    '    align: center middle;',
    '',
    '    Label {',
    '        color: red;',
    '    }',
    '',
    '    Button {',
    '        color: blue;',
    '    }',
    '}',
  ].join('\n');

  it('scopes the first nested selector as a selector, not a property name', async () => {
    const tokens = await tokenize(NESTED);
    const label = tokenFor(tokens, 'Label');
    expect(label?.scopes.at(-1)).toContain('entity.name.tag.widget.tcss');
    expect(label?.scopes).toContain('meta.selector.tcss');
  });

  it('scopes every nested selector the same way', async () => {
    const tokens = await tokenize(NESTED);
    for (const name of ['Label', 'Button']) {
      expect(tokenFor(tokens, name)?.scopes.at(-1)).toContain('entity.name.tag.widget.tcss');
    }
  });

  it('keeps the braces balanced through the nesting', async () => {
    const tokens = await tokenize(NESTED);
    const closing = tokens.filter((token) => token.text === '}');
    expect(closing).toHaveLength(3);
    for (const brace of closing) {
      expect(brace.scopes.at(-1)).toBe('punctuation.section.property-list.end.bracket.curly.tcss');
    }
  });

  it('handles a nested pseudo-class and the nesting selector', async () => {
    const tokens = await tokenize('Button {\n    &:hover {\n        color: red;\n    }\n}');
    expect(tokenFor(tokens, '&')?.scopes.at(-1)).toContain('entity.name.tag.nesting-selector.tcss');
    expect(tokenFor(tokens, 'hover')?.scopes.at(-1)).toContain(
      'entity.other.attribute-name.pseudo-class',
    );
  });

  it('handles a nested selector list split across lines', async () => {
    const tokens = await tokenize('Screen {\n    Label,\n    Button {\n        color: red;\n    }\n}');
    for (const name of ['Label', 'Button']) {
      expect(tokenFor(tokens, name)?.scopes.at(-1)).toContain('entity.name.tag.widget.tcss');
    }
  });

  it('still reads a declaration inside a nested rule as a declaration', async () => {
    const tokens = await tokenize('Screen {\n    Label {\n        text-align: center;\n    }\n}');
    expect(tokenFor(tokens, 'text-align')?.scopes.at(-1)).toContain('support.type.property-name');
    expect(tokenFor(tokens, 'center')?.scopes.at(-1)).toContain('support.constant.property-value');
  });
});

describe('the bundled example', () => {
  it('tokenises with balanced braces and nothing marked invalid', async () => {
    const source = readFileSync(join(repoRoot, 'example.tcss'), 'utf8');
    const tokens = await tokenize(source);

    expect(tokens.filter((token) => token.scopes.some((s) => s.includes('invalid')))).toEqual([]);

    const opens = tokens.filter((token) => token.text === '{');
    const closes = tokens.filter((token) => token.text === '}');
    expect(closes).toHaveLength(opens.length);
    for (const brace of closes) {
      expect(brace.scopes.at(-1)).toBe('punctuation.section.property-list.end.bracket.curly.tcss');
    }
  });
});
