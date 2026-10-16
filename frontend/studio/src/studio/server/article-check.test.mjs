import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkArticle } from './article-check.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths } from './bundle-paths.mjs';

const PROPERTIES = "---\ntitle: Note\ndescription: ''\npubDate: 2026-10-16\n---\n";

async function article(t) {
	const blogRoot = await mkdtemp(join(tmpdir(), 'studio-check-'));
	t.after(() => rm(blogRoot, { recursive: true, force: true }));
	await new ArticleRepository(blogRoot).create({ slug: 'note', title: 'Note' });
	const paths = articleBundlePaths(blogRoot, 'note');
	await writeFile(join(paths.img, 'plot.png'), 'png');
	await writeFile(join(paths.assets, 'opt.log'), 'SCF Done\n');
	await writeFile(join(paths.ai, 'notes.md'), 'notes');
	return (source) => checkArticle(blogRoot, 'note', source);
}

test('an article whose files are there and formulas sound has nothing to fix', async (t) => {
	const check = await article(t);
	const source = `${PROPERTIES}
![势能面](./img/plot.png){width=60%}

$$
E = mc^2 \\label{eq:energy}
$$

由 $\\eqref{eq:energy}$ 可知。

\`\`\`output
@file ./assets/opt.log
\`\`\`
`;
	assert.deepEqual(await check(source), []);
});

test('what would break the build comes first, then what the page would show broken, each at its line', async (t) => {
	const check = await article(t);
	const source = `---
title: Note
pubDate: 2026-10-16
---

![缺图](./img/missing.png)

[数据](./assets/data.csv) 和 [笔记](./ai/notes.md)

$$
x \\label{eq:a}
$$

$$
y \\label{eq:a}
$$

见 $\\eqref{eq:none}$，还有 $\\frac{1}{$。

\`\`\`output
@file ./assets/gone.log
\`\`\`
`;
	const issues = await check(source);
	assert.match(issues[6].message, /^公式有错，会显示为红字：/u);
	assert.deepEqual(issues, [
		{ severity: 'error', message: "缺少简介（description）；没有简介也要写 description: ''" },
		{ severity: 'error', message: '找不到图片 ./img/missing.png，博客构建会失败', line: 6 },
		{ severity: 'warning', message: '找不到文件 ./assets/data.csv，页面上的链接会失效', line: 8 },
		{ severity: 'warning', message: './ai/notes.md 不在 img/ 或 assets/ 里，不会随文章发布', line: 8 },
		{ severity: 'warning', message: '公式标签 \\label{eq:a} 用了不止一次，引用的是第一个', line: 14 },
		{ severity: 'warning', message: '找不到公式标签 eq:none：没有公式写 \\label{eq:none}，这里显示为 (??)', line: 18 },
		{ severity: 'warning', message: issues[6].message, line: 18 },
		{ severity: 'warning', message: '找不到文件 ./assets/gone.log，页面上的链接会失效', line: 21 },
	]);
});

test('links to the blog’s own articles must lead somewhere published', async (t) => {
	const blogRoot = await mkdtemp(join(tmpdir(), 'studio-check-links-'));
	t.after(() => rm(blogRoot, { recursive: true, force: true }));
	const repository = new ArticleRepository(blogRoot);
	for (const [slug, extra] of [['note', ''], ['published', ''], ['draft-one', ''], ['wiki-page', 'kind: wiki\n']]) {
		await repository.create({ slug, title: slug });
		await writeFile(articleBundlePaths(blogRoot, slug).markdown, `---\ntitle: ${slug}\ndescription: ''\npubDate: 2026-10-16\n${extra}draft: ${slug === 'draft-one'}\n---\n`);
	}
	const source = `${PROPERTIES}
[好](/blog/published/) [缺](/blog/gone/) [草稿](/blog/draft-one/) [错处](/blog/wiki-page/) [对](/wiki/wiki-page/#eq-1) [外](https://example.com/blog/x/)
`;
	const issues = await checkArticle(blogRoot, 'note', source);
	assert.deepEqual(issues.map((issue) => issue.message), [
		'链接的文章 /blog/gone/ 不存在',
		'链接的文章「draft-one」还是草稿，发布前这个链接打不开',
		'「wiki-page」的网址是 /wiki/wiki-page/，不是 /blog/wiki-page/',
	]);
	assert.ok(issues.every((issue) => issue.severity === 'warning' && issue.line === 7));
});
