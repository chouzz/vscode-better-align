import { TokenType } from './types';

export const REG_WS = /\s/;

export const BRACKET_PAIR: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')',
};

const BRACKET_ENDINGS = new Set(Object.values(BRACKET_PAIR));

export const SIGNIFICANT_TOKEN_TYPES = new Set<TokenType>([
    TokenType.Assignment,
    TokenType.Colon,
    TokenType.Arrow,
    TokenType.Comment,
    TokenType.From,
]);

export function whitespace(count: number): string {
    return new Array(count + 1).join(' ');
}

export function isEndOfBlockChar(char: string): boolean {
    return BRACKET_ENDINGS.has(char);
}
