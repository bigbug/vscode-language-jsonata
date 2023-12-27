import jsonata = require('jsonata');
import {
  evaluate, importFile, loadFile, loadUrl, parseString, readUrl, readFile, writeFile,
} from './functions';

export default class JSONataKernel {
  private data : unknown = undefined;

  private bindings : {[name:string] : unknown} = {};

  public async restart() {
    this.data = undefined;
    this.bindings = {};
  }

  private wrapLoader(func: (...args: any[]) => Promise<unknown>) :
  (...args: any[]) => Promise<unknown> {
    return (...args: any[]) => func(...args).then((res: unknown) => {
      this.data = res;
    });
  }

  private registerFunctions(obj: jsonata.Expression) {
    const funcs : {
      name: string,
      pointer: (...args: any[]) => Promise<unknown> | PromiseLike<unknown>,
      parameters: string,
    }[] = [
      {
        name: 'parseString',
        pointer: parseString,
        parameters: '<ss?:o>',
      },
      {
        name: 'loadFile',
        pointer: this.wrapLoader(loadFile),
        parameters: '<ss?:o>',
      },
      {
        name: 'loadUrl',
        pointer: this.wrapLoader(loadUrl),
        parameters: '<ss?:o>',
      },
      {
        name: 'readFile',
        pointer: readFile,
        parameters: '<s?:s>',
      },
      {
        name: 'writeFile',
        pointer: writeFile,
        parameters: '<so?:>',
      },
      {
        name: 'readUrl',
        pointer: readUrl,
        parameters: '<s?:s>',
      },
      {
        name: 'eval',
        pointer: evaluate,
        parameters: '<s?:o>',
      },
      {
        name: 'import',
        pointer: importFile,
        parameters: '<s?:o>',
      },
    ];
    funcs.forEach(
      (a) => obj.registerFunction(a.name, (...b: any[]) => a.pointer(...b), a.parameters),
    );
  }

  public async run(code: string) {
    const obj = jsonata(code);
    this.registerFunctions(obj);
    const result = await obj.evaluate(this.data, this.bindings);
    const match = code.trim().match(/^\$(\w+)\s*:=/);
    if (match) {
      this.bindings[match[1]] = result;
    }
    this.bindings.ans = result;
    return result;
  }
}
