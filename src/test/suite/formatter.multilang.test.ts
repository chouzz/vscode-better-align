import * as assert from 'assert';
import * as vscode from 'vscode';
import { Formatter, LineInfo, LineRange } from '../../formatter';

class FakeFormatter extends Formatter {
    public formatRange(range: LineRange): string[] {
        return super.format(range);
    }

    public getRanges(editor: vscode.TextEditor): LineRange[] {
        (this as any).editor = editor;
        return super.getLineRanges(editor);
    }

    public tokenizeLine(editor: vscode.TextEditor, line: number): LineInfo {
        (this as any).editor = editor;
        return super.tokenize(line);
    }
}

async function openEditor(language: string, content: string): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument({ language, content });
    return vscode.window.showTextDocument(document);
}

function formatAtLine(editor: vscode.TextEditor, line: number): string[] {
    editor.selection = new vscode.Selection(line, 0, line, 0);
    const formatter = new FakeFormatter();
    const ranges = formatter.getRanges(editor);
    return formatter.formatRange(ranges[0]);
}

suite('Formatter Multi-language Test Suite', () => {
    test('Formatter::should format javascript assignments with urls and comments', async () => {
        const editor = await openEditor(
            'javascript',
            [
                'const url = "https://example.com/a?foo=1"; // alpha',
                'const short = "http://x.y"; // beta',
            ].join('\n'),
        );

        const actual = formatAtLine(editor, 0);
        const expect = [
            'const url   = "https://example.com/a?foo=1";  // alpha',
            'const short = "http://x.y";                   // beta',
        ];
        assert.deepStrictEqual(actual, expect);
    });

    test('Formatter::should format python hash comments', async () => {
        const editor = await openEditor(
            'python',
            [
                'value = 1 # alpha',
                'longer_name = 2 # beta',
            ].join('\n'),
        );

        const actual = formatAtLine(editor, 0);
        const expect = [
            'value       = 1  # alpha',
            'longer_name = 2  # beta',
        ];
        assert.deepStrictEqual(actual, expect);
    });

    test('Formatter::should format sql dash comments', async () => {
        const editor = await openEditor(
            'sql',
            [
                'SELECT foo = 1 -- alpha',
                'SELECT longer_name = 2 -- beta',
            ].join('\n'),
        );

        const actual = formatAtLine(editor, 0);
        const expect = [
            'SELECT foo         = 1  -- alpha',
            'SELECT longer_name = 2  -- beta',
        ];
        assert.deepStrictEqual(actual, expect);
    });

    test('Formatter::should ignore operators inside sql block comments', async () => {
        const editor = await openEditor('sql', 'SELECT foo /* = inside */ = 1;');
        const formatter = new FakeFormatter();
        const lineInfo = formatter.tokenizeLine(editor, 0);

        assert.deepStrictEqual(
            lineInfo.tokens.map((token) => token.type),
            [
                'Word',
                'Whitespace',
                'Word',
                'Whitespace',
                'Comment',
                'Whitespace',
                'Assignment',
                'Whitespace',
                'Word',
            ],
        );
        assert.strictEqual(lineInfo.tokens[4].text, '/* = inside */');
    });

    test('Formatter::should tokenize php short echo and scope operator', async () => {
        const editor = await openEditor(
            'php',
            [
                '<?= $value ?>',
                "self::VALUE => 'test'",
            ].join('\n'),
        );
        const formatter = new FakeFormatter();

        const shortEcho = formatter.tokenizeLine(editor, 0);
        assert.strictEqual(shortEcho.tokens[0].type, 'PHPShortEcho');

        const scopeResolution = formatter.tokenizeLine(editor, 1);
        assert.strictEqual(scopeResolution.tokens[0].type, 'Word');
        assert.strictEqual(scopeResolution.tokens[0].text, 'self::VALUE');
        assert.ok(scopeResolution.tokens.some((token) => token.type === 'Arrow'));
    });

    test('Formatter::should stop a range at an unterminated string', async () => {
        const editor = await openEditor(
            'typescript',
            [
                'const broken = "unterminated',
                'const later = 1;',
            ].join('\n'),
        );
        editor.selection = new vscode.Selection(0, 0, 0, 0);

        const formatter = new FakeFormatter();
        const ranges = formatter.getRanges(editor);

        assert.strictEqual(ranges[0].infos.length, 1);
        assert.strictEqual(ranges[0].infos[0].line.lineNumber, 0);
    });
});
