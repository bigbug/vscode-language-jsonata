// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import CompletionProvider from './language/CompletionProvider';
import { NotebookKernel } from './notebook/notebookKernel';
import { NotebookSerializer } from './notebook/notebookSerializer';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(new NotebookKernel());
	context.subscriptions.push(vscode.workspace.registerNotebookSerializer('jsonata-book', new NotebookSerializer(), {
		transientOutputs: false,
		transientCellMetadata: {
			inputCollapsed: true,
			outputCollapsed: true,
		}
	}));

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
		["jsonata"],
		new CompletionProvider(),
		'$'
		)
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}
