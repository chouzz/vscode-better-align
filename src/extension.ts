'use strict';
import * as vscode from 'vscode';
import * as telemetry from './telemetry';
import { Formatter } from './formatter';
import { LanguageProfile } from './languageProfile';

// Default Language Profile (loosely based on JavaScript/TypeScript)
const defaultLanguageProfile: LanguageProfile = {
    lineCommentRegex: /\/\//,
    blockCommentStartRegex: /\/\*/,
    blockCommentEndRegex: /\*\//,
    stringDelimiters: new Set(['"', "'", '`']),
    assignmentOperators: new Set([
        '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**=', '<<=', '>>=', '>>>=', ':=',
    ]),
    otherOperators: new Set([
        '==', '===', '!=', '!==', '>', '<', '>=', '<=', '+', '-', '*', '/', '%', '**', '&', '|', '^',
        // '&&', '||', '??', '.', // These might need more specific tokenizer handling or configuration
    ]),
};

// Language profiles map
const languageProfiles: Map<string, LanguageProfile> = new Map();
languageProfiles.set('typescript', defaultLanguageProfile);
languageProfiles.set('javascript', defaultLanguageProfile);
languageProfiles.set('json', {
    lineCommentRegex: new RegExp('^$'), // No line comments
    blockCommentStartRegex: new RegExp('^$'), // No block comments
    blockCommentEndRegex: new RegExp('^$'),
    stringDelimiters: new Set(['"']),
    assignmentOperators: new Set([':']), // Key-value in JSON
    otherOperators: new Set([',']),
});
// Add more profiles as needed:
// languageProfiles.set('python', { ... });


export function activate(context: vscode.ExtensionContext) {
    telemetry.activate(context);
    // Formatter instance will be created per command execution with the appropriate profile
    // let formatter = new Formatter(); // Remove this line

    let alignAfterEnter = vscode.workspace.getConfiguration('betterAlign').get<boolean>('alignAfterTypeEnter');

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand('vscode-better-align.align', (editor) => {
            telemetry.reporter.sendTelemetryEvent('align');

            const documentLanguageId = editor.document.languageId;
            let userLangProfileSetting = vscode.workspace.getConfiguration('betterAlign').get<any>(`languageProfiles.${documentLanguageId}`);

            let activeProfile: LanguageProfile = languageProfiles.get(documentLanguageId) || defaultLanguageProfile;

            if (userLangProfileSetting && typeof userLangProfileSetting === 'object') {
                // Merge user settings with the base profile.
                // User settings can override parts of the LanguageProfile.
                // Ensure Set and RegExp properties are correctly reconstructed if provided as arrays/strings in settings.
                activeProfile = {
                    ...activeProfile, // Start with base (e.g. default JS/TS or map default)
                };
                if(userLangProfileSetting.lineCommentRegex) { activeProfile.lineCommentRegex = new RegExp(userLangProfileSetting.lineCommentRegex); }
                if(userLangProfileSetting.blockCommentStartRegex) { activeProfile.blockCommentStartRegex = new RegExp(userLangProfileSetting.blockCommentStartRegex); }
                if(userLangProfileSetting.blockCommentEndRegex) { activeProfile.blockCommentEndRegex = new RegExp(userLangProfileSetting.blockCommentEndRegex); }
                if(userLangProfileSetting.stringDelimiters) { activeProfile.stringDelimiters = new Set(userLangProfileSetting.stringDelimiters); }
                if(userLangProfileSetting.assignmentOperators) { activeProfile.assignmentOperators = new Set(userLangProfileSetting.assignmentOperators); }
                if(userLangProfileSetting.otherOperators) { activeProfile.otherOperators = new Set(userLangProfileSetting.otherOperators); }
            }

            // console.log(`Using profile for language: ${documentLanguageId}`, activeProfile);

            const formatter = new Formatter(activeProfile); // Create formatter with the determined profile
            formatter.process(editor);
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            // This auto-align on enter might need to be smarter or also use the language profile
            if (alignAfterEnter && e.contentChanges.some((changes) => changes.text.includes('\n'))) {
                // Consider if auto-align should also pick up the specific language profile.
                // For now, it re-runs the command which will do so.
                vscode.commands.executeCommand('vscode-better-align.align');
            }
        }),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('betterAlign.alignAfterTypeEnter')) {
                alignAfterEnter = vscode.workspace.getConfiguration('betterAlign').get<boolean>('alignAfterTypeEnter');
            }
            // If languageProfiles settings change, the command will pick them up on next execution.
            // No need to explicitly reload profiles here unless we cache them more aggressively.
        }),
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
    // If telemetry has a deactivate or dispose, call it here.
    // For now, assuming telemetry.activate handles its own lifecycle or is simple.
}
