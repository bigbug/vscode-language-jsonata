# vscode-language-jsonata

This extension brings the JSONata query engine to Visual Studio Code.

## Features

This extension enables JSONata language support to Visual Studio Code. The extension is activated for files with the *.jsonata extension.
We also support JSONata Notebooks. They are automatically activated for files with the *.jsonata-book extension. Within notebooks data can be loaded with `$loadFile("path/to/file.json")`. The source file for the data has to be a JSON file (probably will be extended in the future). The files will also be loaded from the root folder of the first workspace.
A good documentation for the JSONata language can be found [here](https://docs.jsonata.org/overview.html).

<img width="1114" alt="Screenshot 2022-02-20 at 18 19 28" src="https://user-images.githubusercontent.com/27259/154855371-6e394968-0def-4d1d-bc56-6992f2b95dc9.png">

## Requirements

None

## Extension Settings

None

## Known Issues

Lack of errors if file loading fails.

## Release Notes


### 0.1.0

- Initial release
- Supports the grammar from try.jsonata.org
- Supports notebooks
