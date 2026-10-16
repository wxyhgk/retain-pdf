import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { figureCaption, figureWidth, onlyAttributes, withWidth } from '../src/figures/figures.mjs';
import remarkFigures from '../src/plugins/remark-figures.mjs';

const render = async (markdown: string) =>
	String(await unified().use(remarkParse).use(remarkFigures).use(remarkRehype).use(rehypeStringify).process(markdown));

test('attributes after an image: the width, kept or changed as written', () => {
	assert.equal(onlyAttributes('{width=60%}'), 'width=60%');
	assert.equal(onlyAttributes(' {width=60%}  '), 'width=60%');
	assert.equal(onlyAttributes('{width=60%} 后面还有字'), null);
	assert.equal(figureWidth('width=60%'), '60%');
	assert.equal(figureWidth('width=300'), '300px');
	assert.equal(figureWidth('width="12.5em" #fig:pes'), '12.5em');
	assert.equal(figureWidth('width=wide'), null);
	assert.equal(figureWidth(''), null);
	assert.equal(withWidth('#fig:pes width=60%', '40%'), 'width=40% #fig:pes');
	assert.equal(withWidth('width=60%', null), '');
	assert.equal(withWidth('', '50%'), 'width=50%');
});

test('the alt text is the caption, unless it only names the file or says image', () => {
	assert.equal(figureCaption('水分子的势能面', './img/pes.png'), '水分子的势能面');
	assert.equal(figureCaption('pes', './img/pes.png'), '');
	assert.equal(figureCaption('pes.png', './img/pes.png'), '');
	assert.equal(figureCaption('势能面', './img/%E5%8A%BF%E8%83%BD%E9%9D%A2.png'), '');
	assert.equal(figureCaption('image', './img/a.png'), '');
	assert.equal(figureCaption(' ', './img/a.png'), '');
});

test('an image alone in its paragraph is a figure, numbered when it has a caption', async () => {
	const html = await render([
		'![水分子的势能面](./img/pes.png){width=60%}',
		'![image](./img/a.png)',
		'文字里 ![小图](./img/x.png){width=20} 接着写。',
		'> ![引用里的图](./img/b.png "标题")',
	].join('\n\n'));
	assert.match(html, /<figure class="article-figure" style="--figure-width: 60%"><img src="\.\/img\/pes\.png" alt="水分子的势能面"><figcaption><span class="figure-label">图 1<\/span>水分子的势能面<\/figcaption><\/figure>/u);
	assert.match(html, /<figure class="article-figure"><img src="\.\/img\/a\.png" alt="image"><\/figure>/u, 'no caption, no number');
	assert.match(html, /<p>文字里 <img src="\.\/img\/x\.png" alt="小图" style="width: 20px"> 接着写。<\/p>/u);
	assert.match(html, /<blockquote>\n<figure class="article-figure"><img src="\.\/img\/b\.png" alt="引用里的图" title="标题"><figcaption><span class="figure-label">图 2<\/span>引用里的图<\/figcaption><\/figure>/u);
	assert.doesNotMatch(html, /\{width/u);
});
