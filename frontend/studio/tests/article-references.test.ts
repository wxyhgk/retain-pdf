import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { moleculeViewKey } from '../src/science/view-key.mjs';
import {
	articlePath,
	findArticleReferences,
	isReferenced,
	movedPath,
	referencedPaths,
	rewriteMovedReferences,
} from '../src/studio/shared/article-references.mjs';

const article = [
	'---',
	'title: 引用',
	'heroImage: "./img/cover.png"',
	'---',
	'',
	'图 ![结构](./img/a.png "说明") 与 [数据](assets/run/out.log#L3)。',
	'',
	'[![缩略图](./img/thumb.png)](./img/full.png)',
	'',
	'参考 [定义][fig]。',
	'',
	'[fig]: ./img/def.png',
	'',
	'<img src="./img/html.png" alt="x"> <a href=\'./assets/table.csv\'>表</a>',
	'',
	'```cube',
	'@file ./assets/orbital.cube',
	'```',
	'',
	'> ```xyz',
	'> @file ./assets/quoted.xyz',
	'> ```',
	'',
].join('\n');

test('finds every way an article points at its files', () => {
	assert.deepEqual(
		findArticleReferences(article).map(({ kind, path, raw }) => `${kind} ${path} ${raw}`),
		[
			'frontmatter img/cover.png ./img/cover.png',
			'image img/a.png ./img/a.png',
			'link assets/run/out.log assets/run/out.log',
			'image img/thumb.png ./img/thumb.png',
			'link img/full.png ./img/full.png',
			'definition img/def.png ./img/def.png',
			'html img/html.png ./img/html.png',
			'html assets/table.csv ./assets/table.csv',
			'file assets/orbital.cube ./assets/orbital.cube',
			'file assets/quoted.xyz ./assets/quoted.xyz',
		],
	);
	for (const reference of findArticleReferences(article)) {
		assert.equal(article.slice(reference.start, reference.end), reference.raw);
	}
});

test('what is not one of the article\'s files is left out', () => {
	const source = [
		'[网站](https://example.com/a.png) [站内](/blog/x/) [锚点](#top) [邮件](mailto:a@b.c) [上级](../other/a.png)',
		'',
		'`![代码](./img/code.png)` 和 $\\text{](./img/math.png)}$',
		'',
		'```markdown',
		'![示例](./img/example.png)',
		'```',
		'',
		'```text',
		'@file ./assets/doc-example.cube',
		'more text',
		'```',
		'',
		'    @file ./assets/indented.cube',
	].join('\n');
	assert.deepEqual(findArticleReferences(source), []);
});

test('paths are read the way the browser resolves them', () => {
	assert.equal(articlePath('./img/a.png'), 'img/a.png');
	assert.equal(articlePath('img//a.png?v=2#x'), 'img/a.png');
	assert.equal(articlePath('./img/%E5%9B%BE%201.png'), 'img/图 1.png');
	assert.equal(articlePath('./img/../assets/x.cube'), 'assets/x.cube');
	assert.equal(articlePath('../x.png'), null);
	assert.equal(articlePath('./'), null);
	assert.equal(articlePath('data:image/png;base64,AAAA'), null);
});

test('a folder counts as referenced through anything inside it', () => {
	const referenced = referencedPaths(article);
	assert.ok(isReferenced(referenced, 'assets/run'));
	assert.ok(isReferenced(referenced, 'img/a.png'));
	assert.ok(!isReferenced(referenced, 'img/unused.png'));
	assert.ok(!isReferenced(referenced, 'img/a'));
	assert.equal(movedPath('img/a.png', 'img', 'pictures'), 'pictures/a.png');
	assert.equal(movedPath('img2/a.png', 'img', 'pictures'), null);
});

test('renaming a file changes only its path, written as before', () => {
	const result = rewriteMovedReferences(article, 'img/a.png', 'img/结构-1.png');
	assert.equal(result.changed, 1);
	assert.equal(result.source, article.replace('](./img/a.png "说明")', '](./img/结构-1.png "说明")'));

	const plain = rewriteMovedReferences(article, 'assets/run/out.log', 'assets/run/final.log');
	assert.match(plain.source, /\[数据\]\(assets\/run\/final\.log#L3\)/u);

	const chemistry = rewriteMovedReferences(article, 'assets/quoted.xyz', 'assets/water.xyz');
	assert.match(chemistry.source, /> @file \.\/assets\/water\.xyz\n/u);
});

test('renaming a folder moves every reference inside it', () => {
	const result = rewriteMovedReferences(article, 'img', 'assets/figures');
	assert.equal(result.changed, 6);
	assert.deepEqual(
		findArticleReferences(result.source).map((reference) => reference.path).filter((path) => path.startsWith('img/')),
		[],
	);
	assert.match(result.source, /heroImage: "\.\/assets\/figures\/cover\.png"/u);
	assert.match(result.source, /\[!\[缩略图\]\(\.\/assets\/figures\/thumb\.png\)\]\(\.\/assets\/figures\/full\.png\)/u);
});

test('percent-encoded and CRLF sources keep their style', () => {
	const source = '﻿---\r\ntitle: x\r\n---\r\n![图](./img/%E5%9B%BE.png)\r\n<img src=\'./img/b.png\'>\r\n';
	const result = rewriteMovedReferences(source, 'img/图.png', 'img/新图.png');
	assert.equal(result.source, '﻿---\r\ntitle: x\r\n---\r\n![图](./img/%E6%96%B0%E5%9B%BE.png)\r\n<img src=\'./img/b.png\'>\r\n');
	const html = rewriteMovedReferences(source, 'img/b.png', 'img/c.png');
	assert.match(html.source, /<img src='\.\/img\/c\.png'>/u);
});

test('a name a bare link cannot hold is encoded', () => {
	const result = rewriteMovedReferences('![a](./img/a.png)\n', 'img/a.png', 'img/my plot (1).png');
	assert.equal(result.source, '![a](./img/my%20plot%20(1).png)\n');
	assert.deepEqual([...referencedPaths(result.source)], ['img/my plot (1).png']);
});

test('saved 3D views are keyed by the @file path as written', async () => {
	const views = JSON.parse(await readFile(new URL('../blog/chemistry-rendering/article.views.json', import.meta.url), 'utf8'));
	assert.equal(views.molecules[moleculeViewKey('cube', './assets/s0_homo.cube')]?.format, 'cube');
});
