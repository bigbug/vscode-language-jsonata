# vscode-language-jsonata

This extension brings the JSONata query engine to Visual Studio Code.

## Features

This extension enables JSONata language support to Visual Studio Code. The extension is activated for files with the *.jsonata extension.

We also support JSONata Notebooks. They are automatically activated for files with the *.jsonata-book extension. Within notebooks data can be loaded with `$loadFile("path/to/file.json")` (Attention! `$loadFile()<s:o>` is an async function and therefore returns `undefined`!). The source file for the data has to be a JSON file (probably will be extended in the future). The files will be loaded from the root folder of the first workspace.

`$loadFile($file[, $type])` takes up to two arguments. `$file` represents the filename to be loaded. With the optional argument `$type` one can specify how this file should be loaded. At the moment only json and xml can be chosen whereas json is the standard if `$type` is missing.

Each code cell of the notebook can access the result of the most recent executed cell by using `$ans`.

A good documentation for the JSONata language can be found [here](https://docs.jsonata.org/overview.html).

<img width="1114" alt="Screenshot 2022-02-20 at 18 19 28" src="https://user-images.githubusercontent.com/27259/154855371-6e394968-0def-4d1d-bc56-6992f2b95dc9.png">

## Requirements

None

## Extension Settings

None

## Known Issues

`$loadFile()` is an async function and therefore returns `undefined`

## Release Notes

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
