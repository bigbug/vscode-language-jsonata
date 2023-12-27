import jsonata = require('jsonata');
import { isNumber, isObject } from 'lodash';
import * as vscode from 'vscode';

/**
 * Analyzes the text document for problems.
 * This demo diagnostic problem provider finds all mentions of 'emoji'.
 * @param doc text document to analyze
 * @param jsonataDiagnostics diagnostic collection
 */
export function refreshDiagnostics(
  doc: vscode.TextDocument,
  jsonataDiagnostics: vscode.DiagnosticCollection,
): void {
  const diagnostics: vscode.Diagnostic[] = [];

  const code = doc.getText();

  try {
    jsonata(code);
  } catch (e: any) {
    // @ts-ignore
    if (!e || !isObject(e) || !e.position || !isNumber(e.position)) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(999999, 999999)),
        'Unknown JSONata error!',
        vscode.DiagnosticSeverity.Error,
      ));
    } else {
      // @ts-ignore
      const { position, message } = e;
      const lines = code.slice(0, position).split('\n');
      const line = lines.length - 1;
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(
          new vscode.Position(line, lines[lines.length - 1].length),
          new vscode.Position(line, 99999),
        ),
        message,
        vscode.DiagnosticSeverity.Error,
      ));
    }
    diagnostics.push();
  }
  jsonataDiagnostics.set(doc.uri, diagnostics);
}

export default function subscribeToDocumentChanges(
  context: vscode.ExtensionContext,
  jsonataDiagnostics: vscode.DiagnosticCollection,
): void {
  if (vscode.window.activeTextEditor) {
    refreshDiagnostics(vscode.window.activeTextEditor.document, jsonataDiagnostics);
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refreshDiagnostics(editor.document, jsonataDiagnostics);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (e) => refreshDiagnostics(e.document, jsonataDiagnostics),
    ),
  );

  vscode.workspace.onDidChangeNotebookDocument(
    (e) => {
      e.notebook.getCells().forEach((cell) => {
        refreshDiagnostics(cell.document, jsonataDiagnostics);
      });
    },
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(
      (doc) => jsonataDiagnostics.delete(doc.uri),
    ),
  );
}
