import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface RawRule {
  readonly include?: string;
  readonly patterns?: readonly RawRule[];
  readonly captures?: Readonly<Record<string, RawRule>>;
  readonly beginCaptures?: Readonly<Record<string, RawRule>>;
  readonly endCaptures?: Readonly<Record<string, RawRule>>;
}

interface RawGrammar extends RawRule {
  readonly scopeName: string;
  readonly repository?: Readonly<Record<string, RawRule>>;
}

function readGrammar(name: string): RawGrammar {
  return JSON.parse(readFileSync(join(repoRoot, 'syntaxes', name), 'utf8')) as RawGrammar;
}

/** Every `include` reachable from `rule`, depth-first, captures included. */
function collectIncludes(rule: RawRule, found: string[] = []): string[] {
  if (rule.include !== undefined) {
    found.push(rule.include);
  }
  const nested = rule.patterns ?? [];
  for (const child of nested) {
    collectIncludes(child, found);
  }
  const captureGroups = [rule.captures, rule.beginCaptures, rule.endCaptures];
  const captures = captureGroups.flatMap((group) => Object.values(group ?? {}));
  for (const capture of captures) {
    collectIncludes(capture, found);
  }
  return found;
}

describe.each([
  ['tcss.tmGrammar.json', 'source.tcss'],
  ['python.injection.json', 'tcss.python.injection'],
])('%s', (file, scopeName) => {
  const grammar = readGrammar(file);

  it('declares the scope name the manifest contributes', () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      contributes: { grammars: { scopeName: string; path: string }[] };
    };
    const contribution = manifest.contributes.grammars.find((g) => g.path.endsWith(file));
    expect(contribution?.scopeName).toBe(scopeName);
    expect(grammar.scopeName).toBe(scopeName);
  });

  it('resolves every local include against its repository', () => {
    const repository = grammar.repository ?? {};
    const unresolved = collectIncludes(grammar)
      .filter((include) => include.startsWith('#'))
      .map((include) => include.slice(1))
      .filter((key) => !Object.hasOwn(repository, key));
    expect(unresolved).toEqual([]);
  });

  it('references only grammars this extension can resolve', () => {
    const external = collectIncludes(grammar).filter((include) => !include.startsWith('#'));
    const known = new Set(['source.tcss', 'source.python', '$self', '$base']);
    expect(external.filter((include) => !known.has(include))).toEqual([]);
  });
});
