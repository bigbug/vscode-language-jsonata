# Change Log

All notable changes to the "vscode-language-jsonata" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
- Support Error Diagnostics in JSONata files and notebooks

## [1.0.0]
- Support block comments (#2)
- Update JSONata to 2.0.3
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

## [0.4.0]
- Update JSONata to version 2.0.2

## [0.3.1]
- Fix issue where VS Code does not recognize the mime type `application/json` as notebook renderer anymore

## [0.3.0]

- Support importing XML files in `$loadFile()`
## [0.2.1]

- Better error handling for loading files with `$loadFile()`
## [0.2.0]

- Enable web extension (currently only syntax highlighting works - there is no renderer for the JSON output)
- Code Completion for defined functions and vars

## [0.1.1]

- Add test file
- Extend Readme
## [0.1.0]

- Initial release
- Supports the grammar from try.jsonata.org
- Supports notebooks