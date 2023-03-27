'use strict';
import * as vscode from 'vscode';
import * as telemetry from './telemetry';
import { Formatter } from './formatter';

export function activate(context: vscode.ExtensionContext) {
    telemetry.activate(context);
    const formatter = new Formatter();
    let alignAfterEnter = vscode.workspace.getConfiguration('betterAlign').get<boolean>('alignAfterTypeEnter');

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('vscode-better-align.align', (editor) => {
            telemetry.reporter.sendTelemetryEvent('align');
            formatter.process(editor);
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (alignAfterEnter && e.contentChanges.some((changes) => changes.text.includes('\n'))) {
                vscode.commands.executeCommand('vscode-better-align.align');
            }
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('betterAlign')) {
                alignAfterEnter = vscode.workspace.getConfiguration('betterAlign').get<boolean>('alignAfterTypeEnter');
            }
        }),
    );
}

// this method is called when your extension is deactivated
export function deactivate() {}
