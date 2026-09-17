import { describe, expect, it } from 'vitest';

import { linesScopedWith, onLine, tokenFor, tokenize } from './tokenize.mts';

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

// https://github.com/Textualize/tcss-vscode-extension/issues/7
describe('a single-line quoted CSS assignment (issue #7)', () => {
  const AFTER = ['', 'def compose(self):', '    return None'];

  /** Assert that nothing after `body` is still scoped as TCSS. */
  async function expectNoLeak(body: readonly string[]): Promise<void> {
    const tokens = await python([...body, ...AFTER].join('\n'));
    const leaked = linesScopedWith(tokens, 'tcss').filter((line) => line > body.length);
    expect(leaked).toEqual([]);
    expect(tokenFor(tokens, 'def')?.scopes.at(-1)).toContain('storage.type.function.python');
    expect(tokenFor(tokens, 'return')?.scopes.at(-1)).toContain('keyword.control.flow.python');
  }

  it('terminates on a double-quoted DEFAULT_CSS', async () => {
    await expectNoLeak(['class C(DOMNode):', '    DEFAULT_CSS = "C"']);
  });

  it('terminates on a single-quoted DEFAULT_CSS', async () => {
    await expectNoLeak(['class C(DOMNode):', "    DEFAULT_CSS = 'C'"]);
  });

  it('terminates on a double-quoted CSS holding a real rule', async () => {
    await expectNoLeak(['class C(DOMNode):', '    CSS = "Button { color: red; }"']);
  });

  it('still highlights the rule inside a single-line CSS string', async () => {
    const tokens = await python('class C(DOMNode):\n    CSS = "Button { color: red; }"\n');
    expect(tokenFor(tokens, 'Button')?.scopes.at(-1)).toContain('entity.name.tag.widget.tcss');
    expect(tokenFor(tokens, 'color')?.scopes.at(-1)).toContain('support.type.property-name');
  });

  it('leaves an unrelated CSS enum member alone', async () => {
    // A StrEnum member named CSS is ordinary Python, not a Textual class variable.
    const body = ['import enum', '', 'class Kind(enum.StrEnum):', '    CSS = "css"'];
    await expectNoLeak(body);

    const tokens = await python(body.join('\n'));
    expect(linesScopedWith(tokens, 'tcss')).toEqual([]);
    expect(tokenFor(tokens, 'css')?.scopes.at(-1)).toContain('string.quoted');
  });

  it('does not fire on an identifier that merely ends in CSS', async () => {
    const tokens = await python('SCSS = "scss"\nPREFIX_CSS = "x"\n');
    expect(linesScopedWith(tokens, 'tcss')).toEqual([]);
  });
});

// https://github.com/Textualize/tcss-vscode-extension/issues/6
describe('a commented-out CSS assignment (issue #6)', () => {
  it('stays a comment and does not open a TCSS region', async () => {
    const tokens = await python(
      [
        'class Test(Widget):',
        '    # DEFAULT_CSS = """',
        '    #     Test {',
        '    #         width: auto;',
        '    #     }',
        '    # """',
        '',
        '    def compose(self):',
        '        return None',
      ].join('\n'),
    );

    expect(linesScopedWith(tokens, 'tcss')).toEqual([]);
    for (const line of [2, 3, 4, 5, 6]) {
      const scopes = onLine(tokens, line).map((token) => token.scopes.at(-1) ?? '');
      expect(scopes.every((scope) => scope.includes('comment'))).toBe(true);
    }
    expect(tokenFor(tokens, 'def')?.scopes.at(-1)).toContain('storage.type.function.python');
  });

  it('ignores a commented-out one-line assignment too', async () => {
    const tokens = await python('# CSS = "Button { color: red; }"\nx = 1\n');
    expect(linesScopedWith(tokens, 'tcss')).toEqual([]);
  });

  it('still opens on an ordinary indented class variable', async () => {
    const tokens = await python(
      ['class Test(Widget):', '    DEFAULT_CSS = """', '    Test { width: auto; }', '    """'].join('\n'),
    );
    expect(tokenFor(tokens, 'width')?.scopes.at(-1)).toContain('support.type.property-name');
  });
});
