import * as assert from 'assert';
import * as vscode from 'vscode';
import { Formatter, LineRange } from '../../formatter';

class FakeFormatter extends Formatter {
    public format(range: LineRange): string[] {
        return super.format(range);
    }

    public getLineRanges(editor: vscode.TextEditor) {
        super.editor = editor;
        return super.getLineRanges(editor);
    }
}

suite('Formatter Test Suite', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    test('Formatter::should format comment', () => {
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '  // Only some comments',
            '  // Only some comments',
            '  // Only some comments',
            '  // Only some comments',
            '  // Only some comments',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format assignment like =', () => {
        editor.selection = new vscode.Selection(6, 0, 6, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'var abc     = 123;', 
            'var fsdafsf = 32423,', 
            '    fasdf   = 1231321;'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format colon like :', () => {
        editor.selection = new vscode.Selection(12, 0, 12, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '    line          : textline',
            '  , sgfntTokenType: TokenType.Invalid',
            '  , tokens        : []',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format assignment like :=', () => {
        editor.selection = new vscode.Selection(18, 0, 18, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'test    := 1',
            'teastas := 2',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format assignment like == and !=', () => {
        editor.selection = new vscode.Selection(29, 0, 29, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'var abc     == 123;', 
            'var fsdafsf == 32423,', 
            '    fasdf   != 1231321;'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format assignment like === and !==', () => {
        editor.selection = new vscode.Selection(33, 0, 33, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'var abc     === 123;', 
            'var fsdafsf === 32423,', 
            '    fasdf   !== 1231321;'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format assignment like === and !== with special character', () => {
        editor.selection = new vscode.Selection(41, 0, 41, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            `           $x === 'nott test'`, 
            '        || $x === 0', 
            `        || $x !== 'test'`
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should not format double Colon like ::', () => {
        editor.selection = new vscode.Selection(23, 0, 23, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            `  self::LAUNCHAAA => 'test',`,
            `  self::WAIT      => 'testtas',`,
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format code with block', () => {
        editor.selection = new vscode.Selection(50, 0, 50, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '$item["venue_id"]    = $venue->id;',
            '$item["account_id"]  = $venue->parent_id;',
            '$item["expire_date"] = Carbon::now()->{$carbon_function}();',
            '$acc_license_data[]  = $item;',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format comment with words', () => {
        editor.selection = new vscode.Selection(57, 0, 57, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '    int    myNum;     // Attribute (int variable)',
            '    string myString;  // Attribute (string variable)'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format comment with operators', () => {
        editor.selection = new vscode.Selection(61, 0, 61, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'test    := 1  // Only some comments',
            'teastas := 2  // Only some comments'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should not format if first line contain space', () => {
        editor.selection = new vscode.Selection(64, 0, 64, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '       test123  := 123',
            'global test1    := 13',
            '       test2332  = 1234',
            '       test4124 += 124',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should format operator like ?:', () => {
        editor.selection = new vscode.Selection(70, 0, 70, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '    click_type : string|number,   // a',
            '    page_type ?: string,',
            '    card_type ?: string,          //c',
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should not break tab indent', () => {
        editor.selection = new vscode.Selection(75, 0, 75, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            '	$test    = 123;',
            '	$test123 = 456;'
        ];
        assert.deepEqual(actual, expect);
    });

    test('Formatter::should get correct result for c like assignment', () => {
        editor.selection = new vscode.Selection(78, 0, 78, 0);
        const formatter = new FakeFormatter();
        const ranges = formatter.getLineRanges(editor);
        const actual = formatter.format(ranges[0]);
        const expect = [
            'int a &= b;',
            'int c |= d;'
        ];
        assert.deepEqual(actual, expect);
    });
});
