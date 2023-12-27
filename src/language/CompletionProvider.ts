import { uniq } from 'lodash';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionItemProvider, NotebookCell, Position, SnippetString, TextDocument,
} from 'vscode';
import functions from './functions';

export default class CompletionProvider implements CompletionItemProvider {
  // eslint-disable-next-line class-methods-use-this
  provideCompletionItems(
    document: TextDocument,
    position: Position,
    // token: CancellationToken,
    // context: CompletionContext
  ) : CompletionItem[] | undefined {
    const line = document.lineAt(position.line).text.substring(0, position.character);

    const reg = [
      {
        regex: /\$$/,
        // eslint-disable-next-line no-unused-vars
        func: (_a: any) => functions.split(',').map((f) => {
          const item = new CompletionItem(`$${f}()`, CompletionItemKind.Function);
          item.insertText = new SnippetString(`${f}($1)`);
          return item;
        }),
      },
      {
        regex: /\$$/,
        // eslint-disable-next-line no-unused-vars
        func: (_a: any) => {
          let text = document.getText();
          if ((document as any).notebook) {
            const cells : NotebookCell[] = (document as any).notebook.getCells();
            text = cells.map((cell) => cell.document.getText()).join(';\n');
          }
          const matches = [...text.matchAll(/\$(\w+)\s*:=\s*(function\s*\(|λ\s*\()?/g)];

          const functionMatches = uniq(matches.filter((i) => i[2]).map((i) => i[1]));
          const varMatches = uniq(matches.filter((i) => !i[2]).map((i) => i[1]));
          return [
            ...functionMatches.map((f) => {
              const item = new CompletionItem(`$${f}()`, CompletionItemKind.Function);
              item.insertText = new SnippetString(`${f}($1)`);
              return item;
            }),
            ...varMatches.map((f) => {
              const item = new CompletionItem(`$${f}`, CompletionItemKind.Function);
              item.insertText = new SnippetString(f);
              return item;
            }),
          ];
        },
      },
    ];

    let suggestions: CompletionItem[] = [];

    reg.forEach((el) => {
      const result = line.match(el.regex);
      if (result) {
        suggestions = suggestions.concat(el.func(result));
      }
    });

    return suggestions;
  }
}
