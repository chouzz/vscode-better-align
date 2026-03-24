import * as vscode from 'vscode';
import { LineInfo, LineRange, TokenType } from './types';

export class RangeDetector {
    constructor(private readonly _tokenizeLine: (line: number) => LineInfo) {}

    public getLineRanges(editor: vscode.TextEditor, importantIndent: boolean): LineRange[] {
        const ranges: LineRange[] = [];
        editor.selections.forEach((selection) => {
            let result: LineRange;
            if (selection.isSingleLine) {
                ranges.push(this.narrow(0, editor.document.lineCount - 1, selection.active.line, importantIndent));
                return;
            }

            let start = selection.start.line;
            const end = selection.end.line;
            while (true) {
                result = this.narrow(start, end, start, importantIndent);
                const lastLine = result.infos[result.infos.length - 1];

                if (lastLine.line.lineNumber > end) {
                    break;
                }

                if (result.infos[0] && result.infos[0].sgfntTokenType !== TokenType.Invalid) {
                    ranges.push(result);
                }

                if (lastLine.line.lineNumber === end) {
                    break;
                }

                start = lastLine.line.lineNumber + 1;
            }
        });

        return ranges;
    }

    public narrow(start: number, end: number, anchor: number, importantIndent: boolean): LineRange {
        const anchorToken = this._tokenizeLine(anchor);
        const range: LineRange = { anchor, infos: [anchorToken] };
        let tokenTypes = anchorToken.sgfntTokens;

        if (anchorToken.sgfntTokens.length === 0 || this._hasPartialToken(anchorToken)) {
            return range;
        }

        let current = anchor - 1;
        while (current >= start) {
            const token = this._tokenizeLine(current);
            if (this._hasPartialToken(token)) {
                break;
            }

            const commonTypes = this._arrayAnd(tokenTypes, token.sgfntTokens);
            if (commonTypes.length === 0) {
                break;
            }
            tokenTypes = commonTypes;

            if (importantIndent && !this._hasSameIndent(anchorToken, token)) {
                break;
            }

            range.infos.unshift(token);
            current--;
        }

        current = anchor + 1;
        while (current <= end) {
            const token = this._tokenizeLine(current);
            const commonTypes = this._arrayAnd(tokenTypes, token.sgfntTokens);
            if (commonTypes.length === 0) {
                break;
            }
            tokenTypes = commonTypes;

            if (importantIndent && !this._hasSameIndent(anchorToken, token)) {
                break;
            }

            range.infos.push(token);
            if (this._hasPartialToken(token)) {
                break;
            }

            current++;
        }

        const significantTokenType =
            tokenTypes.indexOf(TokenType.Assignment) >= 0 ? TokenType.Assignment : tokenTypes[0];
        for (const info of range.infos) {
            info.sgfntTokenType = significantTokenType;
        }

        return range;
    }

    private _hasPartialToken(info: LineInfo): boolean {
        for (let index = info.tokens.length - 1; index >= 0; --index) {
            const token = info.tokens[index];
            if (
                token.type === TokenType.PartialBlock ||
                token.type === TokenType.EndOfBlock ||
                token.type === TokenType.PartialString
            ) {
                return true;
            }
        }

        return false;
    }

    private _hasSameIndent(info1: LineInfo, info2: LineInfo): boolean {
        const token1 = info1.tokens[0];
        const token2 = info2.tokens[0];

        if (token1.type === TokenType.Whitespace) {
            return token1.text === token2.text;
        }

        return token2.type !== TokenType.Whitespace;
    }

    private _arrayAnd(array1: TokenType[], array2: TokenType[]): TokenType[] {
        const result: TokenType[] = [];
        const tokenSet = new Set(array1);
        for (const tokenType of array2) {
            if (tokenSet.has(tokenType)) {
                result.push(tokenType);
            }
        }

        return result;
    }
}
