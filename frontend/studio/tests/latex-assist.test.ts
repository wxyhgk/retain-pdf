import assert from 'node:assert/strict';
import test from 'node:test';

import {
	applyCompletion,
	completeLatex,
	completionQuery,
	deleteBracePair,
	latexCommands,
	nextSlot,
	typeBrace,
} from '../src/studio/editor/latex-assist.ts';

const names = (prefix: string, macros = {}) => completeLatex(prefix, latexCommands(macros)).map((command) => command.name);

test('the command at the caret is what a backslash and letters make', () => {
	assert.deepEqual(completionQuery('x + \\al', 7), { from: 4, to: 7, prefix: 'al' });
	assert.deepEqual(completionQuery('\\al pha', 3), { from: 0, to: 3, prefix: 'al' });
	assert.deepEqual(completionQuery('\\alpha', 3), { from: 0, to: 6, prefix: 'al' }, 'the rest of the word is replaced too');
	assert.equal(completionQuery('a \\\\al', 6), null, 'after \\\\ the letters are text');
	assert.equal(completionQuery('\\', 1), null);
	assert.equal(completionQuery('alpha', 5), null);
});

test('completions: exact first, then this case, then any case, common ones first', () => {
	assert.deepEqual(names('al'), ['\\alpha']);
	assert.equal(names('alpha').length, 0, 'nothing to add to a whole command');
	assert.equal(names('in')[0], '\\in');
	assert.ok(names('in').includes('\\infty'));
	assert.deepEqual(names('Del'), ['\\Delta', '\\delta']);
	assert.deepEqual(names('del').slice(0, 2), ['\\delta', '\\Delta']);
	assert.equal(names('fr')[0], '\\frac');
	assert.deepEqual(names('be').slice(0, 2), ['\\beta', '\\begin{pmatrix}'], 'symbols before the rarer templates');
	assert.equal(names('s')[0], '\\sqrt');
	assert.equal(names('qz').length, 0);
});

test('the article’s macros are offered, with a slot for each argument', () => {
	const macros = { '\\expval': '\\left\\langle #1 \\right\\rangle', '\\dd': '\\mathrm{d}', '\\braket': '\\langle #1 | #2 \\rangle', '\\gdefd': { tokens: [] } };
	const commands = latexCommands(macros);
	assert.equal(commands.find((command) => command.name === '\\expval')?.insert, '\\expval{‸}');
	assert.equal(commands.find((command) => command.name === '\\braket')?.insert, '\\braket{‸}{}');
	assert.equal(commands.find((command) => command.name === '\\dd')?.insert, '\\dd');
	assert.equal(commands.some((command) => command.name === '\\gdefd'), false);
	assert.deepEqual(names('exp', macros), ['\\exp', '\\expval'], 'the exact one, then the article’s own');
});

test('taking a completion writes its template, the caret in the first slot', () => {
	const frac = latexCommands().find((command) => command.name === '\\frac')!;
	assert.deepEqual(applyCompletion('x = \\fr', { from: 4, to: 7 }, frac), { from: 4, to: 7, insert: '\\frac{}{}', caret: 10 });
	const alpha = latexCommands().find((command) => command.name === '\\alpha')!;
	assert.deepEqual(applyCompletion('\\al + 1', { from: 0, to: 3 }, alpha), { from: 0, to: 3, insert: '\\alpha', caret: 6 });
	const dfrac = latexCommands().find((command) => command.name === '\\dfrac')!;
	assert.deepEqual(applyCompletion('\\fr{a}{b}', { from: 0, to: 3 }, dfrac), { from: 0, to: 3, insert: '\\dfrac', caret: 6 }, 'arguments already there');
});

test('braces pair, step over, and go together', () => {
	assert.deepEqual(typeBrace('x^', 2, 2, '{'), { from: 2, to: 2, insert: '{}', caret: 3 });
	assert.deepEqual(typeBrace('x^ab', 2, 4, '{'), { from: 2, to: 4, insert: '{ab}', caret: 6 }, 'around the selection');
	assert.deepEqual(typeBrace('\\', 1, 1, '{'), { from: 1, to: 1, insert: '{\\}', caret: 2 }, '\\{ with \\}');
	assert.deepEqual(typeBrace('x^{2}', 4, 4, '}'), { from: 4, to: 4, insert: '', caret: 5 });
	assert.equal(typeBrace('x^{{2}', 5, 5, '}'), null, 'one missing: typed');
	assert.equal(typeBrace('x^{2', 4, 4, '}'), null);
	assert.deepEqual(deleteBracePair('x^{}', 3, 3), { from: 2, to: 4, insert: '', caret: 2 });
	assert.equal(deleteBracePair('x^{a}', 4, 4), null);
	assert.equal(deleteBracePair('\\{}', 2, 2), null);
});

test('Tab goes into the next braces', () => {
	assert.equal(nextSlot('\\frac{a}{}', 6), 9);
	assert.equal(nextSlot('\\frac{a}{b}', 10), null);
	assert.equal(nextSlot('\\{x\\} + \\hat{a}', 0), 13, 'escaped braces are not slots');
});
