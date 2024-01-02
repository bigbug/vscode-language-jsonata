// eslint-disable-next-line max-classes-per-file
import jsonata = require('jsonata');
import {
  DocumentFormattingEditProvider, Position, ProviderResult, Range, TextDocument, TextEdit, window,
} from 'vscode';
// @ts-ignore
import parser = require('./parser');
import populateMessage from './errors';

class Formatter {
  private indent = 0;

  private indentStep = 2;

  private formattedCode: string = '';

  constructor(code: string) {
    const obj = parser(code);
    this.evaluate(obj);

    if (this.strip(code) !== this.strip(this.formattedCode)) {
      // window.showErrorMessage('Error on formatting! Input and output are different!');
      // throw new Error('Error on formatting! Input and output are different!');
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private strip(code: string) {
    let res = code;
    res = res.replace(/[ \s\t\n]/g, '');
    return res;
  }

  private evaluate(obj: jsonata.ExprNode) {
    // @ts-ignore
    if (obj.comments && obj.comments.length > 0) {
      // @ts-ignore
      (obj.comments as string[]).forEach((comment) => {
        this.p(`/*${comment}*/\n`);
      });
    }
    if (obj.type === 'unary' && obj.value === '{') {
      this.evaluteObj(obj);
    } else if (obj.type === 'unary' && obj.value === '[') {
      this.evaluateArray(obj);
    } else if (obj.type === 'unary' && obj.value === '-') {
      this.evaluateMinus(obj);
    } else if (obj.type === 'string') {
      this.evaluateString(obj);
    } else if (obj.type === 'number') {
      this.evaluateNumber(obj);
    } else if (obj.type === 'lambda') {
      this.evaluateLambda(obj);
    } else if (obj.type === 'variable') {
      this.evaluateVariable(obj);
    } else if (obj.type === 'binary') {
      this.evaluateBinary(obj);
    } else if (obj.type === 'name') {
      this.evaluateName(obj);
    } else if (obj.type === 'path') {
      this.evaluatePath(obj);
    } else if (obj.type === 'block') {
      this.evaluateBlock(obj);
    } else if (obj.type === 'wildcard' || obj.type === 'descendant') {
      this.evaluateWildcard(obj);
    } else if (obj.type === 'parent') {
      this.evaluateParent(obj);
    } else if (obj.type === 'apply') {
      this.evaluateApply(obj);
    } else if (obj.type === 'bind') {
      this.evaluateBind(obj);
    } else if (obj.type === 'condition') {
      this.evaluateCondition(obj);
    } else if (obj.type === 'function' || obj.type === 'partial') {
      this.evaluateFunction(obj);
    } else if (obj.type === 'regex') {
      this.evaluateRegex(obj);
    } else if (obj.type === 'filter') {
      this.evaluateFilter(obj);
    } else if (obj.type === 'comment') {
      this.evaluateComment(obj);
    } else if (obj.type === 'transform') {
      this.evaluateTransform(obj);
    } else if (obj.type === 'operator') {
      this.p(obj.value);
    } else {
      this.rest(obj);
    }
    // @ts-ignore
    if (obj.commentsAfter && obj.commentsAfter.length > 0) {
      this.p('\n\n');
      // @ts-ignore
      (obj.commentsAfter as string[]).forEach((comment) => {
        this.p(`/*${comment}*/\n`);
      });
    }
  }

  private rest(obj: jsonata.ExprNode) {
    this.p(JSON.stringify(obj, undefined, 4));
  }

  private p(code: string) {
    this.formattedCode += code.replace('\n', `\n${' '.repeat(this.indent)}`);
  }

  private i() {
    this.indent += this.indentStep;
  }

  private d() {
    this.indent -= this.indentStep;
  }

  private evaluteObj(obj: jsonata.ExprNode) {
    this.p('{');
    this.i();
    obj.lhs?.forEach((e, i, a) => {
      this.p('\n');
      // @ts-ignore
      this.evaluate(e[0]);
      this.p(': ');
      // @ts-ignore
      this.evaluate(e[1]);
      if (i + 1 !== a.length) this.p(',');
    });
    this.d();
    this.p('\n');
    this.p('}');
  }

  private evaluateArray(obj:jsonata.ExprNode) {
    if (obj.expressions?.length === 1) {
      this.p('[');
      this.evaluate(obj.expressions[0]);
      this.p(']');
      return;
    }
    this.i();
    this.p('[');
    obj.expressions?.forEach((e, i, a) => {
      this.p('\n');
      this.evaluate(e);
      if (i + 1 !== a.length) this.p(',');
    });
    this.d();
    this.p('\n]');
  }

  private evaluateBlock(obj: jsonata.ExprNode) {
    if (obj.expressions?.length === 1) {
      this.p('(');
      this.evaluate(obj.expressions[0]);
      this.p(')');
      return;
    }
    this.i();
    this.p('(\n');
    obj.expressions?.forEach((e, i, a) => {
      this.evaluate(e);
      if (i + 1 !== a.length) this.p(';\n');
    });
    this.d();
    this.p('\n)');
  }

  private evaluateCondition(obj: jsonata.ExprNode) {
    // @ts-ignore
    this.evaluate(obj.condition);
    this.i();
    this.p('\n? ');
    // @ts-ignore
    this.evaluate(obj.then);
    this.p('\n: ');
    // @ts-ignore
    this.evaluate(obj.else);
    this.d();
  }

  private evaluateBind(obj: jsonata.ExprNode) {
    // @ts-ignore
    this.evaluate(obj.lhs);
    this.p(` ${obj.value} `);
    // @ts-ignore
    this.evaluate(obj.rhs);
  }

  private evaluateString(obj: jsonata.ExprNode) {
    this.p(`"${obj.value}"`);
  }

  private evaluateMinus(obj: jsonata.ExprNode) {
    this.p('-');
    // @ts-ignore
    this.evaluate(obj.expression);
  }

  private evaluateNumber(obj: jsonata.ExprNode) {
    this.p(`${obj.value}`);
  }

  private evaluateArguments(obj: jsonata.ExprNode) {
    obj.arguments?.forEach((arg, index, a) => {
      this.evaluate(arg);
      if (index + 1 !== a.length) {
        this.p(', ');
      }
    });
  }

  private evaluateLambda(obj: jsonata.ExprNode) {
    // @ts-ignore
    if (Object.keys(obj).includes('thunk') && obj.thunk) {
      // @ts-ignore
      this.evaluate(obj.body);
      return;
    }
    this.p('function(');
    this.evaluateArguments(obj);
    this.i();
    this.p(') {\n');
    // @ts-ignore
    this.evaluate(obj.body);
    this.d();
    this.p('\n}');
  }

  private evaluateFunction(obj: jsonata.ExprNode) {
    // @ts-ignore
    this.evaluate(obj.procedure);
    this.p('(');
    this.evaluateArguments(obj);
    this.p(')');
  }

  private evaluateVariable(obj: jsonata.ExprNode) {
    this.p(`$${obj.value}`);
  }

  private evaluateWildcard(obj: jsonata.ExprNode) {
    this.p(obj.value);
  }

  // eslint-disable-next-line no-unused-vars
  private evaluateParent(obj: jsonata.ExprNode) {
    this.p('%');
  }

  private evaluateRegex(obj: jsonata.ExprNode) {
    this.p(obj.value.toString());
  }

  private evaluateBinary(obj: jsonata.ExprNode) {
    // @ts-ignore
    this.evaluate(obj.lhs);
    this.p(` ${obj.value} `);
    // @ts-ignore
    this.evaluate(obj.rhs);
  }

  private evaluatePath(obj: jsonata.ExprNode) {
    let i = 0;
    // @ts-ignore
    if (obj.steps[0].type === 'variable' && obj.steps[0].value === '') {
      i = 1;
      this.p('$');
    }
    // @ts-ignore
    for (i; i < obj.steps?.length; i += 1) {
      if (i !== 0) this.p('.');
      // @ts-ignore
      this.evaluate(obj.steps[i]);

      // @ts-ignore
      if (obj.steps[i].stages) {
        // @ts-ignore
        obj.steps[i].stages?.forEach((e) => this.evaluate(e));
      }
    }
    // @ts-ignore
    if (obj.group) {
      // @ts-ignore
      this.evaluteObj(obj.group);
    }
  }

  private evaluateFilter(obj: jsonata.ExprNode) {
    this.p('[');
    // @ts-ignore
    if (obj.expr.lhs && obj.expr.lhs.steps
      // @ts-ignore
      && obj.expr.lhs.steps.length > 0
      // @ts-ignore
      && obj.expr.lhs.steps[0].comments) {
      this.i();
      this.p('\n');
      // @ts-ignore
      this.evaluate(obj.expr);
      this.d();
      this.p('\n');
    } else {
      // @ts-ignore
      this.evaluate(obj.expr);
    }
    this.p(']');
  }

  private evaluateApply(obj:jsonata.ExprNode) {
    // @ts-ignore
    this.evaluate(obj.lhs);
    this.p(` ${obj.value} `);
    // @ts-ignore
    this.evaluate(obj.rhs);
  }

  private evaluateName(obj: jsonata.ExprNode) {
    const value = obj.value as string;
    if (value.includes(' ')) {
      this.p(`\`${value}\``);
      return;
    }
    this.p(value);
  }

  private evaluateComment(obj: jsonata.ExprNode) {
    this.p(`/*${obj.value}*/\n`);
    // @ts-ignore
    this.evaluate(obj.expression);
  }

  private evaluateTransform(obj: jsonata.ExprNode) {
    this.p('| ');
    // @ts-ignore
    this.evaluate(obj.pattern);
    this.p(' | ');
    // @ts-ignore
    this.evaluate(obj.update);
    // @ts-ignore
    if (obj.delete) {
      this.p(', ');
      // @ts-ignore
      this.evaluate(obj.delete);
    }
    this.p(' |');
  }

  public code() {
    return this.formattedCode;
  }
}

export default class JSONataDocumentFormatter implements DocumentFormattingEditProvider {
  // eslint-disable-next-line class-methods-use-this
  provideDocumentFormattingEdits(
    document: TextDocument,
    // options: FormattingOptions,
    // token: CancellationToken,
  ): ProviderResult<TextEdit[]> {
    try {
      const code = document.getText();
      const formatted = new Formatter(code).code();

      const edit: TextEdit[] = [];
      edit.push(new TextEdit(
        new Range(
          new Position(0, 0),
          new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length),
        ),
        formatted,
      ));
      return edit;
    } catch (e: any) {
      if (e.code) {
        const err = populateMessage(e);
        // @ts-ignore
        window.showErrorMessage(`${err.code}: ${err.message}`);
        return undefined;
      }
      // (parser error) don't bubble up as a pot. unhandled thenable promise;
      // explicitly return "no change" instead.
      // show error message
      window.showErrorMessage(`${e.name} (@${e.location.start.line}:${e.location.start.column}): ${e.message}`);
      return undefined;
    }
  }
}
