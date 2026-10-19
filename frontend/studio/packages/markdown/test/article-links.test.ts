import assert from 'node:assert/strict';
import test from 'node:test';

import { findArticleLinks } from '../articles/article-links.mjs';

const source = [
	'---',
	'title: 链接',
	'---',
	'',
	'先读 [Hartree–Fock](/blog/hartree-fock-start/) 再看 [维基](/wiki/basis-sets/#sto-3g)。',
	'',
	'- 列表里 [全称](https://wxyhgk.github.io/blog/dft-intro/)',
	'- 外面的 [网站](https://example.com/blog/dft-intro/) 和 [文件](./assets/a.cube)',
	'',
	'`[代码](/blog/in-code/)`',
	'',
	'```md',
	'[块里](/blog/in-block/)',
	'```',
	'',
	'见[定义][hf]。',
	'',
	'[hf]: /blog/hartree-fock-start/',
].join('\n');

test('the links to the blog’s articles, where they are and the words around them', () => {
	assert.deepEqual(
		findArticleLinks(source, { site: 'https://wxyhgk.github.io' }).map(({ section, slug, line, text, context }) => ({ section, slug, line, text, context })),
		[
			{ section: 'blog', slug: 'hartree-fock-start', line: 5, text: 'Hartree–Fock', context: '先读 Hartree–Fock 再看 维基。' },
			{ section: 'wiki', slug: 'basis-sets', line: 5, text: '维基', context: '先读 Hartree–Fock 再看 维基。' },
			{ section: 'blog', slug: 'dft-intro', line: 7, text: '全称', context: '列表里 全称' },
			{ section: 'blog', slug: 'hartree-fock-start', line: 18, text: '', context: '' },
		],
	);
});

test('a link written in full counts only with the blog’s address', () => {
	assert.deepEqual(findArticleLinks(source).map((link) => link.slug), ['hartree-fock-start', 'basis-sets', 'hartree-fock-start']);
});

test('a long paragraph is cut around the link', () => {
	const long = `${'前'.repeat(200)}[链接](/blog/target/)${'后'.repeat(200)}`;
	const [{ context }] = findArticleLinks(long);
	assert.ok(context.startsWith('…') && context.endsWith('…'), context);
	assert.ok(context.includes('链接'));
	assert.ok(context.length <= 115, String(context.length));
	assert.equal(findArticleLinks(`短的[链接](/blog/target/)${'后'.repeat(300)}`)[0].context.slice(0, 4), '短的链接');
});
