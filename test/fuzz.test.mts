import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import fc from 'fast-check';
import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';

import type { Stylesheet } from '../src/language/generated/ast.js';
import { createTcssServices } from '../src/language/tcssModule.js';

const { Tcss } = createTcssServices(EmptyFileSystem);
const parse = parseHelper<Stylesheet>(Tcss);

const corpusDirectory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'corpus');
const corpus = readdirSync(corpusDirectory)
  .filter((name) => name.endsWith('.tcss'))
  .map((name) => readFileSync(join(corpusDirectory, name), 'utf8'));

/**
 * Deterministic by default so a failure reproduces and CI stays quick. Explore harder
 * with `FUZZ_RUNS=20000 pnpm test`, and drop the seed with `FUZZ_SEED=0` to let
 * fast-check pick one.
 */
const seeded = process.env['FUZZ_SEED'] !== '0';
const RUNS = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 250),
  ...(seeded && { seed: Number(process.env['FUZZ_SEED'] ?? 20_260_917) }),
};

/** Enough headroom for a deliberately heavy FUZZ_RUNS; the default set finishes in ~1s. */
const TIMEOUT = Math.max(30_000, RUNS.numRuns * 20);

async function format(source: string): Promise<string> {
  const document = await parse(source);
  const edits = await Tcss.lsp.Formatter!.formatDocument(document, {
    textDocument: { uri: document.textDocument.uri },
    options: { insertSpaces: true, tabSize: 4 },
  });
  return TextDocument.applyEdits(document.textDocument, edits);
}

// --- generators ----------------------------------------------------------------------

const identifier = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
const typeName = fc.stringMatching(/^[A-Z][A-Za-z0-9]{0,10}$/);

const selector = fc.oneof(
  typeName,
  identifier.map((name) => `.${name}`),
  identifier.map((name) => `#${name}`),
  fc.constant('*'),
  fc.constant('&'),
  fc.tuple(typeName, fc.constantFrom('hover', 'focus', 'disabled')).map(([t, p]) => `${t}:${p}`),
  fc.tuple(typeName, typeName).map(([a, b]) => `${a} > ${b}`),
  fc.tuple(typeName, typeName).map(([a, b]) => `${a} ${b}`),
);

const value = fc.oneof(
  fc.constantFrom('red', 'blue', 'auto', 'center middle', 'bold italic'),
  fc.integer({ min: 0, max: 99 }).map(String),
  fc.integer({ min: 0, max: 99 }).map((n) => `${String(n)}%`),
  fc.integer({ min: 0, max: 99 }).map((n) => `${String(n)}fr`),
  fc.integer({ min: 0, max: 999 }).map((n) => `${String(n)}ms`),
  fc.constantFrom('#ff0000', '#abc', 'rgb(1, 2, 3)'),
  identifier.map((name) => `$${name}`),
  fc.constant('"a string"'),
);

const propertyName = fc.constantFrom('color', 'background', 'width', 'height', 'padding', 'align');
const declaration = fc.tuple(propertyName, value).map(([name, v]) => `${name}: ${v};`);

const ruleSet: fc.Arbitrary<string> = fc.letrec<{ rule: string }>((tie) => {
  const selectors = fc.array(selector, { minLength: 1, maxLength: 3 });
  const entry = fc.oneof({ weight: 4, arbitrary: declaration }, { weight: 1, arbitrary: tie('rule') });
  const body = fc.array(entry, { maxLength: 4 });
  return {
    rule: fc
      .tuple(selectors, body)
      .map(([heads, entries]) => `${heads.join(', ')} {\n${entries.join('\n')}\n}`),
  };
}).rule;

const variableDefinition = fc.tuple(identifier, value).map(([name, v]) => `$${name}: ${v};`);
const stylesheet = fc
  .tuple(
    fc.array(variableDefinition, { maxLength: 3 }),
    fc.array(ruleSet, { minLength: 1, maxLength: 4 }),
  )
  .map(([variables, rules]) => [...variables, ...rules].join('\n\n'));

/** Characters most likely to break structure when dropped into a real stylesheet. */
const MUTATION_CHARACTERS: readonly string[] = [
  '{', '}', '(', ')', ';', ':', ',', '"', "'", '$', '#', '.', '*', '&', '>', '/', '\\',
  '\n', '\t', ' ', '!', '@', '%',
];

/** A corpus file with a handful of characters corrupted. */
const mutationCharacter = fc.constantFrom(...MUTATION_CHARACTERS);
const mutation = fc.tuple(fc.nat(), mutationCharacter);
const mutatedCorpus = fc
  .tuple(fc.constantFrom(...corpus), fc.array(mutation, { minLength: 1, maxLength: 8 }))
  .map(([source, mutations]) => {
    const characters = source.split('');
    for (const [where, replacement] of mutations) {
      characters[where % characters.length] = replacement;
    }
    return characters.join('');
  });

// --- properties ----------------------------------------------------------------------

describe('the parser survives anything', () => {
  it('never throws on arbitrary text', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 400 }), async (source) => {
        expect(await parse(source)).toBeDefined();
      }),
      RUNS,
    );
  }, TIMEOUT);

  it('never throws on arbitrary TCSS-flavoured tokens', async () => {
    const soup = fc
      .array(
        fc.constantFrom(
          '{', '}', ':', ';', ',', '>', '&', '*', '$a', '#id', '.cls', 'Widget', 'color',
          'red', '1fr', '50%', '500ms', '#ff0000', '"s"', '!important', '/* c */', '# c\n',
          '\n', ' ',
        ),
        { maxLength: 60 },
      )
      .map((tokens) => tokens.join(''));
    await fc.assert(
      fc.asyncProperty(soup, async (source) => {
        expect(await parse(source)).toBeDefined();
      }),
      RUNS,
    );
  }, TIMEOUT);

  it('never throws on a corrupted real stylesheet', async () => {
    await fc.assert(
      fc.asyncProperty(mutatedCorpus, async (source) => {
        expect(await parse(source)).toBeDefined();
      }),
      { ...RUNS, numRuns: Math.min(RUNS.numRuns, 150) },
    );
  }, TIMEOUT);
});

describe('generated stylesheets', () => {
  it('always parse without a lexer or parser error', async () => {
    await fc.assert(
      fc.asyncProperty(stylesheet, async (source) => {
        const document = await parse(source);
        expect({
          source,
          lexer: document.parseResult.lexerErrors.map((error) => error.message),
          parser: document.parseResult.parserErrors.map((error) => error.message),
        }).toEqual({ source, lexer: [], parser: [] });
      }),
      RUNS,
    );
  }, TIMEOUT);
});

describe('the formatter', () => {
  it('is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(stylesheet, async (source) => {
        const once = await format(source);
        const twice = await format(once);
        expect(twice).toBe(once);
      }),
      { ...RUNS, numRuns: Math.min(RUNS.numRuns, 100) },
    );
  }, TIMEOUT);

  it('never breaks a stylesheet that parsed', async () => {
    await fc.assert(
      fc.asyncProperty(stylesheet, async (source) => {
        const formatted = await format(source);
        const document = await parse(formatted);
        expect(document.parseResult.parserErrors.map((error) => error.message)).toEqual([]);
      }),
      { ...RUNS, numRuns: Math.min(RUNS.numRuns, 100) },
    );
  }, TIMEOUT);

  it('leaves every corpus file parsing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...corpus), async (source) => {
        const formatted = await format(source);
        const document = await parse(formatted);
        expect(document.parseResult.parserErrors.map((error) => error.message)).toEqual([]);
      }),
      { ...RUNS, numRuns: Math.min(RUNS.numRuns, 80) },
    );
  }, TIMEOUT);
});
