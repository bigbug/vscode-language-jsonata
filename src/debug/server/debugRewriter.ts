/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */
import jsonata = require('jsonata');
import { isObject, isString } from 'lodash';
import formatJsonata from '../../language/formatter';

function makeid(length:number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

class DebugRewriter {
  public rewritten: jsonata.ExprNode;

  public adapter = 'jsonataDebugAdapter';

  private adapterVariable= 'jsonataDebugAdapterVariable';

  private code: string;

  public expressionPositions: number[] = [];

  private file: string;

  constructor(file: string, code: string) {
    this.code = code;
    this.file = file;
    this.findAdapterNaming();
    const obj = jsonata(code).ast();
    this.rewritten = this.block([
      this.functionCall(this.adapter, 'entry', this.file, 0, this.variable('')),
      ...this.wrapExpression(obj),
      this.functionCall(this.adapter, 'end', this.file, 99999999999, this.variable(this.adapterVariable)),
    ]);
  }

  private findAdapterNaming() {
    let ad = this.adapter;
    let tries = 0;
    while (this.code.includes(ad) && tries < 20) {
      ad = `${this.adapter}_${makeid(5)}`;
      tries += 1;
    }
    if (this.code.includes(ad)) {
      throw Error('Did not find untaken adapter within 20 tries!');
    }
    this.adapter = ad;
    this.adapterVariable = `${ad}Var`;
  }

  private bind(name: string, expr: jsonata.ExprNode) {
    const obj = {
      type: 'bind',
      value: ':=',
      position: -1,
      lhs: this.variable(name),
      rhs: expr,
    };
    // @ts-ignore
    return obj as jsonata.ExprNode;
  }

  private variable(name: string) {
    const obj = {
      position: -1,
      type: 'variable',
      value: name,
    };
    return obj as jsonata.ExprNode;
  }

  private literal(arg: string|number) {
    const obj = {
      position: -1,
      type: (isString(arg)) ? 'string' : 'number',
      value: arg,
    };
    return obj as jsonata.ExprNode;
  }

  private functionCall(
    name: string,
    ...args: (string|number|jsonata.ExprNode)[]
  ): jsonata.ExprNode {
    const obj = {
      type: 'function',
      name: undefined,
      position: -1,
      value: '(',
      procedure: this.variable(name),
      arguments: args.map((i) => {
        if (isObject(i)) return i;
        return this.literal(i);
      }),
    };
    // @ts-ignore
    return obj as jsonata.ExprNode;
  }

  private block(expr: jsonata.ExprNode[]) {
    const obj = {
      type: 'block',
      position: -1,
      expressions: expr,
    };
    return obj as jsonata.ExprNode;
  }

  private rewrite(obj: jsonata.ExprNode) {
    if (!obj) return obj;
    if (obj.type === 'unary' && obj.value === '{') {
      return this.rewriteObj(obj);
    } if (obj.type === 'unary' && obj.value === '[') {
      return this.rewriteArray(obj);
    } if (obj.type === 'unary' && obj.value === '-') {
      return this.rewriteMinus(obj);
    } if (obj.type === 'string') {
      return obj;
    } if (obj.type === 'number') {
      return obj;
    } if (obj.type === 'lambda') {
      return this.rewriteLambda(obj);
    } if (obj.type === 'variable') {
      return obj;
    } if (obj.type === 'binary') {
      return this.rewriteBinary(obj);
    } if (obj.type === 'name') {
      return obj;
    } if (obj.type === 'path') {
      return this.rewritePath(obj);
    } if (obj.type === 'block') {
      return this.rewriteBlock(obj);
    } if (obj.type === 'wildcard' || obj.type === 'descendant') {
      return obj;
    } if (obj.type === 'parent') {
      return obj;
    } if (obj.type === 'apply') {
      return this.rewriteApply(obj);
    } if (obj.type === 'bind') {
      return this.rewriteBind(obj);
    } if (obj.type === 'condition') {
      return this.rewriteCondition(obj);
    } if (obj.type === 'function' || obj.type === 'partial') {
      return this.rewriteFunction(obj);
    } if (obj.type === 'regex') {
      return obj;
    } if (obj.type === 'filter') {
      return this.rewriteFilter(obj);
    } if (obj.type === 'transform') {
      this.rewriteTransform(obj);
    } else if (obj.type === 'operator') {
      return obj;
    }
    return obj;
  }

  rewriteTransform(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.pattern = this.rewrite(obj.pattern);
    // @ts-ignore
    obj.update = this.rewrite(obj.update);
    // @ts-ignore
    if (obj.delete) obj.delete = this.rewrite(obj.delete);
    return obj;
  }

  rewriteFilter(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.expr = this.rewrite(obj.expr);
    return obj;
  }

  rewriteFunction(obj: jsonata.ExprNode) {
    this.rewriteArguments(obj);
    // @ts-ignore
    obj.procedure = this.rewrite(obj.procedure);
    return obj;
  }

  rewriteCondition(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.condition = this.rewrite(obj.condition);
    // @ts-ignore
    obj.then = this.rewrite(obj.then);
    // @ts-ignore
    obj.else = this.rewrite(obj.else);
    return obj;
  }

  rewriteBind(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.lhs = this.rewrite(obj.lhs);
    // @ts-ignore
    obj.rhs = this.rewrite(obj.rhs);
    return obj;
  }

  findBinds(e: jsonata.ExprNode) {
    const binds = [];
    let t = e;
    while (t.type === 'bind') {
      // @ts-ignore
      binds.push(t.lhs.value);
      // @ts-ignore
      t = t.rhs;
    }
    return binds;
  }

  wrapExpression(e: jsonata.ExprNode) {
    const position = e.position || -1;
    const binds = this.findBinds(e);
    if (position >= 0) this.expressionPositions.push(position);
    return [
      this.functionCall(this.adapter, 'exprBegin', this.file, position),
      this.bind(this.adapterVariable, this.rewrite(e)),
      this.functionCall(this.adapter, 'exprEnd', this.file, position, this.variable(this.adapterVariable), ...binds),
    ];
  }

  rewriteBlock(obj: jsonata.ExprNode) {
    if (!obj.expressions) return obj;
    const res = [
      this.functionCall(this.adapter, 'blockBegin', this.file, obj.position || -1),
    ];
    // @ts-ignore
    obj.expressions.forEach((e) => {
      res.push(...this.wrapExpression(e));
    });
    res.push(
      this.functionCall(this.adapter, 'blockEnd', this.file, obj.position || -1),
      this.variable(this.adapterVariable),
    );
    obj.expressions = res;
    return obj;
  }

  rewriteArguments(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.arguments = obj.arguments?.map((e) => this.rewrite(e));
  }

  rewriteLambda(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.body = this.rewrite(obj.body);
    // @ts-ignore
    if (Object.keys(obj).includes('thunk') && obj.thunk) {
      return obj;
    }
    return obj;
  }

  rewriteApply(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.lhs = this.rewrite(obj.lhs);
    // @ts-ignore
    obj.rhs = this.rewrite(obj.rhs);
    return obj;
  }

  rewritePath(obj: jsonata.ExprNode) {
    let i = 0;
    // @ts-ignore
    for (i; i < obj.steps?.length; i += 1) {
      // @ts-ignore
      obj.steps[i] = this.rewrite(obj.steps[i]);

      // @ts-ignore
      if (obj.steps[i].stages) {
        // @ts-ignore
        obj.steps[i].stages?.forEach((e) => this.rewrite(e));
      }
    }

    // @ts-ignore
    if (obj.group) {
      // @ts-ignore
      obj.group = this.rewrite(obj.group);
    }
    return obj;
  }

  rewriteBinary(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.lhs = this.rewrite(obj.lhs);
    if (obj.value === '=') {
      obj.rhs = this.block([
        this.functionCall(this.adapter, 'filterBegin', this.file, obj.position || -1),
        // @ts-ignore
        ...this.wrapExpression(obj.rhs),
        this.functionCall(this.adapter, 'filterEnd', this.file, obj.position || -1, this.variable(this.adapterVariable)),
        this.variable(this.adapterVariable),
      ]);
      return obj;
    }
    // @ts-ignore
    obj.rhs = this.rewrite(obj.rhs);
    return obj;
  }

  rewriteMinus(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.expression = this.rewrite(obj.expression);
    return obj;
  }

  rewriteArray(obj: jsonata.ExprNode) {
    // @ts-ignore
    obj.expressions = obj.expressions?.map((e) => this.rewrite(e));
    return obj;
  }

  rewriteObj(obj: jsonata.ExprNode) {
    obj.lhs = obj.lhs?.map((e) => {
      // @ts-ignore
      e[0] = this.rewrite(e[0]);
      // @ts-ignore
      e[1] = this.rewrite(e[1]);
      return e;
    });
    return obj;
  }
}

export default function rewriteDebug(file: string, code: string) {
  const obj = new DebugRewriter(file, code);
  return {
    code: formatJsonata(obj.rewritten),
    adapter: obj.adapter,
    expressions: obj.expressionPositions,
  };
}
