import assert from 'node:assert/strict';
import test from 'node:test';

import { renderWhileTyping, writtenSoFar } from '../src/studio/editor/formula-typing.ts';

test('what is still being typed is set aside, and what is open is closed', () => {
	assert.equal(writtenSoFar('x + \\', 5), 'x + ');
	assert.equal(writtenSoFar('x + \\si', 7), 'x + ');
	assert.equal(writtenSoFar('\\si + y', 3), ' + y', 'the command at the caret, wherever it is');
	assert.equal(writtenSoFar('\\sin + y', 2), ' + y', 'the whole word the caret is in');
	assert.equal(writtenSoFar('x^', 2), 'x');
	assert.equal(writtenSoFar('x_ ', 3), 'x');
	assert.equal(writtenSoFar('\\frac{a}{b', 10), '\\frac{a}{b}');
	assert.equal(writtenSoFar('\\left( x', 8), '\\left( x \\right.');
	assert.equal(writtenSoFar('\\begin{pmatrix} a & b', 21), '\\begin{pmatrix} a & b\\end{pmatrix}');
	assert.equal(writtenSoFar('a \\\\', 4), null, '\\\\ is a line break, written');
	assert.equal(writtenSoFar('\\{ x', 4), null, 'an escaped brace opens nothing');
	assert.equal(writtenSoFar('x + 1', 5), null);
});

test('a formula being typed is drawn as far as it is written, or as it last was', () => {
	const typing = (source: string, caret = source.length, lastGood: string | null = null) =>
		renderWhileTyping({ source, typed: source, caret, display: false, lastGood });
	assert.equal(typing('x + 1').state, 'ok');
	const command = typing('x + \\si');
	assert.equal(command.state, 'typing');
	assert.equal(command.error, undefined);
	assert.doesNotMatch(command.html, /katex-error/u);
	assert.deepEqual(typing('\\'), { html: '', state: 'typing' });
	assert.equal(typing('\\frac{a}{', 9).state, 'typing');
	// A mistake away from the caret: the last good drawing, and what is wrong.
	const stale = typing('\\fra{a} + x', 11, '<span>good</span>');
	assert.equal(stale.state, 'stale');
	assert.equal(stale.html, '<span>good</span>');
	assert.match(stale.error ?? '', /\\fra/u);
	assert.equal(typing('\\fra{a} + x', 11).state, 'error', 'nothing good to show yet');
	// The number goes back on what is written so far.
	const numbered = renderWhileTyping({
		source: 'x + \\si \\tag{3}',
		typed: 'x + \\si',
		caret: 7,
		display: true,
		lastGood: null,
		decorate: (written) => `${written} \\tag{3}`,
	});
	assert.equal(numbered.state, 'typing');
	assert.match(numbered.html, /\(3\)/u);
});
