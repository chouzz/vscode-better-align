import * as vscode from 'vscode';
import { Tokenizer, TokenType, Token, LineTokenInfo } from './tokenizer';
import { LanguageProfile } from './languageProfile';

// Renaming LineInfo to FormatterLineInfo to avoid conflict with Tokenizer's LineTokenInfo if used in the same scope outside
export interface FormatterLineInfo {
    line: vscode.TextLine;
    sgfntTokenType: TokenType; // The primary significant token type chosen for alignment in this block
    // sgfntTokens: TokenType[]; // This was used to find common significant tokens, now handled by tokenizer's significantTokenTypes
    tokens: Token[]; // Tokens from the tokenizer, possibly with insertions
    originalTokens: Token[]; // Raw tokens from tokenizer before any modification by formatter
    significantTokenTypes: TokenType[]; // Significant token types from the tokenizer
}

export interface LineRange {
    anchor: number;
    infos: FormatterLineInfo[];
}

const REG_WS = /\s/; // Keep for now, might be useful or moved to language profile

function whitespace(count: number) {
    return new Array(count + 1).join(' ');
}

export class Formatter {
    private _editor: vscode.TextEditor; // Renamed
    private _tokenizer: Tokenizer; // Renamed
    private _languageProfile: LanguageProfile; // Renamed

    /* Align:
     *   operators (defined in LanguageProfile)
     *   trailling comment
     *   preceding comma
     * Ignore anything inside a string, comment (handled by tokenizer), or block (partially by tokenizer)
     */
    constructor(languageProfile: LanguageProfile) {
        this._languageProfile = languageProfile; // Renamed
        this._tokenizer = new Tokenizer(languageProfile); // Renamed
    }

    public process(editor: vscode.TextEditor): void {
        this._editor = editor; // Renamed // Keep editor reference for document access and edits

        // Get line ranges
        const ranges = this.getLineRanges();

        // Format
        let formatted: string[][] = [];
        for (let range of ranges) {
            if (range.infos.length > 0) { // Ensure range is not empty
                formatted.push(this.format(range));
            }
        }

        // Apply
        this._editor.edit((editBuilder) => { // Renamed
            for (let i = 0; i < ranges.length; ++i) {
                if (ranges[i].infos.length === 0) { continue; } // Skip empty ranges // Added curly

                var infos = ranges[i].infos;
                var firstLine = infos[0].line;
                var lastLine = infos[infos.length - 1].line;
                var location = new vscode.Range(firstLine.lineNumber, 0, lastLine.lineNumber, lastLine.text.length);
                const eol = this._editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'; // Renamed
                const replaced = formatted[i].join(eol);

                // Get current text of the range to compare
                const currentText = this._editor.document.getText(location); // Renamed
                if (currentText === replaced) {
                    continue;
                }
                editBuilder.replace(location, replaced);
            }
        });
    }

    // No longer needs editor passed if it's stored on the class
    protected getLineRanges(): LineRange[] {
        var ranges: LineRange[] = [];
        this._editor.selections.forEach((sel) => { // Renamed
            const indentBase = this.getConfig().get('indentBase', 'firstline') as string;
            const importantIndent: boolean = indentBase === 'dontchange';

            let res: LineRange;
            if (sel.isSingleLine) {
                // If this selection is single line. Look up and down to search for the similar neighbour
                ranges.push(this.narrow(0, this._editor.document.lineCount - 1, sel.active.line, importantIndent)); // Renamed
            } else {
                // Otherwise, narrow down the range where to align
                let start = sel.start.line;
                let end = sel.end.line;

                while (true) {
                    res = this.narrow(start, end, start, importantIndent);
                    if (!res.infos.length) { // Stop if narrow returns an empty range
                        if (start <= end) { // Try next line if narrow returned empty for current start
                             start++;
                             if (start > end) { break; } // Added curly
                             continue;
                        } else {
                            break;
                        }
                    }
                    let lastLineInfo = res.infos[res.infos.length - 1];

                    if (lastLineInfo.line.lineNumber > end) {
                        // This can happen if narrow expands beyond the selection end due to partial blocks
                        // We should only add if the first line of the narrowed range is within the selection
                        if (res.infos[0].line.lineNumber <= end) {
                             // Trim infos to be within the original end
                            const trimmedInfos = res.infos.filter(info => info.line.lineNumber <= end);
                            if (trimmedInfos.length > 0) {
                                res.infos = trimmedInfos;
                                lastLineInfo = trimmedInfos[trimmedInfos.length-1];
                            } else {
                                break; // or start = lastLineInfo.line.lineNumber + 1;
                            }
                        } else {
                           break;
                        }
                    }

                    // Check if the first line info has a valid significant token type
                    if (res.infos[0] && res.infos[0].sgfntTokenType !== TokenType.Invalid) {
                        ranges.push(res);
                    } else if (res.infos.length > 0 && res.infos[0].significantTokenTypes.length > 0) {
                        // Fallback if sgfntTokenType was not set but significant tokens exist
                        // This might indicate an issue in narrow's logic for setting sgfntTokenType
                        // For now, let's try to assign one if possible
                        const commonType = this.getCommonSignificantType(res.infos.map(i => i.significantTokenTypes));
                        if (commonType && commonType !== TokenType.Invalid) {
                            res.infos.forEach(info => { info.sgfntTokenType = commonType; }); // Added curly
                            ranges.push(res);
                        }
                    }


                    if (lastLineInfo.line.lineNumber >= end) { // use >= to ensure the last line of selection is processed
                        break;
                    }

                    start = lastLineInfo.line.lineNumber + 1;
                }
            }
        });
        return ranges.filter(r => r.infos.length > 0); // Ensure no empty ranges are returned
    }

    protected getConfig() {
        let defaultConfig = vscode.workspace.getConfiguration('betterAlign');
        // Language-specific settings are now typically handled by VS Code's configuration system directly
        // by defining them like "[typescript].betterAlign.operatorPadding" in settings.json.
        // The `get` method on a ConfigurationSection object already correctly resolves these.
        // So, the custom logic for langConfig might be redundant if settings are structured well.
        // However, keeping it for now to maintain existing behavior if users have old style configs.
        let langConfig: any = null;
        const languageId = this._editor.document.languageId; // Renamed

        try {
            // The direct get `[languageId]` might not work as expected for all settings structures.
            // It's better to let `defaultConfig.get` handle the resolution.
            // If specific overrides are needed, they should be checked individually.
            // For example, vscode.workspace.getConfiguration('', { languageId: languageId }).get('betterAlign.someKey')
            // For now, assuming 'betterAlign.xxx' keys are correctly resolved by `defaultConfig.get` when languageId is active.
        } catch (e) {
            // console.error("Error getting language-specific config:", e);
        }
        // Simplified getConfig: VSCode handles language-specific configurations automatically
        // if they are defined in settings.json e.g. "[typescript]": { "betterAlign.operatorPadding": "left" }
        return defaultConfig;
    }

    // This method is replaced by this.tokenizer.tokenizeLine
    // protected tokenize(line: number): FormatterLineInfo { ... }

    protected hasPartialToken(info: FormatterLineInfo): boolean {
        // Use originalTokens as `tokens` might be modified
        for (let j = info.originalTokens.length - 1; j >= 0; --j) {
            let lastT = info.originalTokens[j];
            if (
                lastT.type === TokenType.PartialBlock ||
                lastT.type === TokenType.EndOfBlock ||
                lastT.type === TokenType.PartialString
            ) {
                return true;
            }
        }
        return false;
    }

    protected hasSameIndent(info1: FormatterLineInfo, info2: FormatterLineInfo): boolean {
        // Use originalTokens for indent check as `tokens` might be modified (e.g. leading whitespace removed)
        var t1 = info1.originalTokens.find(t => t.type !== TokenType.Insertion);
        var t2 = info2.originalTokens.find(t => t.type !== TokenType.Insertion);

        // If either line has no non-insertion tokens, consider indent different or handle as per desired logic
        if (!t1 || !t2) { return false; } // Added curly


        if (t1.type === TokenType.Whitespace) {
            // If both start with whitespace and it's the same text
            if (t2.type === TokenType.Whitespace && t1.text === t2.text) {
                return true;
            }
            // If first starts with whitespace, second doesn't, they don't have same indent
            if (t2.type !== TokenType.Whitespace) {
                return false;
            }
        } else if (t2.type !== TokenType.Whitespace) { // Neither starts with whitespace
            return true;
        }

        return false;
    }

    // Helper to find common significant token types among lines
    protected getCommonSignificantType(linesTokenTypes: TokenType[][]): TokenType | null {
        if (!linesTokenTypes || linesTokenTypes.length === 0) {
            return null;
        }
        let commonTypes = [...linesTokenTypes[0]]; // Start with types from the first line

        for (let i = 1; i < linesTokenTypes.length; i++) {
            commonTypes = commonTypes.filter(type => linesTokenTypes[i].includes(type));
            if (commonTypes.length === 0) { break; } // No common types left
        }

        if (commonTypes.length === 0) { return null; }
        // Prioritize certain types if multiple common types exist (e.g., Assignment over Comment)
        if (commonTypes.includes(TokenType.Assignment)) { return TokenType.Assignment; }
        if (commonTypes.includes(TokenType.Colon)) { return TokenType.Colon; }
        if (commonTypes.includes(TokenType.Arrow)) { return TokenType.Arrow; }
        if (commonTypes.includes(TokenType.OtherOperator)) { return TokenType.OtherOperator; } // Generic operator
        return commonTypes[0]; // Return the first one found or based on some priority
    }


    /*
     * Determine which blocks of code needs to be align.
     * (Logic adapted from original, now uses this.tokenizer)
     */
    protected narrow(start: number, end: number, anchor: number, importantIndent: boolean): LineRange {
        const anchorLineInfo = this._tokenizer.tokenizeLine(this._editor.document.lineAt(anchor)); // Renamed
        if (anchorLineInfo.significantTokenTypes.length === 0 && !this.hasPartialToken({line: anchorLineInfo.line, tokens:[], originalTokens: anchorLineInfo.tokens, sgfntTokenType: TokenType.Invalid, significantTokenTypes: []})) {
             // If anchor line has no significant tokens and no partial tokens, it can't be an anchor for alignment.
            return { anchor, infos: [] };
        }

        const anchorFormatterInfo: FormatterLineInfo = {
            line: anchorLineInfo.line,
            tokens: [...anchorLineInfo.tokens], // Clone tokens for modification
            originalTokens: anchorLineInfo.tokens,
            sgfntTokenType: TokenType.Invalid, // To be determined later
            significantTokenTypes: anchorLineInfo.significantTokenTypes,
        };

        const rangeInfos: FormatterLineInfo[] = [anchorFormatterInfo];
        let currentCommonTypes = [...anchorFormatterInfo.significantTokenTypes];

        if (this.hasPartialToken(anchorFormatterInfo) && currentCommonTypes.length === 0) {
            // If it only has partial token and no other significant tokens, treat it as a single-line range.
             // Determine a default sgfntTokenType if possible (e.g. if it's a comment line)
            if (anchorFormatterInfo.significantTokenTypes.includes(TokenType.Comment)) {
                anchorFormatterInfo.sgfntTokenType = TokenType.Comment;
            } else {
                 // Attempt to set a type if only one significant token type exists
                 if(anchorFormatterInfo.significantTokenTypes.length === 1) {
                    anchorFormatterInfo.sgfntTokenType = anchorFormatterInfo.significantTokenTypes[0];
                 } else {
                    anchorFormatterInfo.sgfntTokenType = TokenType.Invalid; // Or handle as error/no alignment
                 }
            }
            return { anchor, infos: [anchorFormatterInfo] };
        }


        // Look upwards
        for (let i = anchor - 1; i >= start; i--) {
            const lineTokenInfo = this._tokenizer.tokenizeLine(this._editor.document.lineAt(i)); // Renamed
            const formatterInfo: FormatterLineInfo = {
                line: lineTokenInfo.line,
                tokens: [...lineTokenInfo.tokens],
                originalTokens: lineTokenInfo.tokens,
                sgfntTokenType: TokenType.Invalid,
                significantTokenTypes: lineTokenInfo.significantTokenTypes,
            };

            if (this.hasPartialToken(formatterInfo)) { break; }
            if (formatterInfo.significantTokenTypes.length === 0) { break; } // Line with no alignable tokens

            const commonWithCurrent = this.getCommonSignificantType([currentCommonTypes, formatterInfo.significantTokenTypes]);
            if (!commonWithCurrent) { break; }

            currentCommonTypes = currentCommonTypes.filter(type => formatterInfo.significantTokenTypes.includes(type));
            if(currentCommonTypes.length === 0) { break; }


            if (importantIndent && !this.hasSameIndent(anchorFormatterInfo, formatterInfo)) { break; }

            rangeInfos.unshift(formatterInfo);
        }

        // Look downwards
        for (let i = anchor + 1; i <= end; i++) {
            const lineTokenInfo = this._tokenizer.tokenizeLine(this._editor.document.lineAt(i)); // Renamed
            const formatterInfo: FormatterLineInfo = {
                line: lineTokenInfo.line,
                tokens: [...lineTokenInfo.tokens],
                originalTokens: lineTokenInfo.tokens,
                sgfntTokenType: TokenType.Invalid,
                significantTokenTypes: lineTokenInfo.significantTokenTypes,
            };

            const commonWithCurrent = this.getCommonSignificantType([currentCommonTypes, formatterInfo.significantTokenTypes]);
            if (!commonWithCurrent && !this.hasPartialToken(formatterInfo)) { break; } // Break if no common types unless it's a partial token ending the block

            if (commonWithCurrent) {
                 currentCommonTypes = currentCommonTypes.filter(type => formatterInfo.significantTokenTypes.includes(type));
                 if(currentCommonTypes.length === 0 && !this.hasPartialToken(formatterInfo)) { break; }
            } else if (!this.hasPartialToken(formatterInfo)) { // No common and not partial
                break;
            }


            if (importantIndent && !this.hasSameIndent(anchorFormatterInfo, formatterInfo)) { break; }

            rangeInfos.push(formatterInfo);
            if (this.hasPartialToken(formatterInfo)) { break; } // Stop if a partial token is encountered (like end of a multiline string/comment)
        }

        // Determine the significant token type for the entire range
        const overallSgfntType = this.getCommonSignificantType(rangeInfos.map(info => info.significantTokenTypes));

        if (overallSgfntType && overallSgfntType !== TokenType.Invalid) {
            for (let info of rangeInfos) {
                info.sgfntTokenType = overallSgfntType;
            }
        } else if (rangeInfos.length === 1 && rangeInfos[0].significantTokenTypes.length > 0) {
            // For a single line that couldn't find common types (e.g. only a comment)
            // use its own most significant type if possible
            const singleLineSgType = this.getCommonSignificantType([rangeInfos[0].significantTokenTypes]);
            if (singleLineSgType) {
                 rangeInfos[0].sgfntTokenType = singleLineSgType;
            } else {
                 return { anchor, infos: [] }; // Cannot determine alignment type
            }
        } else {
            // If no common significant type could be determined for the block,
            // it might mean the lines are not alignable as a group by a common operator.
            // Or, if only one line, it might be a comment line.
            if (rangeInfos.length === 1 && rangeInfos[0].significantTokenTypes.includes(TokenType.Comment)) {
                 rangeInfos[0].sgfntTokenType = TokenType.Comment;
            } else if (rangeInfos.length > 0 && !rangeInfos.some(info => info.significantTokenTypes.length > 0)) {
                 // All lines have no significant tokens
                 return { anchor, infos: [] };
            } else if (rangeInfos.length > 0) {
                // Fallback: if no common type, maybe treat as invalid or don't align this block.
                // For now, let's try to assign the first significant type of the anchor line if any.
                // This part needs careful consideration of desired behavior.
                const anchorSigTypes = rangeInfos.find(info => info.line.lineNumber === anchor)?.significantTokenTypes;
                if (anchorSigTypes && anchorSigTypes.length > 0) {
                    const typeToUse = this.getCommonSignificantType([anchorSigTypes]) || TokenType.Invalid;
                     rangeInfos.forEach(info => { info.sgfntTokenType = typeToUse; }); // Apply this type to all, potentially risky
                } else {
                    return { anchor, infos: [] }; // Truly no basis for alignment
                }

            } else {
                 return { anchor, infos: [] };
            }
        }


        return { anchor, infos: rangeInfos.filter(info => info.sgfntTokenType !== TokenType.Invalid) };
    }

    protected format(range: LineRange): string[] {
        if (range.infos.length === 0) { return []; }

        // 0. Remove indentation, and trailing whitespace from modifiable tokens list
        let indentation = '';
        let anchorLineInfo = range.infos[0]; // The FormatterLineInfo
        const config = this.getConfig();

        const indentBaseSetting = config.get('indentBase', 'firstline') as string;
        if (indentBaseSetting === 'activeline') {
            const activeLineNum = this._editor.selection.active.line; // Renamed // Changed .lineNumber to .line
            const activeLineInRange = range.infos.find(info => info.line.lineNumber === activeLineNum);
            if (activeLineInRange) {
                anchorLineInfo = activeLineInRange;
            }
        }

        // If anchor line has no original tokens, formatting might be problematic
        if (!anchorLineInfo.originalTokens.length) {
             // return range.infos.map(info => info.line.text); // return original lines
        }

        let minIndent = Infinity;
        let whiteSpaceChar = ' '; // Default whitespace char

        for (let info of range.infos) {
            const firstNonWsIndex = info.line.firstNonWhitespaceCharacterIndex;
            minIndent = Math.min(minIndent, firstNonWsIndex);

            // Use originalTokens to determine the whitespace char, as `tokens` might be modified
            const firstToken = info.originalTokens.find(t => t.type !== TokenType.Insertion); // First actual token
            if (firstToken && firstToken.type === TokenType.Whitespace && firstToken.text.length > 0) {
                whiteSpaceChar = firstToken.text[0];
            }

            // Modify the `tokens` array for formatting. `originalTokens` remains unchanged.
            if (info.tokens.length > 0 && info.tokens[0].type === TokenType.Whitespace) {
                info.tokens.shift();
            }
            if (info.tokens.length > 0 && info.tokens[info.tokens.length - 1].type === TokenType.Whitespace) {
                info.tokens.pop();
            }
        }
        indentation = whiteSpaceChar.repeat(minIndent < Infinity ? minIndent : 0) ;
        /* 1. Special treatment for Word-Word-Operator ( e.g. var abc = )
        For example, without:

        var abc === 123;                var abc     === 123;
        var fsdafsf === 32423,  =>      var fsdafsf === 32423,
        fasdf !== 1231321;              fasdf       !== 1231321;

        with this :

        var abc === 123;                var abc     === 123;
        var fsdafsf === 32423,  =>      var fsdafsf === 32423,
        fasdf !== 1231321;                  fasdf   !== 1231321;
        */

        // Calculate first word's length
        let firstWordLength = 0;
        for (let info of range.infos) {
            let count = 0;
            for (let token of info.tokens) {
                // sgfntTokenType should be set for each info in the range by narrow()
                if (token.type === info.sgfntTokenType ||
                    (info.sgfntTokenType === TokenType.Assignment && this._languageProfile.assignmentOperators.has(token.text)) || // Renamed
                    (info.sgfntTokenType === TokenType.OtherOperator && this._languageProfile.otherOperators.has(token.text)) // Renamed
                    ) {
                    count = -count;
                    break;
                }
                // Skip calculate word length before block, See https://github.com/chouzz/vscode-better-align/issues/57
                if (token.type === TokenType.Block) {
                    continue;
                }
                if (token.type !== TokenType.Whitespace) {
                    ++count;
                }
            }

            if (count < -1) { // Indicates Word-Word-Operator pattern
                const firstTextToken = info.tokens.find(t => t.type !== TokenType.Whitespace && t.type !== TokenType.CommaAsWord);
                if (firstTextToken) {
                    firstWordLength = Math.max(firstWordLength, firstTextToken.text.length);
                }
            }
        }

        // Add white space after the first word
        if (firstWordLength > 0) {
            let wordSpace: Token = {
                type: TokenType.Insertion,
                text: whitespace(firstWordLength + 1), // +1 for space after the word
            };
            let oneSpace: Token = { type: TokenType.Insertion, text: ' ' };

            for (let info of range.infos) {
                let count = 0;
                let firstTokenIndex = -1;
                for (let k = 0; k < info.tokens.length; k++) {
                    const token = info.tokens[k];
                    if (token.type === info.sgfntTokenType ||
                        (info.sgfntTokenType === TokenType.Assignment && this._languageProfile.assignmentOperators.has(token.text)) || // Renamed
                        (info.sgfntTokenType === TokenType.OtherOperator && this._languageProfile.otherOperators.has(token.text)) // Renamed
                        ) {
                        count = -count;
                        break;
                    }
                    if (token.type !== TokenType.Whitespace) {
                        if (firstTokenIndex === -1) { firstTokenIndex = k; } // Added curly
                        ++count;
                    }
                }

                const firstTextToken = info.tokens.find(t => t.type !== TokenType.Whitespace && t.type !== TokenType.CommaAsWord);

                if (count === -1 && firstTextToken) { // Operator is the second non-whitespace token
                    // Insert appropriate spacing to align the start of the first word
                     const currentFirstWordLength = firstTextToken.text.length;
                     if (currentFirstWordLength < firstWordLength) {
                         const wsToInsert = whitespace(firstWordLength - currentFirstWordLength);
                         // Insert after the first word token, before the next token (likely space or operator)
                         let insertPos = info.tokens.indexOf(firstTextToken) + 1;
                         // Check if there is already a whitespace token there
                         if (insertPos < info.tokens.length && info.tokens[insertPos].type === TokenType.Whitespace) {
                             info.tokens[insertPos].text = wsToInsert + " "; // Combine with existing space or replace
                         } else {
                             info.tokens.splice(insertPos, 0, {type: TokenType.Insertion, text: wsToInsert});
                         }
                     }
                     // This logic needs to be careful not to mess up existing spacing too much.
                     // The original code unshifted `wordSpace` which is `whitespace(firstWordLength + 1)`
                     // This effectively standardizes the space *before* the first word if it's part of W-W-Op.
                     // Let's try to replicate that more closely if the pattern is "Word Operator"
                     if (firstTokenIndex !== -1 && info.tokens[firstTokenIndex].type !== TokenType.CommaAsWord) {
                         const lenDiff = firstWordLength - info.tokens[firstTokenIndex].text.length;
                         if (lenDiff > 0) {
                             if (firstTokenIndex + 1 < info.tokens.length && info.tokens[firstTokenIndex+1].type === TokenType.Whitespace) {
                                 info.tokens[firstTokenIndex+1].text = whitespace(lenDiff) + info.tokens[firstTokenIndex+1].text;
                             } else {
                                  info.tokens.splice(firstTokenIndex + 1, 0, {type: TokenType.Insertion, text: whitespace(lenDiff)});
                             }
                         }
                     }


                } else if (count < -1 && firstTextToken) { // Word Word Operator
                    // This is the case "var abc = ..."
                    // Ensure one space after the first word, and then pad if necessary
                    const firstWordActualToken = info.tokens[firstTokenIndex];
                    if (firstWordActualToken.text.length < firstWordLength) {
                         const ws = {
                            type: TokenType.Insertion,
                            text: whitespace(firstWordLength - firstWordActualToken.text.length),
                        };
                        // Insert this whitespace *after* the first word token
                        let insertionPoint = firstTokenIndex + 1;
                        if (insertionPoint < info.tokens.length && info.tokens[insertionPoint].type === TokenType.Whitespace) {
                            // If there's already whitespace, prepend to it
                            info.tokens[insertionPoint].text = ws.text + info.tokens[insertionPoint].text;
                        } else {
                            info.tokens.splice(insertionPoint, 0, ws);
                        }
                    }
                    // Ensure at least one space after the (now padded) first word
                    let spaceAfterFirstWordIndex = firstTokenIndex + ( (firstWordActualToken.text.length < firstWordLength) ? 2:1); // 2 if padding was added, 1 otherwise

                    if (spaceAfterFirstWordIndex < info.tokens.length) {
                        if (info.tokens[spaceAfterFirstWordIndex].type === TokenType.Whitespace) {
                            if(info.tokens[spaceAfterFirstWordIndex].text.length === 0) { info.tokens[spaceAfterFirstWordIndex].text = ' '; } // Added curly
                        } else {
                             info.tokens.splice(spaceAfterFirstWordIndex, 0, oneSpace);
                        }
                    } else {
                         info.tokens.push(oneSpace);
                    }
                }
            }
        }

        // 2. Remove whitespace surrounding operator ( comma in the middle of the line is also consider an operator ).
        for (let info of range.infos) {
            let i = 1;
            while (i < info.tokens.length) {
                const currentToken = info.tokens[i];
                const isSignificantOperator = currentToken.type === info.sgfntTokenType ||
                                            (info.sgfntTokenType === TokenType.Assignment && this._languageProfile.assignmentOperators.has(currentToken.text)) || // Renamed
                                            (info.sgfntTokenType === TokenType.OtherOperator && this._languageProfile.otherOperators.has(currentToken.text)); // Renamed

                if (isSignificantOperator || currentToken.type === TokenType.Comma) {
                    if (info.tokens[i - 1].type === TokenType.Whitespace) {
                        info.tokens.splice(i - 1, 1);
                        --i;
                    }
                    // Check i again due to splice if (i-1) was whitespace
                    if (i < info.tokens.length && info.tokens[i + 1] && info.tokens[i + 1].type === TokenType.Whitespace) {
                        info.tokens.splice(i + 1, 1);
                        // No need to change i here as the next token is now at i+1
                    }
                }
                ++i;
            }
        }

        // 3. Align
        const configOP = config.get('operatorPadding', 'left') as string; // Default to 'left'
        const configWS = config.get('surroundSpace', {}) as any; // Default to empty object

        // Determine the sgfntTokenType for the range (assuming it's uniform, set by narrow())
        // If sgfntTokenType is Invalid for some reason, we might need a default or skip alignment.
        const primarySgfntTokenType = range.infos[0]?.sgfntTokenType || TokenType.Invalid;
        if (primarySgfntTokenType === TokenType.Invalid && !range.infos.every(info => info.sgfntTokenType === TokenType.Comment)) {
            // If not all comments and no valid primary type, maybe return original text or try a different strategy
            // For now, proceed cautiously. This case implies an issue in `narrow` or unalignable block.
        }

        const sttString = TokenType[primarySgfntTokenType]?.toLowerCase() || 'default';

        const defaultConfigSurroundSpaces: any = {
            colon: [0, 1], // no space before, one space after
            assignment: [1, 1], // one space before, one space after
            arrow: [1, 1], // one space before, one space after
            comment: 2, // number of spaces before a standalone or trailing comment
            otheroperator: [1,1], // Default for other operators
        };

        const surroundSpaces = configWS[sttString] || defaultConfigSurroundSpaces[sttString] || [1,1]; // Default to [1,1] if not specified
        const commentSpaceBefore = typeof configWS['comment'] === 'number' ? configWS['comment'] : (typeof defaultConfigSurroundSpaces['comment'] === 'number' ? defaultConfigSurroundSpaces['comment'] : 2);


        const numLines = range.infos.length;
        let currentTokenIndices = new Array<number>(numLines).fill(0);
        let builtLines = new Array<string>(numLines).fill(indentation);
        let maxLineLengthBeforeOperator = 0;
        let maxOperatorLength = 0;
        let linesAreDone = new Array<boolean>(numLines).fill(false);
        let trailingComments = new Array<Token | null>(numLines).fill(null);


        // Phase 1: Process tokens up to the first significant operator (or comma), calculate max lengths
        for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
            const info = range.infos[lineIndex];
            let currentBuiltLine = builtLines[lineIndex];
            let k = currentTokenIndices[lineIndex];
            let foundOperatorThisLine = false;

            // Extract trailing comment first
            if (info.tokens.length > 0 && info.tokens[info.tokens.length - 1].type === TokenType.Comment) {
                trailingComments[lineIndex] = info.tokens.pop()!; // Remove for now, add back later
                // Remove preceding whitespace if any
                if (info.tokens.length > 0 && info.tokens[info.tokens.length - 1].type === TokenType.Whitespace) {
                    info.tokens.pop();
                }
            }


            for (; k < info.tokens.length; k++) {
                const token = info.tokens[k];
                const isSignificant = token.type === info.sgfntTokenType ||
                                    (info.sgfntTokenType === TokenType.Assignment && this._languageProfile.assignmentOperators.has(token.text)) || // Renamed
                                    (info.sgfntTokenType === TokenType.OtherOperator && this._languageProfile.otherOperators.has(token.text)) || // Renamed
                                    (token.type === TokenType.Comma && k !== 0); // Comma is significant if not at start

                if (isSignificant) {
                    maxOperatorLength = Math.max(maxOperatorLength, token.text.length);
                    foundOperatorThisLine = true;
                    break;
                } else {
                    currentBuiltLine += token.text;
                }
            }
            builtLines[lineIndex] = currentBuiltLine;
            currentTokenIndices[lineIndex] = k;
            if (foundOperatorThisLine) {
                maxLineLengthBeforeOperator = Math.max(maxLineLengthBeforeOperator, currentBuiltLine.length - indentation.length);
            } else {
                linesAreDone[lineIndex] = true; // No operator found, line is done except for trailing comment
            }
        }

        // Phase 2: Align operators and add spacing
        for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
            if (linesAreDone[lineIndex] && !trailingComments[lineIndex]) { continue; } // Truly done
             if (currentTokenIndices[lineIndex] >= range.infos[lineIndex].tokens.length && !trailingComments[lineIndex]) {
                linesAreDone[lineIndex] = true;
                continue;
            }


            const info = range.infos[lineIndex];
            let currentBuiltLine = builtLines[lineIndex];
            let k = currentTokenIndices[lineIndex];

            if (k < info.tokens.length) { // If there is an operator token
                const operatorToken = info.tokens[k];
                const operatorText = operatorToken.text;
                let paddedOperatorText = operatorText;

                // Pad operator itself if operatorPadding is 'right' or to match maxOperatorLength
                if (operatorText.length < maxOperatorLength) {
                    if (configOP === 'right') {
                        paddedOperatorText = whitespace(maxOperatorLength - operatorText.length) + operatorText;
                    } else { // 'left' or default
                        paddedOperatorText = operatorText + whitespace(maxOperatorLength - operatorText.length);
                    }
                }

                const currentLengthBeforeOp = currentBuiltLine.length - indentation.length;
                const spacesNeededBeforeOperator = maxLineLengthBeforeOperator - currentLengthBeforeOp;

                if (operatorToken.type === TokenType.Comma) {
                    currentBuiltLine += paddedOperatorText; // Comma typically has no space before, padding handles alignment
                    if (k < info.tokens.length - 1) { // If not the last token
                         currentBuiltLine += " "; // Ensure one space after comma
                    }
                } else { // Assignment, Colon, Arrow, OtherOperator
                    const spaceBeforeConfig = Array.isArray(surroundSpaces) ? surroundSpaces[0] : 0;
                    const spaceAfterConfig = Array.isArray(surroundSpaces) ? surroundSpaces[1] : 0;

                    if (spaceBeforeConfig < 0) { // Stick to left word
                         // This case was complex in original, means operator sticks to word on left,
                         // and padding is applied before that word-operator group.
                         // Simplified: add padding, then operator. Fine-tuning might be needed.
                        currentBuiltLine += whitespace(spacesNeededBeforeOperator) + paddedOperatorText;
                    } else {
                        currentBuiltLine += whitespace(spacesNeededBeforeOperator + spaceBeforeConfig) + paddedOperatorText;
                    }

                    if (spaceAfterConfig > 0 && k < info.tokens.length -1) { // Add space after if not last token and configured
                        currentBuiltLine += whitespace(spaceAfterConfig);
                    }
                }
                k++; // Move past the operator token
            } else if (!trailingComments[lineIndex]) { // No operator, and no trailing comment, line is done
                 linesAreDone[lineIndex] = true;
            }


            // Add remaining tokens for the line
            for (; k < info.tokens.length; k++) {
                currentBuiltLine += info.tokens[k].text;
            }
            builtLines[lineIndex] = currentBuiltLine;
            currentTokenIndices[lineIndex] = k; // Should be end of tokens now
        }

        // Phase 3: Align and add trailing comments
        let maxLineLengthBeforeComment = 0;
        if (trailingComments.some(tc => tc !== null)) {
            for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
                if (trailingComments[lineIndex]) { // Only consider lines that have a comment
                    maxLineLengthBeforeComment = Math.max(maxLineLengthBeforeComment, builtLines[lineIndex].length);
                }
            }

            for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
                if (trailingComments[lineIndex]) {
                    const commentToken = trailingComments[lineIndex]!;
                    const currentLineLen = builtLines[lineIndex].length;
                    const spacesToComment = maxLineLengthBeforeComment - currentLineLen + commentSpaceBefore;
                    builtLines[lineIndex] += whitespace(Math.max(0,spacesToComment)) + commentToken.text;
                }
            }
        }
        return builtLines;
    }
}
