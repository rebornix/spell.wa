'use strict';
import * as vscode from 'vscode';
import { readFile } from './util';
import { Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as path from 'path';

const hunspellASM = require('hunspell-asm');
const Parser = require('web-tree-sitter');


async function init(context) {
	const hunspellFactory = await hunspellASM.loadModule();
	const affBuffer = await readFile(path.resolve(__dirname, '../en.aff'));
	const dicBuffer = await readFile(path.resolve(__dirname, '../en.dic'));
	const affFile = hunspellFactory.mountBuffer(affBuffer, 'en.aff');
	const dictFile = hunspellFactory.mountBuffer(dicBuffer, 'en.dic');

	const hunspell = hunspellFactory.create(affFile, dictFile);

	context.subscriptions.push(() => {
		hunspellFactory.unmount('en.aff');
		hunspellFactory.unmount('en.dic');
	});

	return hunspell;
}

export async function activate(context: vscode.ExtensionContext) {
	let hunspell = await init(context);
	context.subscriptions.push(hunspell);
	const parser = new Parser();
	const Lang = await Parser.Language.load(path.resolve(__dirname, '../tree-sitter-javascript.wasm'));
	parser.setLanguage(Lang);
	const collection = vscode.languages.createDiagnosticCollection('spell');

	var spellDocument = function(document: vscode.TextDocument) {
		if (document.languageId !== 'javascript' && document.languageId !== 'typescript') {
			return;
		}
		const misSpells: vscode.Diagnostic[] = [];

		const tree = parser.parse(document.getText());
		let wordSeparator = new RegExp(/[.=+{}\s*()\[\]_`\\|,@#&!/<>:\-\'\"]+/, 'g');

		var spellCommentNode = function (node) {
			let text = node.text;
			let lines = text.split(/\r\n|\r|\n/g);

			for (let i = 0; i < lines.length; i++) {
				let lineText = lines[i];
				let line = node.startPosition.row + i;
				let columnOffset = i === 0 ? node.startPosition.column : 0;
				let endColumn = i === lines.length - 1 ? node.endPosition.column : lineText.length;

				let m: RegExpExecArray | null;
				let lastCharacter = 0;

				do {
					m = wordSeparator.exec(lineText);
					if (!m) {
						break;
					}
					const matchStartIndex = m.index;
					const matchLength = m[0].length;

					let word = lineText.substring(lastCharacter, matchStartIndex);
					if (word) {
						let misSpell = hunspell.spell(word);
						if (!misSpell) {
							misSpells.push({
								message: `${word} is misspelled`,
								range: new vscode.Range(line, columnOffset + lastCharacter, line, columnOffset + matchStartIndex),
								severity: vscode.DiagnosticSeverity.Warning
							})
							// console.log(word);
						}
					}
					lastCharacter = matchStartIndex + matchLength;
				} while (m)

				if (lastCharacter + columnOffset < endColumn) {
					let word = lineText.substring(lastCharacter, endColumn - columnOffset);

					if (word) {
						let misSpell = hunspell.spell(word);
						if (!misSpell) {
							misSpells.push({
								message: `${word} is misspelled`,
								range: new vscode.Range(line, columnOffset + lastCharacter, line, columnOffset + endColumn),
								severity: vscode.DiagnosticSeverity.Warning
							})
						}
					}
				}
			}
		}

		var traverse = function (node) {
			if (!node) {
				return;
			}

			if (node.type === 'comment' || node.type === 'string') {
				spellCommentNode(node);
				return;
			}

			if (node.children) {
				for (let i = 0; i < node.children.length; i++) {
					traverse(node.children[i]);
				}
			}
		}

		traverse(tree.rootNode);

		collection.set(document.uri, misSpells);
	}

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async e => {
		let editor = e;
		if (!editor) {
			return;
		}

		spellDocument(editor.document);
	}));

	let textDocumentChangeObservable = Observable.create(function (observer) {
		vscode.workspace.onDidChangeTextDocument(e => {
			observer.next(e);
		})
	}).pipe(debounceTime(1000));

	textDocumentChangeObservable.subscribe(function (e) {
		collection.set(e.document.uri, []);
		spellDocument(e.document);
	});

	if (vscode.window.activeTextEditor) {
		spellDocument(vscode.window.activeTextEditor.document);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}