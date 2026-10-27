import assert from 'node:assert/strict';
import test from 'node:test';

import { renderWhileTyping, writtenSoFar } from '@blog/editor-kit/math/formula-typing.ts';
import { markFormula } from '@blog/editor-kit/math/formula-marks.ts';

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
});

// Drawn as MathLive shows a formula being typed: the caret in the drawing, the part it is in, the empty places.

test('the caret, the part it is in and the empty places are marked for the drawing', () => {
	const caret = '\\htmlClass{pm-math-caret}{}';
	const slot = '\\htmlClass{pm-math-slot}{\\phantom{\\square}}';
	// At the end: the caret.
	assert.equal(markFormula('x^{2}+y', 7), `x^{2}+y${caret}`);
	// In the numerator, between its letters: the numerator shaded, the caret in it.
	assert.equal(markFormula('\\frac{ab}{c}', 7), `\\frac{\\htmlClass{pm-math-here}{a${caret}b}}{c}`);
	// In an empty place: that place shaded, both places boxes (no caret: the box is where it is).
	assert.equal(markFormula('\\frac{}{}', 6), `\\frac{\\htmlClass{pm-math-here}{${slot}}}{${slot}}`);
	// In a command's name: after it.
	assert.equal(markFormula('\\sin x', 3), `\\sin${caret} x`);
});

test('no caret mark where it would be taken as an argument; a word’s braces are not a place', () => {
	assert.equal(markFormula('\\frac', 5), null);
	assert.equal(markFormula('x^', 2), null);
	assert.equal(markFormula('\\sqrt', 5), null);
	assert.equal(markFormula('\\text{ab}', 7)?.includes('pm-math-here'), false);
	assert.equal(markFormula('\\begin{aligned}a&=b\\end{aligned}', 18)?.includes('pm-math-here'), false);
});

test('a formula being typed is drawn with its marks; one that cannot be marked, as it is', () => {
	const drawn = renderWhileTyping({ source: '\\frac{}{}', typed: '\\frac{}{}', caret: 6, display: true, lastGood: null, marks: true });
	assert.equal(drawn.state, 'ok');
	assert.match(drawn.html, /pm-math-here/u);
	assert.equal(drawn.html.match(/class="enclosing pm-math-slot"/gu)?.length, 2);
	const typing = renderWhileTyping({ source: 'a+\\fr', typed: 'a+\\fr', caret: 5, display: false, lastGood: null, marks: true });
	assert.equal(typing.state, 'typing');
	assert.match(typing.html, /pm-math-caret/u);
	// Not marked unless asked: the blog's drawing.
	assert.doesNotMatch(renderWhileTyping({ source: 'x', typed: 'x', caret: 1, display: false, lastGood: null }).html, /pm-math/u);
});
