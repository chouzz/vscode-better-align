import * as vscode from 'vscode';
import {
    CommentMatch,
    LineInfo,
    OperatorTokenConfig,
    ResolvedLanguageSyntaxConfig,
    TokenMatch,
    TokenType,
} from './types';
import { BRACKET_PAIR, isEndOfBlockChar, REG_WS, SIGNIFICANT_TOKEN_TYPES } from './utils';

export class Tokenizer {
    constructor(private readonly _profile: ResolvedLanguageSyntaxConfig) {}

    public tokenize(textLine: vscode.TextLine): LineInfo {
        const text = textLine.text;
        let pos = 0;
        const lineInfo: LineInfo = {
            line: textLine,
            sgfntTokenType: TokenType.Invalid,
            sgfntTokens: [],
            tokens: [],
        };

        while (pos < text.length) {
            const token = this._readToken(text, pos, lineInfo);
            this._pushToken(lineInfo, token.type, token.text);
            pos += token.text.length;
        }

        this._applyKeywordTokens(lineInfo);
        return lineInfo;
    }

    private _readToken(text: string, pos: number, lineInfo: LineInfo): TokenMatch {
        const char = text.charAt(pos);

        if (char.match(REG_WS)) {
            return this._consumeWhitespace(text, pos);
        }

        const stringMatch = this._consumeString(text, pos);
        if (stringMatch) {
            return stringMatch;
        }

        const blockMatch = this._consumeBlock(text, pos);
        if (blockMatch) {
            return blockMatch;
        }

        if (isEndOfBlockChar(char)) {
            return { type: TokenType.EndOfBlock, text: char };
        }

        const commentMatch = this._consumeComment(text, pos);
        if (commentMatch) {
            return { type: TokenType.Comment, text: commentMatch.text };
        }

        if (char === ',') {
            if (lineInfo.tokens.length === 0 || (lineInfo.tokens.length === 1 && lineInfo.tokens[0].type === TokenType.Whitespace)) {
                return { type: TokenType.CommaAsWord, text: char };
            }
            return { type: TokenType.Comma, text: char };
        }

        const wordLikeToken = this._matchWordLikeToken(text, pos);
        if (wordLikeToken) {
            return { type: TokenType.Word, text: wordLikeToken };
        }

        const operatorToken = this._matchOperatorToken(text, pos);
        if (operatorToken) {
            return { type: operatorToken.type, text: operatorToken.text };
        }

        return { type: TokenType.Word, text: char };
    }

    private _consumeWhitespace(text: string, pos: number): TokenMatch {
        let end = pos + 1;
        while (end < text.length && text.charAt(end).match(REG_WS)) {
            end++;
        }

        return {
            type: TokenType.Whitespace,
            text: text.substring(pos, end),
        };
    }

    private _consumeString(text: string, pos: number): TokenMatch | undefined {
        const delimiter = this._profile.stringDelimiters.find((candidate) => {
            return text.substring(pos, pos + candidate.start.length) === candidate.start;
        });
        if (!delimiter) {
            return undefined;
        }

        const endDelimiter = delimiter.end ?? delimiter.start;
        let searchPos = pos + delimiter.start.length;
        while (searchPos < text.length) {
            if (
                text.substring(searchPos, searchPos + endDelimiter.length) === endDelimiter &&
                !this._isEscaped(text, searchPos, delimiter.escapeChar)
            ) {
                return {
                    type: TokenType.String,
                    text: text.substring(pos, searchPos + endDelimiter.length),
                };
            }
            searchPos++;
        }

        return {
            type: TokenType.PartialString,
            text: text.substring(pos),
        };
    }

    private _consumeBlock(text: string, pos: number): TokenMatch | undefined {
        const opening = text.charAt(pos);
        const closing = BRACKET_PAIR[opening];
        if (!closing) {
            return undefined;
        }

        const stack = [closing];
        let searchPos = pos + 1;
        while (searchPos < text.length) {
            const stringMatch = this._consumeString(text, searchPos);
            if (stringMatch) {
                searchPos += stringMatch.text.length;
                continue;
            }

            const commentMatch = this._consumeComment(text, searchPos);
            if (commentMatch) {
                searchPos += commentMatch.text.length;
                continue;
            }

            const current = text.charAt(searchPos);
            const blockClose = BRACKET_PAIR[current];
            if (blockClose) {
                stack.push(blockClose);
                searchPos++;
                continue;
            }

            if (current === stack[stack.length - 1]) {
                stack.pop();
                searchPos++;
                if (stack.length === 0) {
                    return {
                        type: TokenType.Block,
                        text: text.substring(pos, searchPos),
                    };
                }
                continue;
            }

            searchPos++;
        }

        return {
            type: TokenType.PartialBlock,
            text: text.substring(pos),
        };
    }

    private _consumeComment(text: string, pos: number): CommentMatch | undefined {
        for (const comment of this._profile.lineComments) {
            if (text.substring(pos, pos + comment.length) === comment) {
                if (comment === '//' && pos > 0 && text.charAt(pos - 1) === ':') {
                    continue;
                }
                return {
                    text: text.substring(pos),
                    isPartial: false,
                    isBlock: false,
                };
            }
        }

        for (const comment of this._profile.blockComments) {
            if (text.substring(pos, pos + comment.start.length) === comment.start) {
                let searchPos = pos + comment.start.length;
                while (searchPos < text.length) {
                    if (text.substring(searchPos, searchPos + comment.end.length) === comment.end) {
                        return {
                            text: text.substring(pos, searchPos + comment.end.length),
                            isPartial: false,
                            isBlock: true,
                        };
                    }
                    searchPos++;
                }

                return {
                    text: text.substring(pos),
                    isPartial: true,
                    isBlock: true,
                };
            }
        }

        return undefined;
    }

    private _matchWordLikeToken(text: string, pos: number): string | undefined {
        return this._profile.wordLikeTokens.find((token) => text.substring(pos, pos + token.length) === token);
    }

    private _matchOperatorToken(text: string, pos: number): OperatorTokenConfig | undefined {
        return this._profile.operatorTokens.find((token) => text.substring(pos, pos + token.text.length) === token.text);
    }

    private _pushToken(lineInfo: LineInfo, type: TokenType, text: string): void {
        if (!text) {
            return;
        }

        const lastToken = lineInfo.tokens[lineInfo.tokens.length - 1];
        if (lastToken && lastToken.type === type) {
            lastToken.text += text;
        } else {
            lineInfo.tokens.push({ type, text });
        }

        if (SIGNIFICANT_TOKEN_TYPES.has(type) && !lineInfo.sgfntTokens.includes(type)) {
            lineInfo.sgfntTokens.push(type);
        }
    }

    private _applyKeywordTokens(lineInfo: LineInfo): void {
        if (!this._profile.keywordTokens.length) {
            return;
        }

        for (const token of lineInfo.tokens) {
            if (token.type !== TokenType.Word) {
                continue;
            }

            const keyword = this._profile.keywordTokens.find((candidate) => candidate.keyword === token.text);
            if (!keyword) {
                continue;
            }

            token.type = keyword.type;
            if (SIGNIFICANT_TOKEN_TYPES.has(keyword.type) && !lineInfo.sgfntTokens.includes(keyword.type)) {
                lineInfo.sgfntTokens.push(keyword.type);
            }
        }
    }

    private _isEscaped(text: string, pos: number, escapeChar?: string): boolean {
        if (!escapeChar || pos === 0) {
            return false;
        }

        let escapeCount = 0;
        let cursor = pos - 1;
        while (cursor >= 0 && text.substring(cursor, cursor + escapeChar.length) === escapeChar) {
            escapeCount++;
            cursor -= escapeChar.length;
        }

        return escapeCount % 2 === 1;
    }
}
