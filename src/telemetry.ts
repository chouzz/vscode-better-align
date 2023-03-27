import * as vscode from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';

// the application insights key (also known as instrumentation key)
const key = '713fdedf-aaef-442b-bc8f-11e7f0eabd12';

// telemetry reporter
export let reporter: TelemetryReporter;

export function activate(context: vscode.ExtensionContext) {
   reporter = new TelemetryReporter(key);
   context.subscriptions.push(reporter);
}