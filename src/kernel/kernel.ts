import jsonata = require('jsonata');
/* import {
  evaluate, importFile, loadFile, loadUrl, parseString, readUrl, readFile, writeFile,
} from './functions'; */

export default class JSONataKernel {
  private data : unknown = undefined;

  private bindings : {[name:string] : unknown} = {};

  private functions: {[name: string]: {
    name: string,
    pointer: (...args: any[]) => Promise<unknown> | PromiseLike<unknown>,
    parameters?: string,
  }} = {
    /* parseString: {
      name: 'parseString',
      pointer: parseString,
      parameters: '<ss?:o>',
    },
    loadFile: {
      name: 'loadFile',
      pointer: this.wrapLoader(loadFile),
      parameters: '<ss?:o>',
    },
    loadUrl: {
      name: 'loadUrl',
      pointer: this.wrapLoader(loadUrl),
      parameters: '<ss?:o>',
    },
    readFile: {
      name: 'readFile',
      pointer: readFile,
      parameters: '<s?:s>',
    },
    writeFile: {
      name: 'writeFile',
      pointer: writeFile,
      parameters: '<so?:>',
    },
    readUrl: {
      name: 'readUrl',
      pointer: readUrl,
      parameters: '<s?:s>',
    },
    eval: {
      name: 'eval',
      pointer: evaluate,
      parameters: '<s?:o>',
    },
    import: {
      name: 'import',
      pointer: importFile,
      parameters: '<s?:o>',
    }, */
  };

  public async restart() {
    this.data = undefined;
    this.bindings = {};
  }

  public registerFunction(
    name:string,
    pointer: (...args: any[]) => Promise<unknown> | PromiseLike<unknown>,
    parameters?: string,
  ) {
    this.functions[name] = {
      name,
      pointer,
      parameters,
    };
  }

  private wrapLoader(func: (...args: any[]) => Promise<unknown>) :
  (...args: any[]) => Promise<unknown> {
    return (...args: any[]) => func(...args).then((res: unknown) => {
      this.data = res;
      return res;
    });
  }

  private registerFunctions(obj: jsonata.Expression) {
    Object.values(this.functions).forEach(
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
