/* eslint-disable max-classes-per-file */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  DebugSession,
  DebugAdapterDescriptor,
  DebugAdapterDescriptorFactory,
  DebugAdapterExecutable,
  DebugAdapterServer,
  DocumentFormattingEditProvider, ExtensionContext, Position, ProviderResult,
  Range, TextDocument, TextEdit, languages, window, workspace,
} from 'vscode';
import * as Net from 'net';
import CompletionProvider from './language/CompletionProvider';
import NotebookKernel from './notebook/notebookKernel';
import NotebookSerializer from './notebook/notebookSerializer';
import subscribeToDocumentChanges from './language/diagnostics';
import populateMessage from './language/errors';
import formatJsonata from './language/formatter';
import activateMockDebug, { workspaceFileAccessor } from './debug/client/activateDebug';
import JsonataDebugSession from './debug/server/debugSession';
// import activateMockDebug from './debug/client/activateDebug';

class JSONataDocumentFormatter implements DocumentFormattingEditProvider {
  // eslint-disable-next-line class-methods-use-this
  provideDocumentFormattingEdits(
    document: TextDocument,
    // options: FormattingOptions,
    // token: CancellationToken,
  ): ProviderResult<TextEdit[]> {
    try {
      const code = document.getText();
      const formatted = formatJsonata(code);

      const edit: TextEdit[] = [];
      edit.push(new TextEdit(
        new Range(
          new Position(0, 0),
          new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length),
        ),
        formatted,
      ));
      return edit;
    } catch (e: any) {
      if (e.code) {
        const err = populateMessage(e);
        // @ts-ignore
        window.showErrorMessage(`${err.code}: ${err.message}`);
        return undefined;
      }
      // (parser error) don't bubble up as a pot. unhandled thenable promise;
      // explicitly return "no change" instead.
      // show error message
      window.showErrorMessage(`${e.name} (@${e.location.start.line}:${e.location.start.column}): ${e.message}`);
      return undefined;
    }
  }
}

class JsonataDebugAdapterServerDescriptorFactory implements DebugAdapterDescriptorFactory {
  private server?: Net.Server;

  createDebugAdapterDescriptor(
    // eslint-disable-next-line no-unused-vars
    session: DebugSession,
    // eslint-disable-next-line no-unused-vars
    executable: DebugAdapterExecutable | undefined,
  ): ProviderResult<DebugAdapterDescriptor> {
    if (!this.server) {
      // start listening on a random port
      this.server = Net.createServer((socket) => {
        const mockSession = new JsonataDebugSession(workspaceFileAccessor);
        mockSession.setRunAsServer(true);
        // eslint-disable-next-line no-undef
        mockSession.start(socket as NodeJS.ReadableStream, socket);
      }).listen(0);
    }

    // make VS Code connect to debug server
    return new DebugAdapterServer((this.server.address() as Net.AddressInfo).port);
  }

  dispose() {
    if (this.server) {
      this.server.close();
    }
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  context.subscriptions.push(new NotebookKernel());
  context.subscriptions.push(workspace.registerNotebookSerializer('jsonata-book', new NotebookSerializer(), {
    transientOutputs: false,
    transientCellMetadata: {
      inputCollapsed: true,
      outputCollapsed: true,
    },
  }));

  context.subscriptions.push(languages.registerCompletionItemProvider(
    ['jsonata'],
    new CompletionProvider(),
    '$',
  ));

  const jsonataDiagnostics = languages.createDiagnosticCollection('jsonata');
  context.subscriptions.push(jsonataDiagnostics);

  subscribeToDocumentChanges(context, jsonataDiagnostics);
  context.subscriptions.push(languages.registerDocumentFormattingEditProvider(
    ['jsonata'],
    new JSONataDocumentFormatter(),
  ));

  activateMockDebug(context, new JsonataDebugAdapterServerDescriptorFactory());
}

// this method is called when your extension is deactivated
export function deactivate() {}
