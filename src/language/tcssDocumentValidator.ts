import {
  DefaultDocumentValidator,
  type LangiumDocument,
  type ValidationOptions,
} from 'langium';
import type { Diagnostic } from 'vscode-languageserver-types';

import { isVariableReference } from './generated/ast.js';

/**
 * Keeps cross-references to variables navigable without reporting the ones that a
 * stylesheet legitimately does not define.
 *
 * Textual injects a design system into every stylesheet -- `$primary`, `$surface`,
 * `$panel`, `$boost`, their `-lighten-N` and `-darken-N` shades, and a long tail of
 * component variables such as `$block-cursor-background`, plus whatever a theme adds
 * through its own `variables` mapping. None of those are declared in the file, and the
 * set moves between Textual releases, so an unresolved reference here means "not
 * defined *in this file*", which is not an error. Reporting it would put a red squiggle
 * under `$surface` in essentially every real stylesheet.
 *
 * The reference itself stays a cross-reference, so go-to-definition, find-references,
 * rename and completion all work for variables the file does define.
 */
export class TcssDocumentValidator extends DefaultDocumentValidator {
  protected override processLinkingErrors(
    document: LangiumDocument,
    diagnostics: Diagnostic[],
    options: ValidationOptions,
  ): void {
    const before = diagnostics.length;
    super.processLinkingErrors(document, diagnostics, options);
    const added = diagnostics.splice(before, diagnostics.length - before);
    diagnostics.push(
      ...added.filter((diagnostic) => !isVariableLinkingError(document, diagnostic)),
    );
  }
}

function isVariableLinkingError(document: LangiumDocument, diagnostic: Diagnostic): boolean {
  return document.references.some(
    (reference) =>
      reference.error !== undefined &&
      isVariableReference(reference.error.info.container) &&
      reference.error.message === diagnostic.message,
  );
}
