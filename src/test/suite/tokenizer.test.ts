import * as assert from 'assert';
import * as vscode from 'vscode';
import { Tokenizer, TokenType, LineTokenInfo } from '../../../src/tokenizer'; // Adjusted path
import { LanguageProfile } from '../../../src/languageProfile';

// Sample Language Profile for testing (similar to JavaScript/TypeScript)
const testLanguageProfile: LanguageProfile = {
    lineCommentRegex: /\/\//,
    blockCommentStartRegex: /\/\*/,
    blockCommentEndRegex: /\*\//,
    stringDelimiters: new Set(['"', "'", '`']),
    assignmentOperators: new Set(['=', '+=', '-=']),
    otherOperators: new Set(['==', '===', '+', '-', '=>']),
};

// Helper to create a mock TextLine
function mockTextLine(text: string, lineNumber: number = 0): vscode.TextLine {
    return {
        lineNumber: lineNumber,
        text: text,
        range: new vscode.Range(lineNumber, 0, lineNumber, text.length),
        rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber, text.length), // Simplified
        firstNonWhitespaceCharacterIndex: text.search(/\S|$/),
        isEmptyOrWhitespace: text.trim().length === 0,
    };
}

suite('Tokenizer Test Suite', () => {
    let tokenizer: Tokenizer;

    setup(() => {
        tokenizer = new Tokenizer(testLanguageProfile);
    });

    test('Tokenize simple line: words and spaces', () => {
        const line = mockTextLine('hello world');
        const result = tokenizer.tokenizeLine(line);
        assert.strictEqual(result.tokens.length, 3, 'Should have 3 tokens');
        assert.strictEqual(result.tokens[0].type, TokenType.Word, 'Token 1 type');
        assert.strictEqual(result.tokens[0].text, 'hello', 'Token 1 text');
        assert.strictEqual(result.tokens[1].type, TokenType.Whitespace, 'Token 2 type');
        assert.strictEqual(result.tokens[1].text, ' ', 'Token 2 text');
        assert.strictEqual(result.tokens[2].type, TokenType.Word, 'Token 3 type');
        assert.strictEqual(result.tokens[2].text, 'world', 'Token 3 text');
        assert.deepStrictEqual(result.significantTokenTypes, [], 'No significant tokens');
    });

    test('Tokenize line comment', () => {
        const line = mockTextLine('let foo = 1; // this is a comment');
        const result = tokenizer.tokenizeLine(line);
        const commentToken = result.tokens.find(t => t.type === TokenType.Comment);
        assert.ok(commentToken, 'Should find a comment token');
        assert.strictEqual(commentToken?.text, '// this is a comment', 'Comment text');
        assert.ok(result.significantTokenTypes.includes(TokenType.Comment), 'Comment should be significant');
    });

    test('Tokenize block comment', () => {
        const line = mockTextLine('/* block comment */ var x;');
        const result = tokenizer.tokenizeLine(line);
        const commentToken = result.tokens.find(t => t.type === TokenType.Comment);
        assert.ok(commentToken, 'Should find a block comment token');
        assert.strictEqual(commentToken?.text, '/* block comment */', 'Block comment text');
        assert.ok(result.significantTokenTypes.includes(TokenType.Comment), 'Comment should be significant');
    });

    test('Tokenize block comment spanning part of line', () => {
        const line = mockTextLine('let a = /* comment */ b;');
        const result = tokenizer.tokenizeLine(line);
        // Expected: let, space, a, space, =, space, /* comment */, space, b, ;
        assert.strictEqual(result.tokens.filter(t=>t.type !== TokenType.Whitespace).length, 5, "Number of non-whitespace tokens");
        const commentToken = result.tokens.find(t => t.type === TokenType.Comment);
        assert.ok(commentToken, 'Should find a block comment token');
        assert.strictEqual(commentToken?.text, '/* comment */', 'Block comment text');
    });


    test('Tokenize string (double quotes)', () => {
        const line = mockTextLine('const msg = "hello world";');
        const result = tokenizer.tokenizeLine(line);
        const stringToken = result.tokens.find(t => t.type === TokenType.String);
        assert.ok(stringToken, 'Should find a string token');
        assert.strictEqual(stringToken?.text, '"hello world"', 'String text');
    });

    test('Tokenize string (single quotes)', () => {
        const line = mockTextLine("const msg = 'hello world';");
        const result = tokenizer.tokenizeLine(line);
        const stringToken = result.tokens.find(t => t.type === TokenType.String);
        assert.ok(stringToken, 'Should find a string token');
        assert.strictEqual(stringToken?.text, "'hello world'", 'String text');
    });

    test('Tokenize string (backticks)', () => {
        const line = mockTextLine("const msg = `hello ${world}`;");
        const result = tokenizer.tokenizeLine(line);
        const stringToken = result.tokens.find(t => t.type === TokenType.String);
        assert.ok(stringToken, 'Should find a string token');
        assert.strictEqual(stringToken?.text, "`hello ${world}`", 'String text backticks');
    });


    test('Tokenize assignment operator (=)', () => {
        const line = mockTextLine('x = 10');
        const result = tokenizer.tokenizeLine(line);
        const assignmentToken = result.tokens.find(t => t.type === TokenType.Assignment);
        assert.ok(assignmentToken, 'Should find an assignment token');
        assert.strictEqual(assignmentToken?.text, '=', 'Assignment text');
        assert.ok(result.significantTokenTypes.includes(TokenType.Assignment), 'Assignment should be significant');
    });

    test('Tokenize assignment operator (+=)', () => {
        const line = mockTextLine('x += 10');
        const result = tokenizer.tokenizeLine(line);
        const assignmentToken = result.tokens.find(t => t.type === TokenType.Assignment);
        assert.ok(assignmentToken, 'Should find an assignment token for +=');
        assert.strictEqual(assignmentToken?.text, '+=', 'Assignment text for +=');
        assert.ok(result.significantTokenTypes.includes(TokenType.Assignment), '+= should be significant type Assignment');
    });

    test('Tokenize other operator (===)', () => {
        const line = mockTextLine('a === b');
        const result = tokenizer.tokenizeLine(line);
        const operatorToken = result.tokens.find(t => t.type === TokenType.OtherOperator);
        assert.ok(operatorToken, 'Should find an OtherOperator token');
        assert.strictEqual(operatorToken?.text, '===', 'OtherOperator text');
        assert.ok(result.significantTokenTypes.includes(TokenType.OtherOperator), 'OtherOperator should be significant');
    });

    test('Tokenize arrow operator (=>)', () => {
        const line = mockTextLine('() => {}');
        const result = tokenizer.tokenizeLine(line);
        const arrowToken = result.tokens.find(t => t.type === TokenType.Arrow);
        assert.ok(arrowToken, 'Should find an Arrow token');
        assert.strictEqual(arrowToken?.text, '=>', 'Arrow text');
        assert.ok(result.significantTokenTypes.includes(TokenType.Arrow), 'Arrow should be significant');
    });

    test('Tokenize unclosed string', () => {
        const line = mockTextLine('const str = "unclosed...');
        const result = tokenizer.tokenizeLine(line);
        const partialStringToken = result.tokens.find(t => t.type === TokenType.PartialString);
        assert.ok(partialStringToken, 'Should find a PartialString token');
        assert.strictEqual(partialStringToken?.text, '"unclosed...', 'PartialString text');
    });

    test('Tokenize colon', () => {
        const line = mockTextLine('type T = { key: value }');
        const result = tokenizer.tokenizeLine(line);
        const colonToken = result.tokens.find(t => t.type === TokenType.Colon);
        assert.ok(colonToken, "Should find a Colon token");
        assert.strictEqual(colonToken?.text, ":", "Colon token text");
        assert.ok(result.significantTokenTypes.includes(TokenType.Colon), "Colon should be significant");
    });

    test('Tokenize comma', () => {
        const line = mockTextLine('a, b, c');
        const result = tokenizer.tokenizeLine(line);
        const commaTokens = result.tokens.filter(t => t.type === TokenType.Comma);
        assert.strictEqual(commaTokens.length, 2, "Should find 2 comma tokens");
    });

    test('Tokenize CommaAsWord (comma-first style)', () => {
        const line = mockTextLine('  , item'); // Leading whitespace then comma
        const result = tokenizer.tokenizeLine(line);
        const commaAsWordToken = result.tokens.find(t => t.type === TokenType.CommaAsWord);
        assert.ok(commaAsWordToken, "Should find a CommaAsWord token");
        assert.strictEqual(commaAsWordToken?.text, ",", "CommaAsWord text");
    });

    test('Tokenize simple block', () => {
        const line = mockTextLine('if (true) { dosomething(); }');
        const result = tokenizer.tokenizeLine(line);
        const blockOpenToken = result.tokens.find(t => t.type === TokenType.Block && t.text === '{');
        const blockCloseToken = result.tokens.find(t => t.type === TokenType.EndOfBlock && t.text === '}');
        assert.ok(blockOpenToken, "Should find an opening block token '{'");
        assert.ok(blockCloseToken, "Should find a closing block token '}'");
    });

    test('Tokenize partial block (unclosed)', () => {
        const line = mockTextLine('function foo() { // unclosed');
        const result = tokenizer.tokenizeLine(line);
        const partialBlockToken = result.tokens.find(t => t.type === TokenType.PartialBlock && t.text === '{');
        assert.ok(partialBlockToken, "Should find a partial block token for unclosed '{'");
    });
});
