import * as vscode from 'vscode';
var stringify = require('json-stringify-safe');
var jsonata = require("jsonata");
import {Utils} from "vscode-uri";
import loadJSON from './loader/json';
import loadXML from './loader/xml';
import fetch from 'node-fetch';

//const MIME_TYPE = "x-application/jsonata";

// NEEDED Declaration to silence errors
declare class TextDecoder {
	decode(data: Uint8Array): string;
}

declare class TextEncoder {
	encode(data: string): Uint8Array;
}

export class NotebookKernel implements vscode.Disposable {
    readonly id = 'jsonata-book-kernel';
    readonly notebookType = 'jsonata-book';
    readonly label = 'JSONata Book';
    readonly supportedLanguages = ['jsonata'];

    private readonly _controller: vscode.NotebookController;
	private _executionOrder = 0;

    public _data : unknown = undefined;
    private _bindings : {[name:string] : unknown} = {};

	constructor() {
        this._controller = vscode.notebooks.createNotebookController(
            this.id, 
            this.notebookType, 
            this.label
        );

		this._controller.supportedLanguages = this.supportedLanguages;
		this._controller.supportsExecutionOrder = false;
		this._controller.description = 'A notebook for making JSONata queries.';
		this._controller.executeHandler = this._executeAll.bind(this);
	}

	dispose(): void {
		this._controller.dispose();
	}

    public async restartKernel() {
        await vscode.commands.executeCommand('notebook.clearAllCellsOutputs');
        this._data = undefined;
        this._bindings = {};
    }

    private _executeAll(
      cells: vscode.NotebookCell[],
      _notebook: vscode.NotebookDocument,
      _controller: vscode.NotebookController
    ): void {
      let run = Promise.resolve();
      for (let cell of cells) {
			  run = run.then(() => this._doExecution(cell));
		  }
	  }

    private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
		    execution.start(Date.now());

        const parseString = (content: string, type?: string) => {
          if(!type || type==="json") {
              return loadJSON(content);
          } else if(type==="xml") {
              return loadXML(content);
          } else {
              return Promise.reject("unknown file handler!");
          }
        };

        const readFile = (filename: string) => {
          if(!vscode.workspace.workspaceFolders) {return Promise.reject("No workspace loaded!");}
          const folderUri = vscode.workspace.workspaceFolders[0].uri;
          const fileUri = Utils.joinPath(folderUri, filename);

          return vscode.workspace.fs.readFile(fileUri)
              .then((data) => {
                  const string = new TextDecoder().decode(data);
                  return Promise.resolve(string);
              });
        };

        const writeFile = (filename: string, content: any) => {
          if(!vscode.workspace.workspaceFolders) {return Promise.reject("No workspace loaded!");}
          const folderUri = vscode.workspace.workspaceFolders[0].uri;
          const fileUri = Utils.joinPath(folderUri, filename);

          const data = JSON.stringify(content, undefined, 2);
          return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(data))
            .then(() => Promise.resolve(undefined));
        };

        const readUrl = (url: string) => {
          return fetch(url).then(res => res.text());
        };

        const loadFile = (filename: string, type?: string) => {
            return readFile(filename)
            .then(parseString)
            .then(a => {
              this._data = a;
              return a;
            });
        };

        const evaluate = (content: string) => {
          const data = {};
          const jsonataObject = jsonata(content);
          return jsonataObject.evaluate(data, this._bindings)
          .then((result: any) => {
            const match = content.trim().match(/^\$(\w+)\s*:=/);
            if(match) {
                this._bindings[match[1]] = result;
            }
            return Promise.resolve(result);
          });
        };

        const importFile = (filename: string) => {
          return readFile(filename)
            .then(evaluate);
        };

        const loadUrl = (filename: string, type?: string) => {
          return readUrl(filename).then((content) => parseString(content, type));
        };

        const query = cell.document.getText();
        try {
            const data = this._data;
            const jsonataObject = jsonata(query);

            const funcs : {
              name: string,
              pointer: (...args: any[]) => Promise<unknown> | PromiseLike<unknown>,
              parameters: string,
            }[] = [
              {
                "name": "parseString",
                "pointer": parseString,
                "parameters": "<ss?:o>"
              },
              {
                "name": "loadFile",
                "pointer": loadFile,
                "parameters": "<ss?:o>"
              },
              {
                "name": "loadUrl",
                "pointer": loadUrl,
                "parameters": "<ss?:o>"
              },
              {
                "name": "readFile",
                "pointer": readFile,
                "parameters": "<s?:s>"
              },
              {
                "name": "writeFile",
                "pointer": writeFile,
                "parameters": "<so?:>"
              },
              {
                "name": "readUrl",
                "pointer": readUrl,
                "parameters": "<s?:s>"
              },
              {
                "name": "eval",
                "pointer": evaluate,
                "parameters": "<s?:o>"
              },
              {
                "name": "import",
                "pointer": importFile,
                "parameters": "<s?:o>"
              }
            ];
            funcs.forEach((a) => jsonataObject.registerFunction(a.name, (...b: any[]) => {
              return a.pointer(...b);
            }, a.parameters));

            const result = await jsonataObject.evaluate(data, this._bindings);

            const match = query.trim().match(/^\$(\w+)\s*:=/);
            if(match) {
                this._bindings[match[1]] = result;
            }
        
            this._bindings['ans'] = result;
            execution.replaceOutput([new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.json(result, "text/x-json")
            ])]);

            execution.end(true, Date.now());
            return Promise.resolve();
        } catch (e) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error({ 
                        name: e instanceof Error && e.name || 'error', 
                        message: e instanceof Error && e.message || stringify(e, undefined, 4)})
                ])
            ]);
            execution.end(false, Date.now());
            return Promise.reject();
        }
    }
}