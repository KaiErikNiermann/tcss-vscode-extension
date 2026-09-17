import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting, type NodeFormatter } from 'langium/lsp';

import { isDeclaration, isRuleSet, isSelectorList, isValue } from './generated/ast.js';

/**
 * Formats TCSS the way Textual's own stylesheets are written: the opening brace on the
 * selector's line, one declaration per line, four spaces of indentation per level, and a
 * single space after each colon and comma.
 *
 * This is what issue #5 asked for. Pointing `editor.defaultFormatter` at VS Code's CSS
 * formatter cannot work: that formatter is registered against the `css` language id, and
 * TCSS is not CSS -- it has `$variables`, widget selectors and no at-rules.
 */
export class TcssFormatter extends AbstractFormatter {
  /** Brace on the selector's line, body indented, closing brace on its own line. */
  private static formatRuleSet(formatter: NodeFormatter<AstNode>): void {
    const open = formatter.keyword('{');
    const close = formatter.keyword('}');
    open.prepend(Formatting.oneSpace());
    formatter.interior(open, close).prepend(Formatting.indent());
    close.prepend(Formatting.newLine());
  }

  /** `a, b` rather than `a,b` or `a ,b`. */
  private static formatCommas(formatter: NodeFormatter<AstNode>): void {
    formatter.keywords(',').prepend(Formatting.noSpace()).append(Formatting.oneSpace());
  }

  /** `name: value !important;` */
  private static formatDeclaration(formatter: NodeFormatter<AstNode>): void {
    formatter.keyword(':').prepend(Formatting.noSpace()).append(Formatting.oneSpace());
    formatter.keyword(';').prepend(Formatting.noSpace());
    formatter.keyword('!important').prepend(Formatting.oneSpace());
  }

  protected format(node: AstNode): void {
    const formatter = this.getNodeFormatter(node);

    if (isRuleSet(node)) {
      TcssFormatter.formatRuleSet(formatter);
      return;
    }
    if (isSelectorList(node) || isValue(node)) {
      TcssFormatter.formatCommas(formatter);
      return;
    }
    if (isDeclaration(node)) {
      TcssFormatter.formatDeclaration(formatter);
    }
  }
}
