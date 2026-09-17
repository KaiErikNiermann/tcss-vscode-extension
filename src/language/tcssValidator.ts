import type { ValidationAcceptor, ValidationChecks } from 'langium';

import type { Declaration, PseudoClass, TcssAstType } from './generated/ast.js';
import type { TcssServices } from './tcssModule.js';
import { PROPERTY_NAMES, PSEUDO_CLASSES } from './tcssVocabulary.js';

/** Wire the checks below into the validation registry. */
export function registerValidationChecks(services: TcssServices): void {
  const checks: ValidationChecks<TcssAstType> = {
    Declaration: validateDeclarationName,
    PseudoClass: validatePseudoClass,
  };
  services.validation.ValidationRegistry.register(checks, {});
}

/** Levenshtein distance between `a` and `b`, iterative over one row. */
/* eslint-disable security/detect-object-injection -- every index here is a loop counter. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      current.push(Math.min(substitution, deletion, insertion));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
/* eslint-enable security/detect-object-injection */

/** The closest known name to `candidate`, when one is close enough to be worth offering. */
function suggest(candidate: string, known: Iterable<string>): string | undefined {
  const ranked = [...known]
    .map((name) => ({ name, distance: editDistance(candidate, name) }))
    .toSorted((a, b) => a.distance - b.distance);
  const best = ranked[0];
  // Beyond roughly a quarter of the word, the "closest" name is a different word.
  const budget = Math.max(1, Math.floor(candidate.length / 4));
  return best !== undefined && best.distance <= budget ? best.name : undefined;
}

/** `Unknown x 'y'.` plus a suggestion when there is a plausible one. */
function unknownMessage(kind: string, name: string, known: Iterable<string>): string {
  const hint = suggest(name, known);
  const suffix = hint === undefined ? '' : ` Did you mean '${hint}'?`;
  return `Unknown ${kind} '${name}'.${suffix}`;
}

function validateDeclarationName(node: Declaration, accept: ValidationAcceptor): void {
  if (PROPERTY_NAMES.has(node.name)) {
    return;
  }
  accept('warning', unknownMessage('style', node.name, PROPERTY_NAMES), {
    node,
    property: 'name',
    code: 'unknown-style',
  });
}

function validatePseudoClass(node: PseudoClass, accept: ValidationAcceptor): void {
  if (PSEUDO_CLASSES.has(node.name)) {
    return;
  }
  accept('warning', unknownMessage('pseudo-class', node.name, PSEUDO_CLASSES), {
    node,
    property: 'name',
    code: 'unknown-pseudo-class',
  });
}
