import assert from 'node:assert/strict';
import test from 'node:test';

import katex from 'katex';

import { katexOptions } from '@blog/science/rendering/katex-options.mjs';
import { macrosFor } from '../src/math-macros.mjs';

const text = (html: string) => html.replace(/<[^>]+>/gu, '').replace(/[\u200b\s]+/gu, '');

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
	const rehypeKatexMhchem = (await import('@blog/markdown/plugins/rehype-katex-mhchem.mjs')).default;
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
