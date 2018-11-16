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
	const mountedPath = hunspellFactory.mountDirectory(path.resolve('C:\\Users\\penlv\\Documents\\Dictionary'));
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
	const collection = vscode.languages.createDiagnosticCollection('spell');
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async e => {
		let editor = e;
		if (!editor) {
			return;
		}

		const misSpells: vscode.Diagnostic[] = [];

		var start: any = new Date()
		let document = editor.document;
		let tokenizer;
		try {
			tokenizer = await monarch.getLanguageSupport(document.languageId);
		} catch (e) {}
		if(!tokenizer) {
			return;
		}
		let state = tokenizer.getInitialState();
		let isInSideComment = false;
		let wordSeparator = new RegExp(/[.=+{}\s*()\[\]_`\\|,@#&!/<>:\-\'\"]+/, 'g');
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
							// console.log(word);
						}
					}
					lastCharacter = matchStartIndex + matchLength;
				} while(m);
			}
			state = ret.endState;
		}

		var end = <any>(new Date()) - start
		console.info('Execution time: %dms', end)
		collection.set(document.uri, misSpells);
	}));
}

// this method is called when your extension is deactivated
export function deactivate() {
}