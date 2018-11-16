// @ts-check
const hunspellASM = require('hunspell-asm');
const path = require('path');
const unixify = require('unixify');

const runHunspell = (hunspellFactory, affPath, dicPath) => {
	const hunspell = hunspellFactory.create(affPath, dicPath);

	hunspell.addWord('github');
	let misSpell = hunspell.spell('github');
	console.log(`check spell for word 'github': ${misSpell}`);

	misSpell = hunspell.spell('Hello');
	console.log(`check spell for word 'Hello': ${misSpell}`);

	const suggestion = hunspell.suggest('github');
	console.log(`spell suggestion for misspelled word 'GitHub': ${suggestion}`);

	hunspell.dispose();
};

async function init() {
	const hunspellFactory = await hunspellASM.loadModule();
	const mountedPath = hunspellFactory.mountDirectory(path.resolve('/Users/penlv/Documents/dictionaries'));
	const dictFile = unixify(path.join(mountedPath, 'English.dic'));
	const affFile = unixify(path.join(mountedPath, 'English.aff'));

	runHunspell(hunspellFactory, affFile, dictFile);
	hunspellFactory.unmount(mountedPath);
}

init();
