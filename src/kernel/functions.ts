/* eslint-disable prefer-promise-reject-errors */
// eslint-disable-next-line max-classes-per-file
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import fetch from 'node-fetch';
import loadJSON from './loader/json';
import loadXML from './loader/xml';

const jsonata = require('jsonata');

// NEEDED Declaration to silence errors
declare class TextDecoder {
  decode(data: Uint8Array): string;
}

declare class TextEncoder {
  encode(data: string): Uint8Array;
}

export function parseString(content: string, type?: string) {
  if (!type || type === 'json') {
    return loadJSON(content);
  } if (type === 'xml') {
    return loadXML(content);
  }
  return Promise.reject('unknown file handler!');
}

export function readFile(filename: string) {
  if (!vscode.workspace.workspaceFolders) { return Promise.reject('No workspace loaded!'); }
  const folderUri = vscode.workspace.workspaceFolders[0].uri;
  const fileUri = Utils.joinPath(folderUri, filename);

  return vscode.workspace.fs.readFile(fileUri)
    .then((data) => {
      const string = new TextDecoder().decode(data);
      return Promise.resolve(string);
    }) as Promise<string>;
}

export function writeFile(filename: string, content: any) {
  if (!vscode.workspace.workspaceFolders) { return Promise.reject('No workspace loaded!'); }
  const folderUri = vscode.workspace.workspaceFolders[0].uri;
  const fileUri = Utils.joinPath(folderUri, filename);

  const data = JSON.stringify(content, undefined, 2);
  return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(data))
    .then(() => Promise.resolve(undefined)) as Promise<undefined>;
}

export function readUrl(url: string) {
  return fetch(url).then((res) => res.text());
}

export function loadFile(filename: string, type?: string) {
  return readFile(filename)
    .then((content) => parseString(content, type));
}

export function evaluate(content: string, data: unknown, bindings: {[name:string] : unknown}) {
  const jsonataObject = jsonata(content);
  return jsonataObject.evaluate(data, bindings);
}

export function importFile(filename: string, data: unknown, bindings: {[name:string] : unknown}) {
  return readFile(filename)
    .then((content) => evaluate(content, data, bindings));
}

export function loadUrl(filename: string, type?: string) {
  return readUrl(filename).then((content) => parseString(content, type));
}
