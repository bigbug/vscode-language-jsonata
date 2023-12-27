import * as vscode from 'vscode';
import JSONataKernel from '../kernel/kernel';

const stringify = require('json-stringify-safe');

// const MIME_TYPE = "x-application/jsonata";

export default class NotebookKernel implements vscode.Disposable {
  readonly id = 'jsonata-book-kernel';

  readonly notebookType = 'jsonata-book';

  readonly label = 'JSONata Book';

  readonly supportedLanguages = ['jsonata'];

  private readonly controller: vscode.NotebookController;

  private executionOrder = 0;

  private kernel: JSONataKernel;

  constructor() {
    this.kernel = new JSONataKernel();
    this.controller = vscode.notebooks.createNotebookController(
      this.id,
      this.notebookType,
      this.label,
    );

    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = false;
    this.controller.description = 'A notebook for making JSONata queries.';
    this.controller.executeHandler = this.executeAll.bind(this);
  }

  dispose(): void {
    this.controller.dispose();
  }

  public async restartKernel() {
    await vscode.commands.executeCommand('notebook.clearAllCellsOutputs');
    this.kernel.restart();
  }

  private executeAll(
    cells: vscode.NotebookCell[],
    // eslint-disable-next-line no-unused-vars
    _notebook: vscode.NotebookDocument,
    // eslint-disable-next-line no-unused-vars
    _controller: vscode.NotebookController,
  ): void {
    let run = Promise.resolve();
    // eslint-disable-next-line no-restricted-syntax
    for (const cell of cells) {
      run = run.then(() => this.doExecution(cell));
    }
  }

  private async doExecution(cell: vscode.NotebookCell): Promise<void> {
    const execution = this.controller.createNotebookCellExecution(cell);
    // eslint-disable-next-line no-plusplus
    execution.executionOrder = ++this.executionOrder;
    execution.start(Date.now());

    const query = cell.document.getText();
    try {
      const result = await this.kernel.run(query);
      execution.replaceOutput([new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.json(result, 'text/x-json'),
      ])]);

      execution.end(true, Date.now());
      return Promise.resolve();
    } catch (e) {
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error({
            name: (e instanceof Error && e.name) || 'error',
            message: (e instanceof Error && e.message) || stringify(e, undefined, 4),
          }),
        ]),
      ]);
      execution.end(false, Date.now());
      return Promise.reject();
    }
  }
}
