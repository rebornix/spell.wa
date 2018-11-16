'use strict';
import * as vscode from 'vscode';
const hunspellASM = require('hunspell-asm');
const path = require('path');
const unixify = require('unixify');
const monarch = require('node-monarch');

const runHunspell = (hunspellFactory, affPath, dicPath) => {
	const hunspell = hunspellFactory.create(affPath, dicPath);

	hunspell.addWord('github');
	let misSpell = hunspell.spell('github');
	vscode.window.showInformationMessage(`check spell for word 'github': ${misSpell}`);

	misSpell = hunspell.spell('Hello');
	vscode.window.showInformationMessage(`check spell for word 'Hello': ${misSpell}`);

	const suggestion = hunspell.suggest('github');
	vscode.window.showInformationMessage(`spell suggestion for misspelled word 'GitHub': ${suggestion}`);

	hunspell.dispose();
};

async function init(context) {
	const hunspellFactory = await hunspellASM.loadModule();
	const mountedPath = hunspellFactory.mountDirectory(path.resolve('/Users/penlv/Documents/dictionaries'));
	const dictFile = unixify(path.join(mountedPath, 'English.dic'));
	const affFile = unixify(path.join(mountedPath, 'English.aff'));
	const hunspell = hunspellFactory.create(affFile, dictFile);

	context.subscriptions.push(() => {
		hunspellFactory.unmount(mountedPath);
	});

	return hunspell;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "spell-wa" is now active!');

	let hunspell = await init(context);
	context.subscriptions.push(hunspell);
    let disposable = vscode.commands.registerCommand('extension.spell', async () => {
        // The code you place here will be executed every time your command is executed
		// Display a message box to the user
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const collection = vscode.languages.createDiagnosticCollection('spell');
		const misSpells: vscode.Diagnostic[] = [];

		var start: any = new Date()
		let document = editor.document;
		let tokenizer = await monarch.getLanguageSupport('typescript');
		let state = tokenizer.getInitialState();
		let isInSideComment = false;
		let wordSeparator = new RegExp(/[.=+{}\s*()\[,@#&!/<>:\-\'\"]+/, 'g');
		for (let i = 0; i < document.lineCount; i++) {
			let line = document.lineAt(i);
			let ret = tokenizer.tokenize(line.text, state, 0);
			let startIndex;
			if (isInSideComment) {
				startIndex = 0;
			} else {
				startIndex = -1;
			}
			let endIndex = -1;
			for (let j = 0; j < ret.tokens.length; j++) {
				let token = ret.tokens[j];
				if (isInSideComment && token.type.indexOf('comment') < 0) {
					// we are out of a comment
					isInSideComment = false;
					endIndex = token.offset;
				}

				if (!isInSideComment && token.type.indexOf('comment') >= 0) {
					isInSideComment = true;
					startIndex = token.offset;
				}
			}

			if (isInSideComment) {
				endIndex = line.text.length;
			}

			if (startIndex >= 0 && endIndex >= startIndex) {
				// content
				let text = line.text.substring(startIndex, endIndex);
				// console.log(text);
				let m: RegExpExecArray | null;
				let lastCharacter = 0;
				do {
					m = wordSeparator.exec(text);
					if (!m) {
						break;
					}
					const matchStartIndex = m.index;
					const matchLength = m[0].length;

					let word = text.substring(lastCharacter, matchStartIndex);
					if (word) {
						let misSpell = hunspell.spell(word);
						if (!misSpell) {
							misSpells.push({
								message: `${word} is misspelled`,
								range: new vscode.Range(i, startIndex + lastCharacter, i, startIndex + matchStartIndex),
								severity: vscode.DiagnosticSeverity.Warning
							})
							console.log(word);
						}
					}
					lastCharacter = matchStartIndex + matchLength;
				} while(m);

				// let previousNonWordIndex = 0;
				// while(matches) {
				// 	let index =
				// 	matches = wordSeparator.exec(text);
				// }
				// if (matches && matches.length) {
				// 	name = text.substring(haracter, preview.match.end.character + matches.index);
				// }

			}
			state = ret.endState;

			// for (let j = 0; j < words.length; j++) {
			// 	let word = words[j];
			// 	let misSpell = hunspell.spell(word);
			// 	if (!misSpell) {
			// 		console.log(word);
			// 	}
			// }
		}

		var end = <any>(new Date()) - start
		console.info('Execution time: %dms', end)
		collection.set(document.uri, misSpells);
		// hunspell.addWord('github');
		// let misSpell = hunspell.spell('github');
		// vscode.window.showInformationMessage(`check spell for word 'github': ${misSpell}`);
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}