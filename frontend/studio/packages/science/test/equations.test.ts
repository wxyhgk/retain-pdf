import assert from 'node:assert/strict';
import test from 'node:test';

import katex from 'katex';

import { numberEquations, prepareFormula, resolveReferences } from '../rendering/equations.mjs';
import { katexOptions, mergeMacros } from '../rendering/katex-options.mjs';

const render = (source: string, displayMode = true) =>
	katex.renderToString(source, { ...katexOptions, output: 'html', displayMode, macros: {} });
const text = (html: string) => html.replace(/<[^>]+>/gu, '').replace(/[\u200b\s]+/gu, '');

test('a formula has the number its source gives it, and no other', () => {
	const { equations } = numberEquations(['a', 'b \\notag', 'c \\tag{3}', 'd \\tag{*}', 'e']);
	assert.deepEqual(
		equations.map((equation) => equation.source),
		['a', 'b \\notag', 'c \\tag{3}', 'd \\tag{*}', 'e'],
	);
	assert.equal(text(render(equations[0].source)), 'a');
});

test('labels name numbers, and references show them as links to the formula', () => {
	const { equations, labels, untagged } = numberEquations(['E = mc^2 \\tag{1} \\label{eq:energy}', 'p = mv \\tag{A} \\label{momentum}', 'q \\label{none}']);
	assert.equal(equations[0].source, 'E = mc^2 \\tag{1} ');
	// A label where there is no number names nothing.
	assert.deepEqual(untagged, [{ key: 'none', index: 2 }]);
	assert.equal(resolveReferences('\\eqref{none}', labels), '\\text{(??)}');
	assert.deepEqual(equations[0].anchors, ['eq-eq:energy']);
	assert.equal(resolveReferences('见 \\eqref{eq:energy} 和 \\ref{eq:energy}', labels), '见 \\href{#eq-eq:energy}{(1)} 和 \\href{#eq-eq:energy}{1}');
	assert.equal(resolveReferences('\\eqref{momentum}', labels), '\\href{#eq-momentum}{(A)}');
	assert.equal(resolveReferences('\\eqref{missing}', labels), '\\text{(??)}');
});

test('in a numbered environment each row has the number it gives, and KaTeX draws it starred, adding none', () => {
	const source = '\\begin{align}\na &= b \\tag{2} \\label{first} \\\\\nc &= d \\\\[2pt]\ne &= \\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix}\n\\end{align}';
	const { equations, labels } = numberEquations(['x', source]);
	assert.equal(
		equations[1].source,
		'\\begin{align*}\na &= b \\tag{2}  \\\\\nc &= d \\\\[2pt]\ne &= \\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix}\n\\end{align*}',
	);
	assert.deepEqual(labels.get('first'), { tag: '(2)', anchor: 'eq-first' });
	assert.equal(text(render(equations[1].source)).match(/\(\d\)/gu)?.join(''), '(2)');
	const equation = numberEquations(['\\begin{equation} a \\\\ b \\label{one} \\end{equation}']);
	assert.equal(equation.equations[0].source, '\\begin{equation*} a \\\\ b  \\end{equation*}');
	assert.doesNotMatch(text(render(equation.equations[0].source)), /\(\d\)/u);
	const alignat = numberEquations(['\\begin{alignat}{2} a &= b \\end{alignat}']).equations[0].source;
	assert.equal(alignat, '\\begin{alignat*}{2} a &= b \\end{alignat*}');
});

test('a formula drawn on its own loses its labels and gets its references, unnumbered', () => {
	const labels = numberEquations(['x \\tag{1} \\label{a}']).labels;
	assert.equal(prepareFormula('\\begin{align} y \\label{b} \\end{align} \\eqref{a}', labels), '\\begin{align*} y  \\end{align*} \\href{#eq-a}{(1)}');
	assert.equal(text(render(prepareFormula('\\eqref{a}', labels), false)), '(1)');
});

test('KaTeX draws the numbers and in-page links, and no other links', () => {
	const { equations, labels } = numberEquations(['E \\tag{1} \\label{e}']);
	assert.match(text(render(equations[0].source)), /E\(1\)/u);
	assert.match(render(resolveReferences('\\eqref{e}', labels)), /href="#eq-e"/u);
	assert.doesNotMatch(render('\\href{https://example.com}{x}'), /href="https/u);
});

test('macros: the site’s, then the article’s, which win, in a fresh object', () => {
	const site = { '\\dd': '\\mathrm{d}' };
	const macros = mergeMacros(site, { Ha: '\\hat{H}', '\\dd': '\\partial' });
	assert.equal(macros['\\Ha'], '\\hat{H}');
	assert.equal(macros['\\dd'], '\\partial');
	assert.equal(mergeMacros(site, null)['\\dd'], '\\mathrm{d}');
	assert.equal(text(katex.renderToString('\\Ha', { ...katexOptions, output: 'html', macros })), 'H^');
	// KaTeX writes \gdef into the object it is given; each article gets its own.
	assert.notEqual(mergeMacros(site, {}), mergeMacros(site, {}));
	assert.deepEqual(site, { '\\dd': '\\mathrm{d}' });
});
