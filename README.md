# vscode-language-jsonata

This extension brings the JSONata query engine to Visual Studio Code.

## Features

This extension enables JSONata language support to Visual Studio Code. The extension is activated for files with the *.jsonata extension.

We also support JSONata Notebooks. They are automatically activated for files with the *.jsonata-book extension.

Within notebooks several additional functions are available:

- `$parseString($content[, $type])` takes up to two arguments. It parses `$content` into an JSON object. This happens based on the variable `$type` with a JSON or an XML parser. JSON is the default parser.
- `$loadFile($file[, $type])` takes up to two arguments. `$file` represents the filename to be loaded. With the optional argument `$type` one can specify how this file should be loaded. At the moment only `json` and `xml` can be chosen whereas json is the standard if `$type` is missing.
- `$loadUrl($url[, $type])` works just like `$loadFile()` but with URLs instead of files.

- `$readFile($file)` reads a file and returns the result as a string.
- `$writeFile($file, $content)` writes the data of `$content` into the file `$file`. The content can be an object and is stringified as a JSON string. The indentation is set to `2`.
- `$readUrl($url)` reads a url and returns the result as a string.

- `$eval($content)` evaluates a string using the JSONata compiler.
- `$import($file)` imports a file and evaluates it. This is useful for defining often used functions in a separate file and then include it in a notebook. If several functions shall be imported from a single file, then export them as a object. This could look like this:
```json
{
  $hello := function() {
    "hello"
  };
  $world := function() {
    "world"
  }
}
```
In the notebook you can then use this use this code:
```json
(
  $api = $import("test.jsonata");
  $api.hello();
  $api.world()
)
```


Each code cell of the notebook can access the result of the most recent executed cell by using `$ans`.

A good documentation for the JSONata language can be found [here](https://docs.jsonata.org/overview.html).

<img width="1114" alt="Screenshot 2022-02-20 at 18 19 28" src="https://user-images.githubusercontent.com/27259/154855371-6e394968-0def-4d1d-bc56-6992f2b95dc9.png">

## Requirements

None

## Extension Settings

None

## Known Issues

- None

## Release Notes

## 1.0.0
- Support block comments (#2)
- Fix parsing string quotes (#5)
- Change of evaluation behavior (Promises are evaluated during JSONata evaluation)
- Implement new functions:
    - $parseString()
    - $loadUrl()
    - $readFile()
    - $readUrl()
    - $eval()
    - $import()
    - $writeFile()

## 0.4.0
- Update JSONata to version 2.0.2

## 0.3.1
- Fix issue where VS Code does not recognize the mime type `application/json` as notebook renderer anymore

## 0.3.0

- Support importing XML files in `$loadFile()<ss?:o>`

## 0.2.1

- Better error handling for loading files with `$loadFile()`

## 0.2.0

- Enable web extension (currently only syntax highlighting works - there is no renderer for the JSON output)
- Code Completion for defined functions and vars

### 0.1.0

- Initial release
- Supports the grammar from try.jsonata.org
- Supports notebooks
