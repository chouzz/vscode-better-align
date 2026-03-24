import * as vscode from 'vscode';
import { AlignmentEngine } from './formatter/alignmentEngine';
import { LanguageProfileResolver } from './formatter/languageProfileResolver';
import { RangeDetector } from './formatter/rangeDetector';
import { Tokenizer } from './formatter/tokenizer';
import { BetterAlignConfigAccessor, LanguageSyntaxConfig, LineInfo, LineRange, ResolvedLanguageSyntaxConfig } from './formatter/types';

export { TokenType } from './formatter/types';
export type {
    BlockComment,
    KeywordTokenConfig,
    LanguageSyntaxConfig,
    LineInfo,
    LineRange,
    OperatorTokenConfig,
    ResolvedLanguageSyntaxConfig,
    StringDelimiterConfig,
    Token,
} from './formatter/types';

export class Formatter {
    public process(editor: vscode.TextEditor): void {
        this.editor = editor;

        const ranges = this.getLineRanges(editor);
        const formatted = ranges.map((range) => this.format(range));

        editor.edit((editBuilder) => {
            for (let index = 0; index < ranges.length; ++index) {
                const infos = ranges[index].infos;
                const lastLine = infos[infos.length - 1].line;
                const location = new vscode.Range(infos[0].line.lineNumber, 0, lastLine.lineNumber, lastLine.text.length);
                const eol = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
                const replaced = formatted[index].join(eol);
                if (editor.document.getText(location) === replaced) {
                    continue;
                }
                editBuilder.replace(location, replaced);
            }
        });
    }

    protected editor: vscode.TextEditor;

    protected getLineRanges(editor: vscode.TextEditor): LineRange[] {
        const indentBase = this.getConfig().get('indentBase', 'firstline') as string;
        const importantIndent = indentBase === 'dontchange';
        return this._createRangeDetector().getLineRanges(editor, importantIndent);
    }

    protected getConfig(): BetterAlignConfigAccessor {
        const defaultConfig = vscode.workspace.getConfiguration('betterAlign');
        let langConfig: any = null;

        try {
            langConfig = vscode.workspace.getConfiguration().get(`[${this.editor.document.languageId}]`) as any;
        } catch (error) {}

        return {
            get(key: any, defaultValue?: any): any {
                if (langConfig) {
                    const scopedKey = 'betterAlign.' + key;
                    if (langConfig.hasOwnProperty(scopedKey)) {
                        return langConfig[scopedKey];
                    }
                }

                return defaultConfig.get(key, defaultValue);
            },
        };
    }

    protected getLanguageConfig(): LanguageSyntaxConfig {
        return this._createLanguageProfileResolver().getLanguageConfig();
    }

    protected getLanguageProfile(): ResolvedLanguageSyntaxConfig {
        return this._createLanguageProfileResolver().getLanguageProfile();
    }

    protected tokenize(line: number): LineInfo {
        return this._createTokenizer().tokenize(this.editor.document.lineAt(line));
    }

    protected narrow(start: number, end: number, anchor: number, importantIndent: boolean): LineRange {
        return this._createRangeDetector().narrow(start, end, anchor, importantIndent);
    }

    protected format(range: LineRange): string[] {
        return this._createAlignmentEngine().format(range);
    }

    private _createLanguageProfileResolver(): LanguageProfileResolver {
        return new LanguageProfileResolver(this.editor.document.languageId, this.getConfig());
    }

    private _createTokenizer(): Tokenizer {
        return new Tokenizer(this.getLanguageProfile());
    }

    private _createRangeDetector(): RangeDetector {
        const tokenizer = this._createTokenizer();
        return new RangeDetector((line) => tokenizer.tokenize(this.editor.document.lineAt(line)));
    }

    private _createAlignmentEngine(): AlignmentEngine {
        return new AlignmentEngine(this.getConfig());
    }
}
