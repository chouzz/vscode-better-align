import { AlignmentConfig, BetterAlignConfigAccessor, LineInfo, LineRange, Token, TokenType } from './types';
import { REG_WS, whitespace } from './utils';

export class AlignmentEngine {
    constructor(private readonly _configAccessor: BetterAlignConfigAccessor) {}

    public format(range: LineRange): string[] {
        const anchorLine = this._getAnchorLine(range, this._configAccessor.get('indentBase', 'firstline') as string);
        if (!anchorLine.tokens.length) {
            return [];
        }

        const indentation = this._normalizeIndentation(range);
        const firstWordLength = this._getFirstWordLength(range);
        this._applyFirstWordPadding(range, firstWordLength);
        this._normalizeOperatorWhitespace(range);

        return this._alignRangeTokens(range, indentation, this._getAlignmentConfig(range));
    }

    private _getAnchorLine(range: LineRange, indentBase: string): LineInfo {
        if (indentBase !== 'activeline') {
            return range.infos[0];
        }

        for (const info of range.infos) {
            if (info.line.lineNumber === range.anchor) {
                return info;
            }
        }

        return range.infos[0];
    }

    private _normalizeIndentation(range: LineRange): string {
        let min = Infinity;
        let whiteSpaceType = ' ';
        for (const info of range.infos) {
            const firstNonSpaceCharIndex = info.line.text.search(/\S/);
            min = Math.min(min, firstNonSpaceCharIndex >= 0 ? firstNonSpaceCharIndex : 0);
            if (info.tokens.length > 0 && info.tokens[0].type === TokenType.Whitespace) {
                whiteSpaceType = info.tokens[0].text[0] ?? ' ';
                info.tokens.shift();
            }
            if (info.tokens.length > 1 && info.tokens[info.tokens.length - 1].type === TokenType.Whitespace) {
                info.tokens.pop();
            }
        }

        return whiteSpaceType.repeat(min === Infinity ? 0 : min);
    }

    private _getFirstWordLength(range: LineRange): number {
        let firstWordLength = 0;
        for (const info of range.infos) {
            let count = 0;
            for (const token of info.tokens) {
                if (token.type === info.sgfntTokenType) {
                    count = -count;
                    break;
                }
                if (token.type === TokenType.Block) {
                    continue;
                }
                if (token.type !== TokenType.Whitespace) {
                    count++;
                }
            }

            if (count < -1) {
                firstWordLength = Math.max(firstWordLength, info.tokens[0].text.length);
            }
        }

        return firstWordLength;
    }

    private _applyFirstWordPadding(range: LineRange, firstWordLength: number): void {
        if (firstWordLength <= 0) {
            return;
        }

        const wordSpace: Token = {
            type: TokenType.Insertion,
            text: whitespace(firstWordLength + 1),
        };
        const oneSpace: Token = { type: TokenType.Insertion, text: ' ' };

        for (const info of range.infos) {
            let count = 0;
            for (const token of info.tokens) {
                if (token.type === info.sgfntTokenType) {
                    count = -count;
                    break;
                }
                if (token.type !== TokenType.Whitespace) {
                    count++;
                }
            }

            if (count === -1) {
                info.tokens.unshift(wordSpace);
            } else if (count < -1) {
                if (info.tokens[1].type === TokenType.Whitespace) {
                    info.tokens[1] = oneSpace;
                } else if (info.tokens[0].type === TokenType.CommaAsWord) {
                    info.tokens.splice(1, 0, oneSpace);
                }
                if (info.tokens[0].text.length !== firstWordLength) {
                    const padding: Token = {
                        type: TokenType.Insertion,
                        text: whitespace(firstWordLength - info.tokens[0].text.length),
                    };
                    if (info.tokens[0].type === TokenType.CommaAsWord) {
                        info.tokens.unshift(padding);
                    } else {
                        info.tokens.splice(1, 0, padding);
                    }
                }
            }
        }
    }

    private _normalizeOperatorWhitespace(range: LineRange): void {
        for (const info of range.infos) {
            let index = 1;
            while (index < info.tokens.length) {
                if (info.tokens[index].type === info.sgfntTokenType || info.tokens[index].type === TokenType.Comma) {
                    if (info.tokens[index - 1].type === TokenType.Whitespace) {
                        info.tokens.splice(index - 1, 1);
                        index--;
                    }
                    if (info.tokens[index + 1] && info.tokens[index + 1].type === TokenType.Whitespace) {
                        info.tokens.splice(index + 1, 1);
                    }
                }
                index++;
            }
        }
    }

    private _getAlignmentConfig(range: LineRange): AlignmentConfig {
        const surroundSpace = this._configAccessor.get('surroundSpace');
        const significantType = TokenType[range.infos[0].sgfntTokenType].toLowerCase();
        const defaults: { [key: string]: any } = {
            colon: [0, 1],
            assignment: [1, 1],
            comment: 2,
            arrow: [1, 1],
            from: [1, 1],
        };

        return {
            operatorPadding: this._configAccessor.get('operatorPadding') as string,
            significantSpacing: surroundSpace[significantType] || defaults[significantType],
            commentSpacing: surroundSpace.comment || defaults.comment,
        };
    }

    private _alignRangeTokens(range: LineRange, indentation: string, config: AlignmentConfig): string[] {
        const rangeSize = range.infos.length;
        const column = new Array<number>(rangeSize).fill(0);
        const result = new Array<string>(rangeSize).fill(indentation);

        let exceed = 0;
        let resultSize = 0;

        while (exceed < rangeSize) {
            let operatorSize = 0;

            for (let lineIndex = 0; lineIndex < rangeSize; ++lineIndex) {
                let tokenIndex = column[lineIndex];
                const info = range.infos[lineIndex];
                const tokenSize = info.tokens.length;

                if (tokenIndex === -1) {
                    continue;
                }

                let end = tokenSize;
                let currentResult = result[lineIndex];

                if (tokenSize > 1 && info.tokens[tokenSize - 1].type === TokenType.Comment) {
                    end = tokenSize > 2 && info.tokens[tokenSize - 2].type === TokenType.Whitespace ? tokenSize - 2 : tokenSize - 1;
                }

                for (; tokenIndex < end; ++tokenIndex) {
                    const token = info.tokens[tokenIndex];
                    if (token.type === info.sgfntTokenType || (token.type === TokenType.Comma && tokenIndex !== 0)) {
                        operatorSize = Math.max(operatorSize, token.text.length);
                        break;
                    }
                    currentResult += token.text;
                }

                result[lineIndex] = currentResult;
                if (tokenIndex < end) {
                    resultSize = Math.max(resultSize, currentResult.length);
                }

                if (tokenIndex === end) {
                    exceed++;
                    column[lineIndex] = -1;
                    info.tokens.splice(0, end);
                } else {
                    column[lineIndex] = tokenIndex;
                }
            }

            for (let lineIndex = 0; lineIndex < rangeSize; ++lineIndex) {
                const tokenIndex = column[lineIndex];
                if (tokenIndex === -1) {
                    continue;
                }

                const info = range.infos[lineIndex];
                let currentResult = result[lineIndex];
                let operator = info.tokens[tokenIndex].text;
                if (operator.length < operatorSize) {
                    operator =
                        config.operatorPadding === 'right'
                            ? whitespace(operatorSize - operator.length) + operator
                            : operator + whitespace(operatorSize - operator.length);
                }

                const padding = resultSize > currentResult.length ? whitespace(resultSize - currentResult.length) : '';

                if (info.tokens[tokenIndex].type === TokenType.Comma) {
                    currentResult += operator;
                    if (tokenIndex < info.tokens.length - 1) {
                        currentResult += padding + ' ';
                    }
                } else if (info.tokens.length === 1 && info.tokens[0].type === TokenType.Comment) {
                    exceed++;
                    break;
                } else {
                    if (config.significantSpacing[0] < 0) {
                        if (config.significantSpacing[1] < 0) {
                            let textIndex = currentResult.length - 1;
                            while (textIndex >= 0) {
                                if (currentResult.charAt(textIndex).match(REG_WS)) {
                                    break;
                                }
                                textIndex--;
                            }
                            currentResult =
                                currentResult.substring(0, textIndex + 1) +
                                padding +
                                currentResult.substring(textIndex + 1) +
                                operator;
                        } else {
                            currentResult += operator;
                            if (tokenIndex < info.tokens.length - 1) {
                                currentResult += padding;
                            }
                        }
                    } else {
                        currentResult += padding + whitespace(config.significantSpacing[0]) + operator;
                    }

                    if (config.significantSpacing[1] > 0) {
                        currentResult += whitespace(config.significantSpacing[1]);
                    }
                }

                result[lineIndex] = currentResult;
                column[lineIndex] = tokenIndex + 1;
            }
        }

        return this._alignTrailingComments(range, result, config.commentSpacing);
    }

    private _alignTrailingComments(range: LineRange, result: string[], commentSpacing: number): string[] {
        if (commentSpacing < 0) {
            for (let lineIndex = 0; lineIndex < range.infos.length; ++lineIndex) {
                for (const token of range.infos[lineIndex].tokens) {
                    result[lineIndex] += token.text;
                }
            }
            return result;
        }

        let resultSize = 0;
        for (const currentResult of result) {
            resultSize = Math.max(currentResult.length, resultSize);
        }

        for (let lineIndex = 0; lineIndex < range.infos.length; ++lineIndex) {
            const info = range.infos[lineIndex];
            if (info.tokens.length) {
                const currentResult = result[lineIndex];
                result[lineIndex] =
                    currentResult + whitespace(resultSize - currentResult.length + commentSpacing) + info.tokens.pop()?.text;
            }
        }

        return result;
    }
}
