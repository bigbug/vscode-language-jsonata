import * as vscode from 'vscode';
import {
  WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken,
} from 'vscode';
import { TextEncoder } from 'util';
import { FileAccessor } from '../server/debugRuntime';
// import { MockDebugSession } from './mockDebug';
// import { FileAccessor } from './mockRuntime';

class MockConfigurationProvider implements vscode.DebugConfigurationProvider {
  /**
 * Massage a debug configuration just before a debug session is being launched,
 * e.g. add all missing attributes to the debug configuration.
 */
  // eslint-disable-next-line class-methods-use-this
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    config: DebugConfiguration,
    // eslint-disable-next-line no-unused-vars
    token?: CancellationToken,
  ): ProviderResult<DebugConfiguration> {
    // if launch.json is missing or empty
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'jsonata') {
        // eslint-disable-next-line no-param-reassign
        config.type = 'jsonata';
        // eslint-disable-next-line no-param-reassign
        config.name = 'Launch';
        // eslint-disable-next-line no-param-reassign
        config.request = 'launch';
        // eslint-disable-next-line no-param-reassign, no-template-curly-in-string
        config.program = '${file}';
        // eslint-disable-next-line no-param-reassign
        config.stopOnEntry = true;
      }
    }

    if (!config.program) {
      vscode.window.showInformationMessage('Cannot find a program to debug');
    }

    return config;
  }
}

export default function activateMockDebug(
  context: vscode.ExtensionContext,
  factory: vscode.DebugAdapterDescriptorFactory,
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-language-jsonata.debug.runEditorContents', (resource: vscode.Uri) => {
      let targetResource = resource;
      if (!targetResource && vscode.window.activeTextEditor) {
        targetResource = vscode.window.activeTextEditor.document.uri;
      }
      if (targetResource) {
        vscode.debug.startDebugging(
          undefined,
          {
            type: 'jsonata',
            name: 'Run File',
            request: 'launch',
            program: targetResource.fsPath,
          },
          { noDebug: true },
        );
      }
    }),
    vscode.commands.registerCommand('vscode-language-jsonata.debug.debugEditorContents', (resource: vscode.Uri) => {
      let targetResource = resource;
      if (!targetResource && vscode.window.activeTextEditor) {
        targetResource = vscode.window.activeTextEditor.document.uri;
      }
      if (targetResource) {
        vscode.debug.startDebugging(undefined, {
          type: 'jsonata',
          name: 'Debug File',
          request: 'launch',
          program: targetResource.fsPath,
          stopOnEntry: true,
        });
      }
    }),
  );

  // register a configuration provider for 'mock' debug type
  const provider = new MockConfigurationProvider();
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jsonata', provider));

  // register a dynamic configuration provider for 'mock' debug type
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('jsonata', {
    provideDebugConfigurations(
      // eslint-disable-next-line no-unused-vars
      folder: WorkspaceFolder | undefined,
    ): ProviderResult<DebugConfiguration[]> {
      return [
        {
          name: 'Dynamic Launch',
          request: 'launch',
          type: 'jsonata',
          // eslint-disable-next-line no-template-curly-in-string
          program: '${file}',
        },
        {
          name: 'Another Dynamic Launch',
          request: 'launch',
          type: 'jsonata',
          // eslint-disable-next-line no-template-curly-in-string
          program: '${file}',
        },
        {
          name: 'Mock Launch',
          request: 'launch',
          type: 'jsonata',
          // eslint-disable-next-line no-template-curly-in-string
          program: '${file}',
        },
      ];
    },
  }, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('jsonata', factory));
  if ('dispose' in factory) {
    // @ts-ignore
    context.subscriptions.push(factory);
  }

  // override VS Code's default implementation of the debug hover
  // here we match only Mock "variables", that are words starting with an '$'
  // context.subscriptions.push(vscode.languages.registerEvaluatableExpressionProvider('markdown', {
  //   provideEvaluatableExpression(
  //     document: vscode.TextDocument,
  //     position: vscode.Position,
  //   ): vscode.ProviderResult<vscode.EvaluatableExpression> {
  //     const VARIABLE_REGEXP = /\$[a-z][a-z0-9]*/ig;
  //     const line = document.lineAt(position.line).text;

  //     let m: RegExpExecArray | null;
  //     while (m = VARIABLE_REGEXP.exec(line)) {
  //       const varRange = new vscode.Range(
  //          position.line, m.index, position.line, m.index + m[0].length);

  //       if (varRange.contains(position)) {
  //         return new vscode.EvaluatableExpression(varRange);
  //       }
  //     }
  //     return undefined;
  //   },
  // }));

  // override VS Code's default implementation of the "inline values" feature"
  // context.subscriptions.push(vscode.languages.registerInlineValuesProvider('markdown', {

  //   provideInlineValues(
  //          document: vscode.TextDocument,
  //          viewport: vscode.Range,
  //          context: vscode.InlineValueContext
  //   ) : vscode.ProviderResult<vscode.InlineValue[]> {
  //     const allValues: vscode.InlineValue[] = [];

  //     for (let l = viewport.start.line; l <= context.stoppedLocation.end.line; l++) {
  //       const line = document.lineAt(l);
  //       const regExp = /\$([a-z][a-z0-9]*)/ig; // variables are words starting with '$'
  //       do {
  //         var m = regExp.exec(line.text);
  //         if (m) {
  //           const varName = m[1];
  //           const varRange = new vscode.Range(l, m.index, l, m.index + varName.length);

  //           // some literal text
  //           // allValues.push(
  //                 new vscode.InlineValueText(varRange, `${varName}: ${viewport.start.line}`));

  //           // value found via variable lookup
  //           allValues.push(new vscode.InlineValueVariableLookup(varRange, varName, false));

  //           // value determined via expression evaluation
  //           // allValues.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
  //         }
  //       } while (m);
  //     }

  //     return allValues;
  //   },
  // }));
}
function pathToUri(path: string) {
  try {
    return vscode.Uri.file(path);
  } catch (e) {
    return vscode.Uri.parse(path);
  }
}

export const workspaceFileAccessor: FileAccessor = {
  isWindows: typeof process !== 'undefined' && process.platform === 'win32',
  async readFile(path: string): Promise<Uint8Array> {
    let uri: vscode.Uri;
    try {
      uri = pathToUri(path);
    } catch (e) {
      return new TextEncoder().encode(`cannot read '${path}'`);
    }

    return vscode.workspace.fs.readFile(uri);
  },
  async writeFile(path: string, contents: Uint8Array) {
    await vscode.workspace.fs.writeFile(pathToUri(path), contents);
  },
};
