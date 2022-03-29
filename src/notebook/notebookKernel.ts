import * as vscode from 'vscode';
var stringify = require('json-stringify-safe');
var jsonata = require("jsonata");
import {Utils} from "vscode-uri";
import loadJSON from './loader/json';
import loadXML from './loader/xml';

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
		this._controller.supportsExecutionOrder = true;
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

    private _executeAll(cells: vscode.NotebookCell[], _notebook: vscode.NotebookDocument, _controller: vscode.NotebookController): void {
        for (let cell of cells) {
			this._doExecution(cell);
		}
	}

    private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
		execution.start(Date.now());

        const that = this;

        let counter = 0;

        const loadFile = async (filename: string, type?: string) => {
            counter++;
            if(!vscode.workspace.workspaceFolders) {return;}
            const folderUri = vscode.workspace.workspaceFolders[0].uri;
            const fileUri = Utils.joinPath(folderUri, filename);

            new Promise((resolve, reject) => {
                vscode.workspace.fs.readFile(fileUri)
                .then((data) => {
                    const string = new TextDecoder().decode(data);
                    return Promise.resolve(string);
                })
                .then((data) => {
                    if(!type || type==="json") {
                        return loadJSON(data);
                    } else if(type==="xml") {
                        return loadXML(data);
                    } else {
                        return Promise.reject("unknown file handler!");
                    }
                }).then((res) => {
                    that._data = res;
                    that._bindings['ans'] = res;
                    execution.replaceOutput([new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.json(res, "text/x-json")
                    ])]);
                    counter--;
                    if(counter===0) {
                        execution.end(true, Date.now());
                    }
                    return res;
                }, (e) => {
                    execution.replaceOutput(
                        new vscode.NotebookCellOutput([
                            vscode.NotebookCellOutputItem.error({
                                name: e instanceof Error && e.name || 'error', 
                                message: e instanceof Error && e.message || stringify(e, undefined, 4)
                            })
                        ])
                    );
                    counter--;
                    if(counter===0) {
                        execution.end(false, Date.now());
                    }
                });
            });
        };

        const query = cell.document.getText();
        try {
            const data = this._data;
            const jsonataObject = jsonata(query);
            jsonataObject.registerFunction("loadFile", loadFile, "<ss?:s>");

            const result = jsonataObject.evaluate(data, this._bindings);

            const match = query.trim().match(/^\$(\w+)\s*:=/);
            if(match) {
                this._bindings[match[1]] = result;
            }
        
            this._bindings['ans'] = result;
            
            execution.replaceOutput([new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.json(result, "text/x-json")
            ])]);

            if(counter === 0) {
                execution.end(true, Date.now());
            }
        } catch (e) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error({ 
                        name: e instanceof Error && e.name || 'error', 
                        message: e instanceof Error && e.message || stringify(e, undefined, 4)})
                ])
            ]);
            if(counter === 0) {
                execution.end(false, Date.now());
            }
        }
        
    }
}