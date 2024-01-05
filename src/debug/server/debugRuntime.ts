/* eslint-disable class-methods-use-this */
/* eslint-disable no-plusplus */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */

import { EventEmitter } from 'events';
import { TextDecoder } from 'util';
import { get } from 'lodash';
import rewriteDebug from './debugRewriter';
import JSONataKernel from '../../kernel/kernel';

export interface FileAccessor {
  isWindows: boolean;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export interface IRuntimeBreakpoint {
  id: number;
  line: number;
  verified: boolean;
}

/* interface IRuntimeStepInTargets {
  id: number;
  label: string;
} */

/* interface IRuntimeStackFrame {
  index: number;
  name: string;
  file: string;
  line: number;
  column?: number;
  instruction?: number;
} */

/* interface IRuntimeStack {
  count: number;
  frames: IRuntimeStackFrame[];
} */

/* interface RuntimeDisassembledInstruction {
  address: number;
  instruction: string;
  line?: number;
} */

interface IRuntimeVariable {
  value: unknown,
  type: string,
}

interface IRuntimePosition {
  position: number,
  line: number,
  col: number,
}

interface IRuntimeScope {
  name: string,
  lastResult: unknown,
  variables: {[name: string]: IRuntimeVariable}
  data: unknown,
  file: string,
  currentPosition: IRuntimePosition,
  entryPosition: IRuntimePosition,
}

/* interface Word {
  name: string;
  line: number;
  index: number;
} */

export function timeout(ms: number) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * A Mock runtime with minimal debugger functionality.
 * MockRuntime is a hypothetical (aka "Mock") "execution engine with debugging support":
 * it takes a Markdown (*.md) file and "executes" it by "running" through the text lines
 * and searching for "command" patterns that trigger some debugger related functionality
 * (e.g. exceptions).
 * When it finds a command it typically emits an event.
 * The runtime can not only run through the whole file but also executes one line at a time
 * and stops on lines for which a breakpoint has been registered. This functionality is the
 * core of the "debugging support".
 * Since the MockRuntime is completely independent from VS Code or the Debug Adapter Protocol,
 * it can be viewed as a simplified representation of a real "execution engine" (e.g. node.js)
 * or debugger (e.g. gdb).
 * When implementing your own debugger extension for VS Code, you probably don't need this
 * class because you can rely on some existing debugger or runtime.
 */
export class MockRuntime extends EventEmitter {
  // the initial (and one and only) file we are 'debugging'
  private _sourceFile: string = '';

  public get sourceFile() {
    return this._sourceFile;
  }

  // private variables = new Map<string, RuntimeVariable>();

  // the contents (= lines) of the one and only file
  private sourceLines: string[] = [];

  private source?: string;

  private debugSource?: string;

  private kernel = new JSONataKernel();

  private adapter?: string;

  private scopes: IRuntimeScope[] = [];

  public getScopes() {
    return this.scopes;
  }

  public getCurrentScope() {
    return this.scopes[this.scopes.length - 1];
  }

  // private instructions: Word[] = [];

  // private starts: number[] = [];

  // private ends: number[] = [];

  // This is the next line that will be 'executed'
  // private _currentLine = 0;

  // private get currentLine() {
  //   return this._currentLine;
  // }

  // private set currentLine(x) {
  //   this._currentLine = x;
  //   this.instruction = this.starts[x];
  // }

  // private currentColumn: number | undefined;

  // This is the next instruction that will be 'executed'
  // public instruction= 0;

  // maps from sourceFile to array of IRuntimeBreakpoint
  private breakPoints = new Map<string, IRuntimeBreakpoint[]>();

  // all instruction breakpoint addresses
  private instructionBreakpoints = new Set<number>();

  // since we want to send breakpoint events, we will assign an id to every event
  // so that the frontend can match events with breakpoints.
  private breakpointId = 1;

  private expressionPositions : number[] = [];

  // private breakAddresses = new Map<string, string>();

  // private namedException: string | undefined;

  private resolveCurrentBreak?: (value: unknown) => void;

  // private otherExceptions = false;
  private stopOnEntry:boolean = false;

  private stopOnStep:boolean = false;

  constructor(private fileAccessor: FileAccessor) {
    super();
  }

  private pushScope(name: string, data: unknown, file: string, position: IRuntimePosition) {
    this.scopes.push({
      name,
      variables: {},
      lastResult: undefined,
      data,
      file,
      currentPosition: position,
      entryPosition: position,
    });
  }

  public evaluateExpression(expr: string): unknown {
    const v = expr.split('.', 2)[0].split('[', 2)[0];
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      const scope = this.scopes[i];

      // eslint-disable-next-line no-continue
      if (!(v in scope.variables)) continue;

      const obj: {[n: string]: unknown} = {};
      obj[v] = scope.variables[v].value;
      const res = get(obj, expr, 'Path not found in variable');
      if (res === 'Path not found in variable') {
        throw Error('path not found');
      }
      return res;
    }
    throw Error('not found');
  }

  private setVariableInCurrentScope(name: string, value: unknown) {
    this.getCurrentScope().variables[`${name}`] = {
      value,
      type: 'unknown',
    };
  }

  private setLastResult(value: unknown) {
    this.getCurrentScope().lastResult = value;
  }

  private kernelEventHandler(
    event: string,
    file: string,
    pos: number,
    ...args:any[]
  ) {
    console.log(`runtime:kernelEventHandler:${event}`);
    const position = this.getPosition(file, pos);
    if (this.scopes.length > 0) this.getCurrentScope().currentPosition = position;
    if (event === 'entry') {
      if (args.length !== 1) throw Error('Invalid entry implementation');

      this.pushScope('main', args[0], file, position);

      if (!this.stopOnEntry) {
        return Promise.resolve();
      }
      this.sendEvent('stopOnEntry');
    } else if (event === 'exprBegin') {
      if (!this.stopOnStep) {
        return Promise.resolve();
      }
      this.sendEvent('stopOnStep');
    } else if (event === 'exprEnd') {
      const [result, ...binds] = args;
      this.setLastResult(result);
      binds.forEach((bind) => this.setVariableInCurrentScope(bind, result));
      return Promise.resolve();
    } else if (event === 'blockBegin') {
      this.pushScope('Block', args[0], file, position);
      return Promise.resolve();
    } else if (event === 'blockEnd') {
      const sc = this.scopes.pop();
      this.setLastResult(sc?.lastResult);
      if (!this.stopOnStep) {
        return Promise.resolve();
      }
      this.sendEvent('stopOnStep');
    } else if (event === 'filterBegin') {
      this.pushScope('Filter', undefined, file, position);
      return Promise.resolve();
    } else if (event === 'filterEnd') {
      // eslint-disable-next-line no-unused-vars
      const scope = this.scopes.pop();
      return Promise.resolve();
    } else if (event === 'functionBegin') {
      this.pushScope('Function', undefined, file, position);
      this.setFunctionParameters(...args);
      return Promise.resolve();
    } else if (event === 'functionEnd') {
      const sc = this.scopes.pop();
      this.setLastResult(sc?.lastResult);
      if (!this.stopOnStep) {
        return Promise.resolve();
      }
      this.sendEvent('stopOnStep');
    } else if (event === 'end') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.resolveCurrentBreak = resolve;
    });
  }

  private setFunctionParameters(...args: unknown[]) {
    const half = Math.ceil(args.length / 2);
    const names = args.slice(0, half);
    const values = args.slice(half, args.length);

    for (let i = 0; i < names.length; i++) {
      this.setVariableInCurrentScope(names[i] as string, values[i]);
    }
  }

  private getPosition(file: string, position: number): IRuntimePosition {
    if (file !== this._sourceFile) throw Error(`The file ${file} is not loaded!`);
    if (!this.source) throw Error('Source is not loaded!');

    const lines = this.source.slice(0, position).split('\n');
    const line = lines.length - 1;
    return {
      position,
      line,
      col: lines[line].length,
    };
  }

  private async loadSource(file: string): Promise<void> {
    if (this._sourceFile !== file) {
      this._sourceFile = this.normalizePathAndCasing(file);
      const memory = await this.fileAccessor.readFile(file);
      this.source = new TextDecoder().decode(memory);
      const data = rewriteDebug(this._sourceFile, this.source);
      this.debugSource = data.code;
      this.expressionPositions = data.expressions;
      this.adapter = data.adapter;
    }
  }

  /**
   * Start executing the given program.
   */
  public async start(program: string, stopOnEntry: boolean, debug: boolean): Promise<void> {
    console.log('runtime:start');

    await this.loadSource(this.normalizePathAndCasing(program));

    if (!this.adapter) {
      throw Error('Incomplete initialization of adapter!');
    }

    if (!this.debugSource) {
      throw Error('Debug source not available!');
    }

    console.log(this.debugSource);
    this.kernel.registerFunction(this.adapter, this.kernelEventHandler.bind(this));

    this.stopOnEntry = false;
    if (debug) {
      this.stopOnEntry = stopOnEntry;
      await this.verifyBreakpoints(this._sourceFile);
    }
    try {
      console.log('runtime:startExecution');
      this.kernel.run(this.debugSource)
        .then(
          () => {
            console.log('runtime:successfully finished');
            this.sendEvent('end');
          },
          (e) => {
            console.log('runtime:exception occurred');
            console.error(e);
            this.sendEvent('stopOnException', e);
          },
        );
    } catch (e) {
      console.log('runtime:exception occurred');
      console.error(e);
      this.sendEvent('stopOnException', e);
    }
  }

  private resolve() {
    if (!this.resolveCurrentBreak) {
      throw Error('No resolve available!');
    }
    const tmp = this.resolveCurrentBreak;
    this.resolveCurrentBreak = undefined;
    tmp(undefined);
  }

  /**
   * Continue execution to the end/beginning.
   */
  public continue() {
    this.stopOnStep = false;
    this.resolve();
  }

  /**
   * Step to the next/previous non empty line.
   */
  public step() {
    this.stopOnStep = true;
    this.resolve();
  }

  public stepIn() {
    throw Error('Not implemented yet');
  }

  public stepOut() {
    throw Error('Not implemented yet');
  }

  /* private updateCurrentLine(reverse: boolean): boolean {
    if (reverse) {
      if (this.currentLine > 0) {
        this.currentLine--;
      } else {
        // no more lines: stop at first line
        this.currentLine = 0;
        this.currentColumn = undefined;
        this.sendEvent('stopOnEntry');
        return true;
      }
    } else if (this.currentLine < this.sourceLines.length - 1) {
      this.currentLine++;
    } else {
      // no more lines: run to end
      this.currentColumn = undefined;
      this.sendEvent('end');
      return true;
    }
    return false;
  } */

  /**
   * "Step into" for Mock debug means: go to next character
   */
  /* public stepIn(targetId: number | undefined) {
    if (typeof targetId === 'number') {
      this.currentColumn = targetId;
      this.sendEvent('stopOnStep');
    } else {
      if (typeof this.currentColumn === 'number') {
        if (this.currentColumn <= this.sourceLines[this.currentLine].length) {
          this.currentColumn += 1;
        }
      } else {
        this.currentColumn = 1;
      }
      this.sendEvent('stopOnStep');
    }
  } */

  /**
   * "Step out" for Mock debug means: go to previous character
   */
  /* public stepOut() {
    if (typeof this.currentColumn === 'number') {
      this.currentColumn -= 1;
      if (this.currentColumn === 0) {
        this.currentColumn = undefined;
      }
    }
    this.sendEvent('stopOnStep');
  } */

  /* public getStepInTargets(frameId: number): IRuntimeStepInTargets[] {
    const line = this.getLine();
    const words = this.getWords(this.currentLine, line);

    // return nothing if frameId is out of range
    if (frameId < 0 || frameId >= words.length) {
      return [];
    }

    const { name, index } = words[frameId];

    // make every character of the frame a potential "step in" target
    return name.split('').map((c, ix) => ({
      id: index + ix,
      label: `target: ${c}`,
    }));
  } */

  /**
   * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
   */
  /* public stack(startFrame: number, endFrame: number): IRuntimeStack {
    const line = this.getLine();
    const words = this.getWords(this.currentLine, line);
    // add a sentinel so that the stack is never empty...
    words.push({ name: 'BOTTOM', line: -1, index: -1 });

    // if the line contains the word 'disassembly' we support to
    // "disassemble" the line by adding an 'instruction' property to the stackframe
    const instruction = line.indexOf('disassembly') >= 0 ? this.instruction : undefined;

    const column = typeof this.currentColumn === 'number' ? this.currentColumn : undefined;

    const frames: IRuntimeStackFrame[] = [];
    // every word of the current line becomes a stack frame.
    for (let i = startFrame; i < Math.min(endFrame, words.length); i++) {
      const stackFrame: IRuntimeStackFrame = {
        index: i,
        name: `${words[i].name}(${i})`, // use a word of the line as the stackframe name
        file: this._sourceFile,
        line: this.currentLine,
        column, // words[i].index
        instruction: instruction ? instruction + i : 0,
      };

      frames.push(stackFrame);
    }

    return {
      frames,
      count: words.length,
    };
  } */

  /*
   * Determine possible column breakpoint positions for the given line.
   * Here we return the start location of words with more than 8 characters.
   */
  /* public getBreakpoints(path: string, line: number): number[] {
    return this
      .getWords(line, this.getLine(line))
      .filter((w) => w.name.length > 8)
      .map((w) => w.index);
  } */

  /*
   * Set breakpoint in file with given line.
   */
  public async setBreakPoint(npath: string, line: number): Promise<IRuntimeBreakpoint> {
    const path = this.normalizePathAndCasing(npath);

    const bp: IRuntimeBreakpoint = { verified: false, line, id: this.breakpointId++ };
    let bps = this.breakPoints.get(path);
    if (!bps) {
      bps = [];
      this.breakPoints.set(path, bps);
    }
    bps.push(bp);

    await this.verifyBreakpoints(path);

    return bp;
  }

  /*
   * Clear breakpoint in file with given line.
   */
  public clearBreakPoint(path: string, line: number): IRuntimeBreakpoint | undefined {
    const bps = this.breakPoints.get(this.normalizePathAndCasing(path));
    if (bps) {
      const index = bps.findIndex((bp) => bp.line === line);
      if (index >= 0) {
        const bp = bps[index];
        bps.splice(index, 1);
        return bp;
      }
    }
    return undefined;
  }

  public clearBreakpoints(path: string): void {
    this.breakPoints.delete(this.normalizePathAndCasing(path));
  }

  /* public setDataBreakpoint(address: string, accessType: 'read'| 'write' | 'readWrite'): boolean {
    const x = accessType === 'readWrite' ? 'read write' : accessType;

    const t = this.breakAddresses.get(address);
    if (t) {
      if (t !== x) {
        this.breakAddresses.set(address, 'read write');
      }
    } else {
      this.breakAddresses.set(address, x);
    }
    return true;
  } */

  /* public clearAllDataBreakpoints(): void {
    this.breakAddresses.clear();
  } */

  // public setExceptionsFilters(namedException: string | undefined,
  // otherExceptions: boolean): void {
  //   this.namedException = namedException;
  //   this.otherExceptions = otherExceptions;
  // }

  public setInstructionBreakpoint(address: number): boolean {
    this.instructionBreakpoints.add(address);
    return true;
  }

  public clearInstructionBreakpoints(): void {
    this.instructionBreakpoints.clear();
  }

  /* public async getGlobalVariables(
    // cancellationToken?: () => boolean): Promise<RuntimeVariable[]> {
    const a: RuntimeVariable[] = [];

    for (let i = 0; i < 10; i++) {
      a.push(new RuntimeVariable(`global_${i}`, i));
      if (cancellationToken && cancellationToken()) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await timeout(1000);
    }

    return a;
  }

  public getLocalVariables(): RuntimeVariable[] {
    // eslint-disable-next-line no-unused-vars
    return Array.from(this.variables, ([name, value]) => value);
  }

  public getLocalVariable(name: string): RuntimeVariable | undefined {
    return this.variables.get(name);
  } */

  /**
   * Return words of the given address range as "instructions"
   */
  /* public disassemble(address: number, instructionCount: number):
  RuntimeDisassembledInstruction[] {
    const instructions: RuntimeDisassembledInstruction[] = [];

    for (let a = address; a < address + instructionCount; a++) {
      if (a >= 0 && a < this.instructions.length) {
        instructions.push({
          address: a,
          instruction: this.instructions[a].name,
          line: this.instructions[a].line,
        });
      } else {
        instructions.push({
          address: a,
          instruction: 'nop',
        });
      }
    }

    return instructions;
  } */

  // private methods

  /* private getLine(line?: number): string {
    return this.sourceLines[line === undefined ? this.currentLine : line].trim();
  } */

  /* private getWords(l: number, line: string): Word[] {
    // break line into words
    const WORD_REGEXP = /[a-z]+/ig;
    const words: Word[] = [];
    let match: RegExpExecArray | null;
    while (match = WORD_REGEXP.exec(line)) {
      words.push({ name: match[0], line: l, index: match.index });
    }
    return words;
  } */

  /**
   * return true on stop
   */
  /* private findNextStatement(reverse: boolean, stepEvent?: string): boolean {
    for (let ln = this.currentLine;
      reverse ? ln >= 0 : ln < this.sourceLines.length;
      reverse ? ln-- : ln++) {
      // is there a source breakpoint?
      const breakpoints = this.breakPoints.get(this._sourceFile);
      if (breakpoints) {
        const bps = breakpoints.filter((bp) => bp.line === ln);
        if (bps.length > 0) {
          // send 'stopped' event
          this.sendEvent('stopOnBreakpoint');

          // the following shows the use of 'breakpoint' events to update properties of a breakpoint
          // in the UI
          // if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
          if (!bps[0].verified) {
            bps[0].verified = true;
            this.sendEvent('breakpointValidated', bps[0]);
          }

          this.currentLine = ln;
          return true;
        }
      }

      const line = this.getLine(ln);
      if (line.length > 0) {
        this.currentLine = ln;
        break;
      }
    }
    if (stepEvent) {
      this.sendEvent(stepEvent);
      return true;
    }
    return false;
  } */

  /**
   * "execute a line" of the readme markdown.
   * Returns true if execution sent out a stopped event and needs to stop.
   */
  /* private executeLine(ln: number, reverse: boolean): boolean {
    // first "execute" the instructions associated with this line
    // and potentially hit instruction breakpoints
    while (reverse ? this.instruction >= this.starts[ln] : this.instruction < this.ends[ln]) {
      reverse ? this.instruction-- : this.instruction++;
      if (this.instructionBreakpoints.has(this.instruction)) {
        this.sendEvent('stopOnInstructionBreakpoint');
        return true;
      }
    }

    const line = this.getLine(ln);

    // find variable accesses
    const reg0 = /\$([a-z][a-z0-9]*)(=(false|true|[0-9]+(\.[0-9]+)?|\".*\"|\{.*\}))?/ig;
    let matches0: RegExpExecArray | null;
    while (matches0 = reg0.exec(line)) {
      if (matches0.length === 5) {
        let access: string | undefined;

        const name = matches0[1];
        const value = matches0[3];

        const v = new RuntimeVariable(name, value);

        if (value && value.length > 0) {
          if (value === 'true') {
            v.value = true;
          } else if (value === 'false') {
            v.value = false;
          } else if (value[0] === '"') {
            v.value = value.slice(1, -1);
          } else if (value[0] === '{') {
            v.value = [
              new RuntimeVariable('fBool', true),
              new RuntimeVariable('fInteger', 123),
              new RuntimeVariable('fString', 'hello'),
              new RuntimeVariable('flazyInteger', 321),
            ];
          } else {
            v.value = parseFloat(value);
          }

          if (this.variables.has(name)) {
            // the first write access to a variable is the "declaration" and not a "write access"
            access = 'write';
          }
          this.variables.set(name, v);
        } else if (this.variables.has(name)) {
          // variable must exist in order to trigger a read access
          access = 'read';
        }

        const accessType = this.breakAddresses.get(name);
        if (access && accessType && accessType.indexOf(access) >= 0) {
          this.sendEvent('stopOnDataBreakpoint', access);
          return true;
        }
      }
    }

    // if 'log(...)' found in source -> send argument to debug console
    const reg1 = /(log|prio|out|err)\(([^\)]*)\)/g;
    let matches1: RegExpExecArray | null;
    while (matches1 = reg1.exec(line)) {
      if (matches1.length === 3) {
        this.sendEvent('output', matches1[1], matches1[2], this._sourceFile, ln, matches1.index);
      }
    }

    // if pattern 'exception(...)' found in source -> throw named exception
    const matches2 = /exception\((.*)\)/.exec(line);
    if (matches2 && matches2.length === 2) {
      const exception = matches2[1].trim();
      if (this.namedException === exception) {
        this.sendEvent('stopOnException', exception);
        return true;
      }
      if (this.otherExceptions) {
        this.sendEvent('stopOnException', undefined);
        return true;
      }
    } else {
      // if word 'exception' found in source -> throw exception
      if (line.indexOf('exception') >= 0) {
        if (this.otherExceptions) {
          this.sendEvent('stopOnException', undefined);
          return true;
        }
      }
    }

    // nothing interesting found -> continue
    return false;
  } */

  // eslint-disable-next-line no-unused-vars
  private async verifyBreakpoints(path: string): Promise<void> {
    /* const bps = this.breakPoints.get(path);
    if (bps) {
      await this.loadSource(path);
      bps.forEach((bp) => {
        if (!bp.verified && bp.line < this.sourceLines.length) {
          const srcLine = this.getLine(bp.line);

          // if a line is empty or starts with '+' we don't allow to set
          // a breakpoint but move the breakpoint down
          if (srcLine.length === 0 || srcLine.indexOf('+') === 0) {
            bp.line++;
          }
          // if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
          if (srcLine.indexOf('-') === 0) {
            bp.line--;
          }
          // don't set 'verified' to true if the line contains the word 'lazy'
          // in this case the breakpoint will be verified 'lazy' after hitting it once.
          if (srcLine.indexOf('lazy') < 0) {
            bp.verified = true;
            this.sendEvent('breakpointValidated', bp);
          }
        }
      });
    } */
  }

  private sendEvent(event: string, ...args: any[]): void {
    setTimeout(() => {
      this.emit(event, ...args);
    }, 0);
  }

  private normalizePathAndCasing(path: string) {
    if (this.fileAccessor.isWindows) {
      return path.replace(/\//g, '\\').toLowerCase();
    }
    return path.replace(/\\/g, '/');
  }
}
