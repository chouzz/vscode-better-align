import {
    BetterAlignConfigAccessor,
    KeywordTokenConfig,
    LanguageSyntaxConfig,
    OperatorTokenConfig,
    ResolvedLanguageSyntaxConfig,
    StringDelimiterConfig,
    TokenType,
} from './types';

const C_STYLE_COMMENTS: LanguageSyntaxConfig = {
    lineComments: ['//'],
    blockComments: [{ start: '/*', end: '*/' }],
};

const HASH_COMMENTS: LanguageSyntaxConfig = {
    lineComments: ['#'],
    blockComments: [],
};

const SEMICOLON_COMMENTS: LanguageSyntaxConfig = {
    lineComments: [';'],
    blockComments: [],
};

const DEFAULT_STRING_DELIMITERS: Array<string | StringDelimiterConfig> = ['"', "'", '`'];
const PYTHON_STRING_DELIMITERS: Array<string | StringDelimiterConfig> = ['"""', "'''", '"', "'"];
const DEFAULT_WORD_LIKE_TOKENS = ['::'];
const DEFAULT_OPERATOR_TOKENS: OperatorTokenConfig[] = [
    { text: '<=>', type: TokenType.Spaceship },
    { text: '<?=', type: TokenType.PHPShortEcho },
    { text: '=>', type: TokenType.Arrow },
    { text: '>>=', type: TokenType.Assignment },
    { text: '<<=', type: TokenType.Assignment },
    { text: '**=', type: TokenType.Assignment },
    { text: '&&=', type: TokenType.Assignment },
    { text: '||=', type: TokenType.Assignment },
    { text: '??=', type: TokenType.Assignment },
    { text: '===', type: TokenType.Assignment },
    { text: '!==', type: TokenType.Assignment },
    { text: '+=', type: TokenType.Assignment },
    { text: '-=', type: TokenType.Assignment },
    { text: '*=', type: TokenType.Assignment },
    { text: '/=', type: TokenType.Assignment },
    { text: '%=', type: TokenType.Assignment },
    { text: '~=', type: TokenType.Assignment },
    { text: '|=', type: TokenType.Assignment },
    { text: '^=', type: TokenType.Assignment },
    { text: '&=', type: TokenType.Assignment },
    { text: '.=', type: TokenType.Assignment },
    { text: ':=', type: TokenType.Assignment },
    { text: '!=', type: TokenType.Assignment },
    { text: '==', type: TokenType.Assignment },
    { text: '?:', type: TokenType.Colon },
    { text: '=', type: TokenType.Assignment },
    { text: ':', type: TokenType.Colon },
];

const FROM_KEYWORD: KeywordTokenConfig = { keyword: 'from', type: TokenType.From };

const LANGUAGE_ALIASES: { [languageId: string]: string } = {
    javascriptreact: 'javascript',
    jsx: 'javascript',
    jsonc: 'javascript',
    typescriptreact: 'typescript',
    tsx: 'typescript',
};

const DEFAULT_LANGUAGE_CONFIGS: { [languageId: string]: LanguageSyntaxConfig } = {
    bash: HASH_COMMENTS,
    c: C_STYLE_COMMENTS,
    clojure: SEMICOLON_COMMENTS,
    cpp: C_STYLE_COMMENTS,
    csharp: C_STYLE_COMMENTS,
    css: { lineComments: [], blockComments: [{ start: '/*', end: '*/' }] },
    dockerfile: HASH_COMMENTS,
    elm: { lineComments: ['--'], blockComments: [{ start: '{-', end: '-}' }] },
    fish: HASH_COMMENTS,
    go: C_STYLE_COMMENTS,
    haskell: { lineComments: ['--'], blockComments: [{ start: '{-', end: '-}' }] },
    html: { lineComments: [], blockComments: [{ start: '<!--', end: '-->' }] },
    ini: { lineComments: ['#', ';'], blockComments: [] },
    java: C_STYLE_COMMENTS,
    javascript: {
        ...C_STYLE_COMMENTS,
        keywordTokens: [FROM_KEYWORD],
    },
    javascriptreact: {
        ...C_STYLE_COMMENTS,
        keywordTokens: [FROM_KEYWORD],
    },
    julia: { lineComments: ['#'], blockComments: [{ start: '#=', end: '=#' }] },
    kotlin: C_STYLE_COMMENTS,
    less: C_STYLE_COMMENTS,
    lisp: SEMICOLON_COMMENTS,
    lua: { lineComments: ['--'], blockComments: [{ start: '--[[', end: ']]' }] },
    makefile: HASH_COMMENTS,
    matlab: { lineComments: ['%'], blockComments: [{ start: '%{', end: '%}' }] },
    perl: HASH_COMMENTS,
    php: { ...C_STYLE_COMMENTS, lineComments: ['//', '#'] },
    powershell: HASH_COMMENTS,
    python: {
        ...HASH_COMMENTS,
        stringDelimiters: PYTHON_STRING_DELIMITERS,
    },
    r: HASH_COMMENTS,
    ruby: HASH_COMMENTS,
    rust: C_STYLE_COMMENTS,
    scala: C_STYLE_COMMENTS,
    scheme: SEMICOLON_COMMENTS,
    scss: C_STYLE_COMMENTS,
    shellscript: HASH_COMMENTS,
    sql: {
        lineComments: ['--'],
        blockComments: [{ start: '/*', end: '*/' }],
        stringDelimiters: ["'", '"', '`'],
    },
    swift: C_STYLE_COMMENTS,
    toml: HASH_COMMENTS,
    typescript: {
        ...C_STYLE_COMMENTS,
        keywordTokens: [FROM_KEYWORD],
    },
    typescriptreact: {
        ...C_STYLE_COMMENTS,
        keywordTokens: [FROM_KEYWORD],
    },
    vim: { lineComments: ['"'], blockComments: [] },
    xml: { lineComments: [], blockComments: [{ start: '<!--', end: '-->' }] },
    yaml: HASH_COMMENTS,
    zsh: HASH_COMMENTS,
};

const FALLBACK_CONFIG: LanguageSyntaxConfig = {
    lineComments: ['//'],
    blockComments: [{ start: '/*', end: '*/' }],
    stringDelimiters: DEFAULT_STRING_DELIMITERS,
    operatorTokens: DEFAULT_OPERATOR_TOKENS,
    wordLikeTokens: DEFAULT_WORD_LIKE_TOKENS,
};

export class LanguageProfileResolver {
    constructor(
        private readonly _languageId: string,
        private readonly _configAccessor: BetterAlignConfigAccessor,
    ) {}

    public getLanguageConfig(): LanguageSyntaxConfig {
        const userLanguageConfigs = this._configAccessor.get('languageConfigs', {}) as { [key: string]: LanguageSyntaxConfig };
        const aliasId = LANGUAGE_ALIASES[this._languageId];
        const baseConfig =
            DEFAULT_LANGUAGE_CONFIGS[this._languageId] ||
            (aliasId ? DEFAULT_LANGUAGE_CONFIGS[aliasId] : undefined) ||
            FALLBACK_CONFIG;
        const userConfig = userLanguageConfigs[this._languageId] || (aliasId ? userLanguageConfigs[aliasId] : undefined);

        return this._mergeLanguageConfig(baseConfig, userConfig);
    }

    public getLanguageProfile(): ResolvedLanguageSyntaxConfig {
        return this._normalizeLanguageConfig(this.getLanguageConfig());
    }

    private _mergeLanguageConfig(baseConfig: LanguageSyntaxConfig, overrideConfig?: LanguageSyntaxConfig): LanguageSyntaxConfig {
        return {
            lineComments: [...(overrideConfig?.lineComments ?? baseConfig.lineComments)],
            blockComments: [...(overrideConfig?.blockComments ?? baseConfig.blockComments)],
            stringDelimiters: [...(overrideConfig?.stringDelimiters ?? baseConfig.stringDelimiters ?? DEFAULT_STRING_DELIMITERS)],
            operatorTokens: [...(overrideConfig?.operatorTokens ?? baseConfig.operatorTokens ?? DEFAULT_OPERATOR_TOKENS)],
            keywordTokens: [...(overrideConfig?.keywordTokens ?? baseConfig.keywordTokens ?? [])],
            wordLikeTokens: [...(overrideConfig?.wordLikeTokens ?? baseConfig.wordLikeTokens ?? DEFAULT_WORD_LIKE_TOKENS)],
        };
    }

    private _normalizeLanguageConfig(config: LanguageSyntaxConfig): ResolvedLanguageSyntaxConfig {
        return {
            lineComments: [...config.lineComments].sort((a, b) => b.length - a.length),
            blockComments: [...config.blockComments].sort((a, b) => b.start.length - a.start.length),
            stringDelimiters: (config.stringDelimiters ?? DEFAULT_STRING_DELIMITERS)
                .map((delimiter) => this._normalizeStringDelimiter(delimiter))
                .sort((a, b) => b.start.length - a.start.length),
            operatorTokens: [...(config.operatorTokens ?? DEFAULT_OPERATOR_TOKENS)].sort((a, b) => b.text.length - a.text.length),
            keywordTokens: [...(config.keywordTokens ?? [])],
            wordLikeTokens: [...(config.wordLikeTokens ?? DEFAULT_WORD_LIKE_TOKENS)].sort((a, b) => b.length - a.length),
        };
    }

    private _normalizeStringDelimiter(delimiter: string | StringDelimiterConfig): StringDelimiterConfig {
        if (typeof delimiter === 'string') {
            return {
                start: delimiter,
                end: delimiter,
                escapeChar: delimiter === '`' ? undefined : '\\',
            };
        }

        return {
            start: delimiter.start,
            end: delimiter.end ?? delimiter.start,
            escapeChar: delimiter.escapeChar ?? '\\',
            multiline: delimiter.multiline,
        };
    }
}
