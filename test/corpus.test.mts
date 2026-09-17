import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, expect, it } from 'vitest';

import type { Stylesheet } from '../src/language/generated/ast.js';
import { createTcssServices } from '../src/language/tcssModule.js';

const { Tcss } = createTcssServices(EmptyFileSystem);
const parse = parseHelper<Stylesheet>(Tcss);

const corpusDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'corpus');
const corpus = readdirSync(corpusDirectory)
  .filter((name) => name.endsWith('.tcss'))
  .toSorted((a, b) => a.localeCompare(b, 'en'));

describe('the real-world corpus', () => {
  it('is not empty, so a wiring mistake cannot make this suite vacuous', () => {
    expect(corpus.length).toBeGreaterThan(100);
  });

  it.each(corpus)('parses %s', async (name) => {
    const document = await parse(readFileSync(join(corpusDirectory, name), 'utf8'));
    expect({
      lexer: document.parseResult.lexerErrors.map((error) => error.message),
      parser: document.parseResult.parserErrors.map((error) => error.message),
    }).toEqual({ lexer: [], parser: [] });
  });
});
