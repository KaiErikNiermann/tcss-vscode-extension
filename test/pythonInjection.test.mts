import { describe, expect, it } from 'vitest';

import { linesScopedWith, tokenFor, tokenize } from './tokenize.mts';

const PYTHON = { scopeName: 'source.python' } as const;

/** Tokenise `source` as Python with this extension's injection active. */
function python(source: string) {
  return tokenize(source, PYTHON);
}

describe('the Python injection', () => {
  it('highlights TCSS inside a triple-quoted DEFAULT_CSS', async () => {
    const tokens = await python(
      [
        'class Sidebar(Widget):',
        '    DEFAULT_CSS = """',
        '    Sidebar {',
        '        align: center middle;',
        '    }',
        '    """',
      ].join('\n'),
    );

    expect(tokenFor(tokens, 'align')?.scopes.at(-1)).toContain('support.type.property-name');
    expect(tokenFor(tokens, 'center')?.scopes.at(-1)).toContain('support.constant.property-value');
  });

  it('releases the injection at the closing triple quote', async () => {
    const tokens = await python(
      [
        'class Sidebar(Widget):',
        '    DEFAULT_CSS = """',
        '    Sidebar { align: center middle; }',
        '    """',
        '',
        '    def compose(self):',
        '        return None',
      ].join('\n'),
    );

    expect(linesScopedWith(tokens, 'tcss').every((line) => line <= 4)).toBe(true);
    expect(tokenFor(tokens, 'def')?.scopes.at(-1)).toContain('storage.type.function.python');
    expect(tokenFor(tokens, 'return')?.scopes.at(-1)).toContain('keyword.control.flow.python');
  });

  it('leaves Python alone when the extension is not installed', async () => {
    const source = 'class Sidebar(Widget):\n    DEFAULT_CSS = """\n    Sidebar { color: red; }\n    """\n';
    const without = await tokenize(source, { scopeName: 'source.python', injectTcss: false });
    expect(linesScopedWith(without, 'tcss')).toEqual([]);
  });
});
