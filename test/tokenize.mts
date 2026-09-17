import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as oniguruma from 'vscode-oniguruma';
import * as textmate from 'vscode-textmate';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

/** Scope names this repository owns, mapped to the grammar file that defines them. */
const GRAMMAR_FILES: Readonly<Record<string, string>> = {
  'source.tcss': join(repoRoot, 'syntaxes', 'tcss.tmGrammar.json'),
  'tcss.python.injection': join(repoRoot, 'syntaxes', 'python.injection.json'),
  'source.python': join(here, 'fixtures', 'MagicPython.tmLanguage.json'),
};

/** One tokenised slice of a line, with the scope stack the editor would apply to it. */
export interface Token {
  readonly line: number;
  readonly startIndex: number;
  readonly text: string;
  readonly scopes: readonly string[];
}

function onigWasm(): ArrayBuffer {
  const require_ = createRequire(import.meta.url);
  const entry = require_.resolve('vscode-oniguruma');
  return readFileSync(join(dirname(entry), 'onig.wasm')).buffer;
}

const onigLib: Promise<textmate.IOnigLib> = (async () => {
  await oniguruma.loadWASM(onigWasm());
  return {
    createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns),
    createOnigString: (source: string) => new oniguruma.OnigString(source),
  };
})();

function createRegistry(withPythonInjection: boolean): textmate.Registry {
  return new textmate.Registry({
    onigLib,
    loadGrammar: (scopeName) => {
      const file = GRAMMAR_FILES[scopeName];
      return Promise.resolve(
        file === undefined ? null : textmate.parseRawGrammar(readFileSync(file, 'utf8'), file),
      );
    },
    getInjections: (scopeName) =>
      withPythonInjection && scopeName === 'source.python' ? ['tcss.python.injection'] : undefined,
  });
}

/**
 * Tokenise `source` the way VS Code would, using the grammars in this repository.
 *
 * `scopeName` picks the top-level grammar. Pass `source.python` to exercise the
 * injection; pass `injectTcss: false` to see what plain Python would look like
 * without this extension installed, which is what the leak tests compare against.
 */
export async function tokenize(
  source: string,
  options: { scopeName?: string; injectTcss?: boolean } = {},
): Promise<Token[]> {
  const { scopeName = 'source.tcss', injectTcss = true } = options;
  const grammar = await createRegistry(injectTcss).loadGrammar(scopeName);
  if (grammar === null) {
    throw new Error(`no grammar registered for ${scopeName}`);
  }

  const tokens: Token[] = [];
  let stack = textmate.INITIAL;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const result = grammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    const meaningful = result.tokens.filter(
      (token) => line.slice(token.startIndex, token.endIndex).trim() !== '',
    );
    for (const token of meaningful) {
      tokens.push({
        line: index + 1,
        startIndex: token.startIndex,
        text: line.slice(token.startIndex, token.endIndex),
        scopes: token.scopes,
      });
    }
  }
  return tokens;
}

/** The tokens on `line`, in source order. */
export function onLine(tokens: readonly Token[], line: number): Token[] {
  return tokens.filter((token) => token.line === line);
}

/** The first token whose text is exactly `text`, or `undefined`. */
export function tokenFor(tokens: readonly Token[], text: string): Token | undefined {
  return tokens.find((token) => token.text === text);
}

/** Every line carrying at least one scope that contains `needle`, ascending. */
export function linesScopedWith(tokens: readonly Token[], needle: string): number[] {
  const lines = tokens
    .filter((token) => token.scopes.some((scope) => scope.includes(needle)))
    .map((token) => token.line);
  return [...new Set(lines)].toSorted((a, b) => a - b);
}
