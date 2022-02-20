import { uniq } from "lodash";
import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, Position, Range, SnippetString, TextDocument } from "vscode";
import functions from "./functions";

export default class CompletionProvider implements CompletionItemProvider{
    provideCompletionItems(
        document: TextDocument,
        position: Position,
        //token: CancellationToken,
        //context: CompletionContext
    )  : CompletionItem[] | undefined {
        const line = document.lineAt(position.line).text.substring(0, position.character);

        const reg = [
            {
                regex: /\$$/,
                func: (a: any) => {
                    return functions.split(",").map(f => {
                        const item = new CompletionItem("$"+f+"()", CompletionItemKind.Function);
                        item.insertText=new SnippetString(f + "($1)");
                        return item;
                    });
                }
            },
            {
                regex: /\$$/,
                func: (a: any) => {
                    let matches = [...document.getText().matchAll(/\$(\w+)\s*:= (function\(|λ\()?/g)];

                    let functionMatches = uniq(matches.filter(i=>i[2]).map(i=>i[1]));
                    let varMatches = uniq(matches.filter(i=>!i[2]).map(i=>i[1]));
                    return [
                        ...functionMatches.map(f => {
                            const item = new CompletionItem("$"+f+"()", CompletionItemKind.Function);
                            item.insertText=new SnippetString(f + "($1)");
                            return item;
                        }),
                        ...varMatches.map(f => {
                            const item = new CompletionItem("$"+f, CompletionItemKind.Function);
                            item.insertText=new SnippetString(f);
                            return item;
                        })
                    ];
                }
            }
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