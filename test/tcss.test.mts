import { describe, expect, it } from 'vitest';

import { onLine, tokenFor, tokenize } from './tokenize.mts';

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
