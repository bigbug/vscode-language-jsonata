/* eslint-disable max-classes-per-file */
import * as vscode from 'vscode';

// NEEDED Declaration to silence errors
declare class TextDecoder {
  decode(data: Uint8Array): string;
}

declare class TextEncoder {
  encode(data: string): Uint8Array;
}

const stringify = require('json-stringify-safe');

interface RawCellOutput {
  mime: string;
  value: any;
}
interface RawNotebookCell {
  language: string;
  value: string;
  kind: vscode.NotebookCellKind;
    editable?: boolean;
    outputs: RawCellOutput[];
}

export default class NotebookSerializer implements vscode.NotebookSerializer {
  // eslint-disable-next-line class-methods-use-this
  async deserializeNotebook(
    content: Uint8Array,
    // eslint-disable-next-line no-unused-vars
    _token: vscode.CancellationToken,
  ): Promise<vscode.NotebookData> {
    const contents = new TextDecoder().decode(content); // convert to String to make JSON object

    // Read file contents
    let raw: RawNotebookCell[];
    try {
      raw = <RawNotebookCell[]>JSON.parse(contents);
    } catch {
      raw = [];
    }

    function convertRawOutputToBytes(cell: RawNotebookCell) {
      const result: vscode.NotebookCellOutputItem[] = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const output of cell.outputs) {
        const data = new TextEncoder().encode(stringify(output.value));
        result.push(new vscode.NotebookCellOutputItem(data, output.mime));
      }

      return result;
    }

    // Create array of Notebook cells for the VS Code API from file contents
    const cells = raw.map((item) => new vscode.NotebookCellData(
      item.kind,
      item.value,
      item.language,
    ));

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.outputs = [];
      if (raw[i].outputs) {
        cell.outputs = [new vscode.NotebookCellOutput(convertRawOutputToBytes(raw[i]))];
      }
    }

    // Pass read and formatted Notebook Data to VS Code to display Notebook with saved cells
    return new vscode.NotebookData(
      cells,
    );
  }

  // eslint-disable-next-line class-methods-use-this
  async serializeNotebook(
    data: vscode.NotebookData,
    // eslint-disable-next-line no-unused-vars
    _token: vscode.CancellationToken,
  ): Promise<Uint8Array> {
    // function to take output renderer data to a format to save to the file
    function asRawOutput(cell: vscode.NotebookCellData): RawCellOutput[] {
      const result: RawCellOutput[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const output of cell.outputs ?? []) {
        // eslint-disable-next-line no-restricted-syntax
        for (const item of output.items) {
          let outputContents = '';
          outputContents = new TextDecoder().decode(item.data);

          try {
            const outputData = JSON.parse(outputContents);
            result.push({ mime: item.mime, value: outputData });
          } catch {
            result.push({ mime: item.mime, value: outputContents });
          }
        }
      }
      return result;
    }

    // Map the Notebook data into the format we want to save the Notebook data as

    const contents: RawNotebookCell[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const cell of data.cells) {
      contents.push({
        kind: cell.kind,
        language: cell.languageId,
        value: cell.value,
        outputs: asRawOutput(cell),
      });
    }

    // Give a string of all the data to save and VS Code will handle the rest
    return new TextEncoder().encode(stringify(contents));
  }
}
