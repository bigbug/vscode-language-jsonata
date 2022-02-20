import * as vscode from 'vscode';
var stringify = require('json-stringify-safe');
var jsonata = require("jsonata");
import {Utils} from "vscode-uri";

//const MIME_TYPE = "x-application/jsonata";

// NEEDED Declaration to silence errors
declare class TextDecoder {
	decode(data: Uint8Array): string;
}

declare class TextEncoder {
	encode(data: string): Uint8Array;
}

export class NotebookKernel {
    readonly id = 'jsonata-book-kernel';
    readonly notebookType = 'jsonata-book';
    readonly label = 'JSONata Book';
    readonly supportedLanguages = ['jsonata'];

    private readonly _controller: vscode.NotebookController;
	private _executionOrder = 0;

    public _data : unknown = undefined;
    private _bindings : {[name:string] : unknown} = {};

	constructor() {
        this._controller = vscode.notebooks.createNotebookController(this.id, 
                                                                    this.notebookType, 
                                                                    this.label);

		this._controller.supportedLanguages = this.supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.description = 'A notebook for making JSONata queries.';
		this._controller.executeHandler = this._executeAll.bind(this);
	}

	dispose(): void {
		this._controller.dispose();
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

        const loadFile = async (filename: string) => {
            if(!vscode.workspace.workspaceFolders) {return;}
            const folderUri = vscode.workspace.workspaceFolders[0].uri;
            const fileUri = Utils.joinPath(folderUri, filename);
            const file = await vscode.workspace.fs.readFile(fileUri);
            const string = new TextDecoder().decode(file);
            const res = JSON.parse(string);
            that._data = res;
            that._bindings['ans'] = res;
            return res;
        };

        const query = cell.document.getText();
        try {
            const data = this._data;
            const jsonataObject = jsonata(query);
            jsonataObject.registerFunction("loadFile", loadFile, "<s:s>");

            const result = jsonataObject.evaluate(data, this._bindings);

            const match = query.trim().match(/^\$(\w+)\s*:=/);
            if(match) {
                this._bindings[match[1]] = result;
            }
        
            this._bindings['ans'] = result;
            
            execution.replaceOutput([new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.json(result)
            ])]);

            execution.end(true, Date.now());
        } catch (e) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error({ 
                        name: e instanceof Error && e.name || 'error', 
                        message: e instanceof Error && e.message || stringify(e, undefined, 4)})
                ])
            ]);
            execution.end(false, Date.now());
        }
        
    }
}