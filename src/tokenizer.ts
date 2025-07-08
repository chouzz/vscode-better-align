import * as vscode from 'vscode';
import { LanguageProfile } from './languageProfile';

// Re-defining TokenType and Token interface here for now.
// We can move them to a shared file later if needed.
export enum TokenType {
    Invalid = 'Invalid',
    Word = 'Word',
    Assignment = 'Assignment',
    Arrow = 'Arrow', // =>
    Block = 'Block', // {} [] ()
    PartialBlock = 'PartialBlock', // { [ (
    EndOfBlock = 'EndOfBlock', // } ] )
    String = 'String',
    PartialString = 'PartialString',
    Comment = 'Comment',
    Whitespace = 'Whitespace',
    Colon = 'Colon',
    Comma = 'Comma',
    CommaAsWord = 'CommaAsWord', // Comma-first style
    Insertion = 'Insertion', // For tokens inserted by the formatter
    OtherOperator = 'OtherOperator',
}

export interface Token {
    type: TokenType;
    text: string;
}

export interface LineTokenInfo {
    line: vscode.TextLine;
    tokens: Token[];
    // Store significant token types found in the line, similar to sgfntTokens in the original Formatter
    significantTokenTypes: TokenType[];
}

const REG_WS = /\s/;
const BRACKET_PAIR: any = {
    '{': '}',
    '[': ']',
    '(': ')',
};

export class Tokenizer {
    private _languageProfile: LanguageProfile; // Renamed

    constructor(languageProfile: LanguageProfile) {
        this._languageProfile = languageProfile; // Renamed
    }

    public tokenizeLine(textLine: vscode.TextLine): LineTokenInfo {
        const text = textLine.text;
        const tokens: Token[] = [];
        const significantTokenTypes: TokenType[] = [];
        let pos = 0;
        let currentTokenType = TokenType.Invalid;
        let tokenStartPos = -1;

        while (pos < text.length) {
            const char = text.charAt(pos);
            let nextChar = text.charAt(pos + 1);
            let newTokenType: TokenType | null = null;
            let nextSeek = 1;

            // 1. Whitespace
            if (REG_WS.test(char)) {
                newTokenType = TokenType.Whitespace;
            }
            // 2. Comments
            else if (this._languageProfile.lineCommentRegex.source !== '^$' && this._languageProfile.lineCommentRegex.test(text.substring(pos))) { // Renamed
                // Check if it's a line comment that isn't part of a URL (e.g. http://)
                const match = text.substring(pos).match(this._languageProfile.lineCommentRegex); // Renamed
                if (match && (pos === 0 || text.charAt(pos-1) !== ':')) { // Basic check for URLs, can be improved
                    newTokenType = TokenType.Comment;
                    nextSeek = match[0].length;
                }
            } else if (this._languageProfile.blockCommentStartRegex.source !== '^$' && this._languageProfile.blockCommentStartRegex.test(text.substring(pos))) { // Renamed
                const match = text.substring(pos).match(this._languageProfile.blockCommentStartRegex); // Renamed
                if (match) {
                    newTokenType = TokenType.Comment;
                    let commentEndMatch = text.substring(pos + match[0].length).match(this._languageProfile.blockCommentEndRegex); // Renamed
                    if (commentEndMatch) {
                        nextSeek = match[0].length + (commentEndMatch.index ?? 0) + commentEndMatch[0].length;
                    } else {
                        nextSeek = text.length - pos; // Unclosed block comment, consume till end of line
                    }
                }
            }
            // 3. Strings
            else if (this._languageProfile.stringDelimiters.has(char)) { // Renamed
                newTokenType = TokenType.String;
                let lookahead = pos + 1;
                while (lookahead < text.length) {
                    if (text.charAt(lookahead) === char && text.charAt(lookahead - 1) !== '\\') {
                        break;
                    }
                    lookahead++;
                }
                nextSeek = (lookahead < text.length ? lookahead : text.length -1) - pos + 1;
                if (lookahead >= text.length && !(text.charAt(lookahead -1) === char && text.charAt(lookahead - 2) !== '\\') ) {
                     // If loop finished because end of text and last char is not the closing quote
                    newTokenType = TokenType.PartialString;
                }
            }
            // 4. Blocks
            else if (char === '{' || char === '(' || char === '[') {
                newTokenType = TokenType.Block;
                // Simple block handling for now, original had more complex logic for partial blocks
                let bracketCount = 1;
                let lookahead = pos + 1;
                while(lookahead < text.length) {
                    if (text.charAt(lookahead) === char) { // same opening bracket
                        bracketCount++;
                    } else if (text.charAt(lookahead) === BRACKET_PAIR[char] && text.charAt(lookahead - 1) !== '\\') {
                        bracketCount--;
                        if (bracketCount === 0) { break; } // Added curly braces
                    }
                    lookahead++;
                }
                nextSeek = lookahead - pos + 1;
                if (bracketCount > 0 && lookahead >= text.length) {
                    newTokenType = TokenType.PartialBlock;
                }

            } else if (char === '}' || char === ')' || char === ']') {
                newTokenType = TokenType.EndOfBlock;
            }
            // 5. Operators
            else if (char === '=' && nextChar === '>') {
                newTokenType = TokenType.Arrow;
                nextSeek = 2;
            } else if (this._isAssignmentOperator(text.substring(pos))) { // Renamed call
                const op = this._getMatchingAssignmentOperator(text.substring(pos)); // Renamed call
                if (op) {
                    newTokenType = TokenType.Assignment;
                    nextSeek = op.length;
                }
            } else if (this._isOtherOperator(text.substring(pos))) { // Renamed call
                const op = this._getMatchingOtherOperator(text.substring(pos)); // Renamed call
                if (op) {
                    // Using a generic 'OtherOperator' type for now.
                    // We might need more specific types later.
                    newTokenType = TokenType.OtherOperator;
                    nextSeek = op.length;
                }
            }
            // 6. Colon
            else if (char === ':' && nextChar !== ':') { // Avoid matching '::' as a colon for now
                newTokenType = TokenType.Colon;
            }
            // 7. Comma
            else if (char === ',') {
                // Simplified comma logic for now
                newTokenType = TokenType.Comma;
            }
            // 8. Word as default
            else {
                newTokenType = TokenType.Word;
            }

            if (newTokenType && newTokenType !== currentTokenType && tokenStartPos !== -1) {
                tokens.push({ type: currentTokenType, text: text.substring(tokenStartPos, pos) });
                this._addSignificantTokenType(currentTokenType, significantTokenTypes); // Renamed call
                tokenStartPos = -1; // Reset
            }

            if (tokenStartPos === -1 && newTokenType) {
                currentTokenType = newTokenType;
                tokenStartPos = pos;
            }

            if (newTokenType === TokenType.Comment && currentTokenType === TokenType.Comment && this._languageProfile.lineCommentRegex.source !== '^$' && this._languageProfile.lineCommentRegex.test(text.substring(pos))) { // Renamed
                 // Handle line comments fully
                pos = text.length;
            } else {
                pos += nextSeek;
            }
        }

        if (tokenStartPos !== -1) {
            tokens.push({ type: currentTokenType, text: text.substring(tokenStartPos) });
            this._addSignificantTokenType(currentTokenType, significantTokenTypes); // Renamed call
        }

        // Determine CommaAsWord (original logic: if it's the first non-whitespace token)
        if (tokens.length > 0) {
            let firstNonWsIndex = 0;
            while(firstNonWsIndex < tokens.length && tokens[firstNonWsIndex].type === TokenType.Whitespace) {
                firstNonWsIndex++;
            }
            if (firstNonWsIndex < tokens.length && tokens[firstNonWsIndex].type === TokenType.Comma) {
                tokens[firstNonWsIndex].type = TokenType.CommaAsWord;
            }
        }


        return { line: textLine, tokens, significantTokenTypes };
    }

    private _addSignificantTokenType(tokenType: TokenType, significantTokenTypes: TokenType[]): void {
        if (
            tokenType === TokenType.Assignment ||
            tokenType === TokenType.Colon ||
            tokenType === TokenType.Arrow ||
            tokenType === TokenType.Comment ||
            tokenType === TokenType.OtherOperator
        ) {
            if (significantTokenTypes.indexOf(tokenType) === -1) {
                significantTokenTypes.push(tokenType);
            }
        }
    }

    private _isAssignmentOperator(str: string): boolean {
        for (const op of this._languageProfile.assignmentOperators) { // Renamed
            if (str.startsWith(op)) {
                return true;
            }
        }
        return false;
    }

    private _getMatchingAssignmentOperator(str: string): string | null { // Already correctly named
        let longestMatch = null;
        for (const op of this._languageProfile.assignmentOperators) { // Renamed
            if (str.startsWith(op)) {
                if (!longestMatch || op.length > longestMatch.length) {
                    longestMatch = op;
                }
            }
        }
        return longestMatch;
    }

    private _isOtherOperator(str: string): boolean {
        for (const op of this._languageProfile.otherOperators) { // Renamed
            if (str.startsWith(op)) {
                return true;
            }
        }
        return false;
    }

    private _getMatchingOtherOperator(str: string): string | null { // Already correctly named
         let longestMatch = null;
        for (const op of this._languageProfile.otherOperators) { // Renamed
            if (str.startsWith(op)) {
                 if (!longestMatch || op.length > longestMatch.length) {
                    longestMatch = op;
                }
            }
        }
        return longestMatch;
    }
}
