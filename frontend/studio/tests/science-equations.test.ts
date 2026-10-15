import assert from 'node:assert/strict';
import test from 'node:test';

import katex from 'katex';

import { numberEquations, prepareFormula, resolveReferences } from '../src/science/rendering/equations.mjs';
import { katexOptions, macrosFor } from '../src/science/rendering/katex-options.mjs';

const render = (source: string, displayMode = true) =>
	katex.renderToString(source, { ...katexOptions, output: 'html', displayMode, macros: macrosFor({}) });
const text = (html: string) => html.replace(/<[^>]+>/gu, '').replace(/[\u200b\s]+/gu, '');

test('every display formula gets the next number; \\notag, \\nonumber and \\tag opt out', () => {
	const { equations } = numberEquations(['a', 'b \\notag', 'c \\nonumber', 'd \\tag{*}', 'e']);
	assert.deepEqual(
		equations.map((equation) => equation.source),
		['a \\tag{1}', 'b \\notag', 'c \\nonumber', 'd \\tag{*}', 'e \\tag{2}'],
	);
});

test('labels name numbers, and references show them as links to the formula', () => {
	const { equations, labels } = numberEquations(['E = mc^2 \\label{eq:energy}', 'p = mv \\tag{A} \\label{momentum}']);
	assert.equal(equations[0].source, 'E = mc^2 \\tag{1} ');
	assert.deepEqual(equations[0].anchors, ['eq-eq:energy']);
	assert.equal(resolveReferences('见 \\eqref{eq:energy} 和 \\ref{eq:energy}', labels), '见 \\href{#eq-eq:energy}{(1)} 和 \\href{#eq-eq:energy}{1}');
	assert.equal(resolveReferences('\\eqref{momentum}', labels), '\\href{#eq-momentum}{(A)}');
	assert.equal(resolveReferences('\\eqref{missing}', labels), '\\text{(??)}');
});

test('a numbered environment numbers each row, and KaTeX draws it starred', () => {
	const source = '\\begin{align}\na &= b \\label{first} \\\\\nc &= d \\notag \\\\[2pt]\ne &= \\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix}\n\\end{align}';
	const { equations, labels } = numberEquations(['x', source]);
	assert.equal(
		equations[1].source,
		'\\begin{align*}\na &= b \\tag{2}  \\\\\nc &= d \\notag \\\\[2pt]\ne &= \\begin{pmatrix} 1 \\\\ 2 \\end{pmatrix} \\tag{3}\n\\end{align*}',
	);
	assert.deepEqual(labels.get('first'), { tag: '(2)', anchor: 'eq-first' });
	assert.equal(text(render(equations[1].source)).match(/\(\d\)/gu)?.join(''), '(2)(3)');
	const equation = numberEquations(['\\begin{equation} a \\\\ b \\label{one} \\end{equation}']);
	assert.equal(equation.equations[0].source, '\\begin{equation*} a \\\\ b \\tag{1}  \\end{equation*}');
	const alignat = numberEquations(['\\begin{alignat}{2} a &= b \\end{alignat}']).equations[0].source;
	assert.equal(alignat, '\\begin{alignat*}{2} a &= b \\tag{1} \\end{alignat*}');
});

test('a formula drawn on its own loses its labels and gets its references, unnumbered', () => {
	const labels = numberEquations(['x \\label{a}']).labels;
	assert.equal(prepareFormula('\\begin{align} y \\label{b} \\end{align} \\eqref{a}', labels), '\\begin{align*} y  \\end{align*} \\href{#eq-a}{(1)}');
	assert.equal(text(render(prepareFormula('\\eqref{a}', labels), false)), '(1)');
});

test('KaTeX draws the numbers and in-page links, and no other links', () => {
	const { equations, labels } = numberEquations(['E \\label{e}']);
	assert.match(text(render(equations[0].source)), /E\(1\)/u);
	assert.match(render(resolveReferences('\\eqref{e}', labels)), /href="#eq-e"/u);
	assert.doesNotMatch(render('\\href{https://example.com}{x}'), /href="https/u);
});

test('macros: the site’s, then the article’s, which win', () => {
	const macros = macrosFor({ Ha: '\\hat{H}', '\\dd': '\\partial' });
	assert.equal(macros['\\Ha'], '\\hat{H}');
	assert.equal(macros['\\dd'], '\\partial');
	assert.equal(macrosFor(null)['\\dd'], '\\mathrm{d}');
	assert.equal(text(katex.renderToString('\\expval{\\Ha}', { ...katexOptions, output: 'html', macros })), '⟨H^⟩');
	// KaTeX writes \gdef into the object it is given; each article gets its own.
	assert.notEqual(macrosFor({}), macrosFor({}));
});

test('the blog numbers its formula blocks, links references and uses the article’s macros', async () => {
	const { unified } = await import('unified');
	const remarkParse = (await import('remark-parse')).default;
	const remarkMath = (await import('remark-math')).default;
	const remarkRehype = (await import('remark-rehype')).default;
	const rehypeStringify = (await import('rehype-stringify')).default;
	const rehypeKatexMhchem = (await import('../src/plugins/rehype-katex-mhchem.mjs')).default;
	const processor = unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeKatexMhchem).use(rehypeStringify);
	const markdown = '见 $\\eqref{eq:e}$。\n\n$$\nE = \\Ha \\label{eq:e}\n$$\n\n$$\na \\notag\n$$\n\n```math\nb\n```\n';
	const file = await processor.process({ value: markdown, data: { astro: { frontmatter: { macros: { Ha: '\\hat{H}' } } } } });
	const html = String(file);
	assert.match(html, /<span id="eq-eq:e" class="equation-anchor"><\/span>/u);
	assert.match(html, /<a href="#eq-eq:e">/u);
	assert.equal(html.match(/class="katex-tag"/gu)?.length, 2);
	assert.doesNotMatch(html, /katex-error/u);
	// \Ha, the article's macro, drawn as \hat{H}.
	assert.match(html, /<mover accent="true"><mi>H<\/mi>/u);
	assert.equal(file.messages.length, 0);
});
