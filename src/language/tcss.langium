grammar Tcss

// The token shapes below follow textual.css.tokenize, which is the authority on what
// Textual itself accepts. Where this grammar is deliberately looser or stricter than
// the tokenizer, the rule says so.

entry Stylesheet:
    (variables+=VariableDefinition | rules+=RuleSet)*;

// $name: value;   -- the terminating semicolon is optional, as it is in Textual, where
// a newline also ends the value.
// The value may be empty -- `$foo:;` appears in Textual's own test stylesheet -- and
// the terminating semicolon is optional, as it is in Textual, where a newline also ends
// the value.
VariableDefinition:
    name=VARIABLE_DEF ':' value=Value? ';'?;

RuleSet:
    selectors+=SelectorList '{' entries+=BlockEntry* '}';

SelectorList:
    selectors+=Selector (',' selectors+=Selector)*;

// A flat sequence of parts and child combinators.
//
// Descendant combinators are whitespace, which the lexer hides, so `A:focus` and
// `A :focus` reach the parser as the same token sequence. Modelling a compound selector
// as a separate rule would therefore be a fiction, and an ambiguous one: the parser
// cannot tell whether to extend the current compound or start a new one, which sent
// Chevrotain into unbounded recursion on `A :focus :hover {}` from Textual's own
// test_mega_stylesheet.tcss.
Selector:
    elements+=SelectorElement+;

SelectorElement:
    ChildCombinator | SelectorPart;

ChildCombinator:
    value='>';

SelectorPart:
    TypeSelector | ClassSelector | IdSelector | UniversalSelector | NestingSelector | PseudoClass;

// Widget type names start upper case or with an underscore. That is what lets Textual
// tell `Button:hover` (selector) from `align: center` (declaration) inside a nested
// block, and this grammar relies on the same distinction.
TypeSelector:
    name=TYPE_NAME;

ClassSelector:
    name=CLASS_NAME;

// `#a00` is both a valid id and a valid three-digit hex colour, and a stateless lexer
// cannot tell them apart -- Textual can only because its tokenizer knows whether it is
// reading a selector or a value. HEX_COLOR wins in the lexer so that `color: #a00`
// works, so an id selector accepts that spelling back here.
IdSelector:
    name=(ID_NAME | HEX_COLOR);

UniversalSelector:
    value='*';

NestingSelector:
    value='&';

// A parser rule rather than a terminal. As one terminal, `:[a-zA-Z_-]+` would also
// swallow the value in `align:center`, because the lexer has no idea whether it is
// looking at a selector or a declaration. Splitting the colon off lets the parser
// decide, using the same signal Textual uses: a declaration name is lower case and is
// followed by a colon, which is what DECLARATION_NAME's lookahead matches.
PseudoClass:
    ':' name=PseudoClassName;

// In `A:focus:hover`, `focus` is lower case and followed by a colon, so the lexer hands
// it over as DECLARATION_NAME. Accepting both spellings here costs nothing: a pseudo
// class always has its own leading colon, so it can never be confused with a
// declaration.
PseudoClassName returns string:
    TOKEN | DECLARATION_NAME;

// Nesting reuses RuleSet: a nested rule is the same construct, one level in.
BlockEntry:
    Declaration | RuleSet;

// Declaration names start lower case, again matching the tokenizer. The semicolon is
// optional because a closing brace also ends a declaration.
Declaration:
    name=DECLARATION_NAME ':' value=Value? important?='!important'? ';'?;

Value:
    items+=ValueItem (','? items+=ValueItem)*;

ValueItem:
    ColorLiteral | ScalarLiteral | DurationLiteral | NumberLiteral | StringLiteral
    | VariableReference | ColorFunction | KeyValue | Keyword;

ColorFunction:
    name=COLOR_FUNCTION_NAME '(' args+=ValueItem (',' args+=ValueItem)* ')';

VariableReference:
    ref=[VariableDefinition:VARIABLE_REF];

ColorLiteral:      value=HEX_COLOR;
ScalarLiteral:     value=SCALAR;
DurationLiteral:   value=DURATION;
NumberLiteral:     value=NUMBER;
StringLiteral:     value=STRING;
KeyValue:          value=KEY_VALUE;
Keyword:           value=TOKEN;

// --- terminals ---------------------------------------------------------------------

// `# ` opens a line comment; `#` without the space is an id selector. That space is
// load-bearing in Textual's tokenizer too (COMMENT_LINE = r"\# .*$").
hidden terminal LINE_COMMENT: /#[ \t][^\n\r]*/;
hidden terminal BLOCK_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal WS: /\s+/;

terminal COLOR_FUNCTION_NAME: /rgba?|hsla?/;

terminal HEX_COLOR: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/;
terminal SCALAR returns string: /-?(?:\d+\.?\d*|\.\d+)(?:fr|%|vw|vh|w|h)/;
terminal DURATION returns string: /(?:\d+\.?\d*|\.\d+)(?:ms|s)(?![a-zA-Z0-9_-])/;
terminal NUMBER returns string: /-?(?:\d+\.?\d*|\.\d+)/;
terminal STRING: /"[^"\n\r]*"/;
terminal KEY_VALUE: /[a-zA-Z_-][a-zA-Z0-9_-]*=[0-9a-zA-Z_\-\/]+/;

// Split so the parser can tell a definition from a reference without seeing newlines:
// only the definition is followed by a colon.
terminal VARIABLE_DEF: /\$[a-zA-Z0-9_-]+(?=[ \t]*:)/;
terminal VARIABLE_REF: /\$[a-zA-Z0-9_-]+/;

terminal ID_NAME: /#[a-zA-Z_-][a-zA-Z0-9_-]*/;
terminal CLASS_NAME: /\.[a-zA-Z_-][a-zA-Z0-9_-]*/;
terminal TYPE_NAME: /[A-Z_][a-zA-Z0-9_]*/;
terminal DECLARATION_NAME: /[a-z][a-zA-Z0-9_-]*(?=[ \t]*:)/;
terminal TOKEN: /[a-zA-Z_][a-zA-Z0-9_-]*/;
