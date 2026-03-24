import * as vscode from 'vscode';

export enum TokenType {
    Invalid = 'Invalid',
    Word = 'Word',
    Assignment = 'Assignment',
    Arrow = 'Arrow',
    Block = 'Block',
    PartialBlock = 'PartialBlock',
    EndOfBlock = 'EndOfBlock',
    String = 'String',
    PartialString = 'PartialString',
    Comment = 'Comment',
    Whitespace = 'Whitespace',
    Colon = 'Colon',
    Comma = 'Comma',
    CommaAsWord = 'CommaAsWord',
    Insertion = 'Insertion',
    Spaceship = 'Spaceship',
    PHPShortEcho = 'PHPShortEcho',
    From = 'From',
}

export interface Token {
    type: TokenType;
    text: string;
}

export interface BlockComment {
    start: string;
    end: string;
}

export interface StringDelimiterConfig {
    start: string;
    end?: string;
    escapeChar?: string;
    multiline?: boolean;
}

export interface OperatorTokenConfig {
    text: string;
    type: TokenType;
}

export interface KeywordTokenConfig {
    keyword: string;
    type: TokenType;
}

export interface LanguageSyntaxConfig {
    lineComments: string[];
    blockComments: BlockComment[];
    stringDelimiters?: Array<string | StringDelimiterConfig>;
    operatorTokens?: OperatorTokenConfig[];
    keywordTokens?: KeywordTokenConfig[];
    wordLikeTokens?: string[];
}

export interface ResolvedLanguageSyntaxConfig {
    lineComments: string[];
    blockComments: BlockComment[];
    stringDelimiters: StringDelimiterConfig[];
    operatorTokens: OperatorTokenConfig[];
    keywordTokens: KeywordTokenConfig[];
    wordLikeTokens: string[];
}

export interface TokenMatch {
    type: TokenType;
    text: string;
}

export interface CommentMatch {
    text: string;
    isPartial: boolean;
    isBlock: boolean;
}

export interface AlignmentConfig {
    operatorPadding: string;
    significantSpacing: number[];
    commentSpacing: number;
}

export interface BetterAlignConfigAccessor {
    get(key: any, defaultValue?: any): any;
}

export interface LineInfo {
    line: vscode.TextLine;
    sgfntTokenType: TokenType;
    sgfntTokens: TokenType[];
    tokens: Token[];
}

export interface LineRange {
    anchor: number;
    infos: LineInfo[];
}
