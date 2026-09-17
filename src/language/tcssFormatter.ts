import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting, type NodeFormatter } from 'langium/lsp';

import {
  isDeclaration,
  isRuleSet,
  isSelectorList,
  isValue,
  isVariableDefinition,
  type RuleSet,
} from './generated/ast.js';

/**
 * Formats TCSS the way Textual's own stylesheets are written: the opening brace on the
 * selector's line, one declaration per line, four spaces of indentation per level, and a
 * single space after each colon and comma.
 *
 * This is what issue #5 asked for. Pointing `editor.defaultFormatter` at VS Code's CSS
 * formatter cannot work: that formatter is registered against the `css` language id, and
 * TCSS is not CSS -- it has `$variables`, widget selectors and no at-rules.
 *
 * The formatter is deliberately conservative about the author's line breaks. It fixes
 * indentation and spacing, and leaves the decisions a person made on purpose alone.
 */
export class TcssFormatter extends AbstractFormatter {
  /**
   * Brace on the selector's line, body indented, closing brace on its own line.
   *
   * `allowMore` on both moves is what preserves blank lines between declarations. Without
   * it the formatter collapses every grouping blank line inside a block while leaving the
   * ones between top-level rules alone, which is both jarring and inconsistent.
   *
   * An empty rule stays on one line. `A {}` is how these are written -- Textual's own
   * test_mega_stylesheet.tcss has over a hundred of them -- and splitting each across two
   * lines doubles the file for nothing.
   */
  private static formatRuleSet(node: RuleSet, formatter: NodeFormatter<AstNode>): void {
    const open = formatter.keyword('{');
    const close = formatter.keyword('}');
    open.prepend(Formatting.oneSpace());

    if (node.entries.length === 0) {
      close.prepend(Formatting.noSpace());
      return;
    }

    formatter.interior(open, close).prepend(Formatting.indent({ allowMore: true }));
    close.prepend(Formatting.newLine({ allowMore: true }));
  }

  /**
   * `a, b` rather than `a,b` or `a ,b`, unless the author put each item on its own line.
   *
   * A selector list split one-per-line is a deliberate choice, and joining a dozen
   * selectors onto a single long line is worse than leaving them. `fit` keeps whichever
   * of the two shapes is already there.
   */
  private static formatCommas(formatter: NodeFormatter<AstNode>, keepLineBreaks: boolean): void {
    formatter
      .keywords(',')
      .prepend(Formatting.noSpace())
      .append(keepLineBreaks ? Formatting.fit(Formatting.newLine(), Formatting.oneSpace()) : Formatting.oneSpace());
  }

  /**
   * `name: value !important;`
   *
   * The space after the colon is only asked for when there is a value to separate it
   * from. Both `color: ;` and `$foo: ;` are accepted by Textual, and asking for a space
   * after the colon *and* no space before the semicolon puts two rules in direct conflict
   * over the same gap: the formatter then alternates between `color:;` and `color: ;` on
   * successive runs, so format-on-save never settles.
   */
  private static formatAssignment(formatter: NodeFormatter<AstNode>, hasValue: boolean): void {
    const colon = formatter.keyword(':').prepend(Formatting.noSpace());
    if (hasValue) {
      colon.append(Formatting.oneSpace());
    }
    formatter.keyword(';').prepend(Formatting.noSpace());
  }

  protected format(node: AstNode): void {
    const formatter = this.getNodeFormatter(node);

    if (isRuleSet(node)) {
      TcssFormatter.formatRuleSet(node, formatter);
      return;
    }
    if (isSelectorList(node)) {
      TcssFormatter.formatCommas(formatter, true);
      return;
    }
    if (isValue(node)) {
      TcssFormatter.formatCommas(formatter, false);
      return;
    }
    if (isDeclaration(node)) {
      TcssFormatter.formatAssignment(formatter, node.value !== undefined);
      formatter.keyword('!important').prepend(Formatting.oneSpace());
      return;
    }
    if (isVariableDefinition(node)) {
      TcssFormatter.formatAssignment(formatter, node.value !== undefined);
    }
  }
}
