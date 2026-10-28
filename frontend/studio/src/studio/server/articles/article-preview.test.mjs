import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewArticle } from './article-preview.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths } from '../../../articles/bundle-paths.mjs';

const PROPERTIES = "---\ntitle: Note\ndescription: ''\npubDate: 2026-10-16\n---\n";

async function blog(t) {
	const blogRoot = await mkdtemp(join(tmpdir(), 'studio-preview-'));
	t.after(() => rm(blogRoot, { recursive: true, force: true }));
	const articles = new ArticleRepository(blogRoot);
	await articles.create({ slug: 'note', title: 'Note' });
	await articles.create({ slug: 'newton', title: '牛顿法' });
	const paths = articleBundlePaths(blogRoot, 'note');
	await writeFile(join(paths.img, 'plot.png'), 'png');
	await writeFile(join(paths.assets, 'search.html'), '<script src="https://cdn.jsdelivr.net/npm/jsxgraph@1.14.2/distrib/jsxgraphcore.js"></script><script>note.file("assets/e.txt")</script>');
	return (source, options) => previewArticle(blogRoot, 'note', source, options);
}

test('each block is said as it shows: page links (a line, in a sentence), figures, formulas, widgets and their files', async (t) => {
	const preview = await blog(t);
	const source = `${PROPERTIES}
## 方法

[牛顿法](/blog/newton/)

参见 [第三章](/blog/newton/) 和 [没有的](/blog/gone/)，还有 $E$ 与 [外链](https://example.com)。

![势能面](./img/plot.png){width=60%}

$$
E = mc^2 \\tag{2}
$$

\`\`\`widget title="搜索" height=600
@file ./assets/search.html
\`\`\`

\`\`\`widget
@file ./assets/missing.html
\`\`\`
`;
	const { blocks, issues, note } = await preview(source);
	assert.deepEqual(blocks.map((block) => block.line), [7, 9, 11, 13, 15, 19, 23]);
	assert.equal(blocks[0].shows, '2 级标题「方法」');
	assert.match(blocks[1].shows, /^单独一行的页面链接.*「牛顿法」→ newton，是草稿/u);
	assert.match(blocks[2].has[0], /^句子里的页面链接.*「第三章」→ newton（标题「牛顿法」），是草稿/u);
	assert.match(blocks[2].has[1], /「没有的」→ gone，没有这篇文章/u);
	assert.deepEqual(blocks[2].has.slice(2), ['外部链接 1 个', '行内公式 1 个']);
	assert.equal(blocks[3].shows, '图 1「势能面」：./img/plot.png，宽 60%，文件在');
	assert.equal(blocks[4].shows, '独立公式，编号 (2)');
	assert.match(blocks[5].shows, /^交互模块「搜索」：一个沙盒框，先占 600px 高/u);
	assert.deepEqual(blocks[5].has.slice(1), ['加载的脚本：https://cdn.jsdelivr.net/npm/jsxgraph@1.14.2/distrib/jsxgraphcore.js', '脚本读的数据：assets/e.txt']);
	assert.match(blocks[6].has[0], /missing\.html 不在/u);
	assert.ok(issues.some((issue) => issue.message.includes('/blog/gone/')));
	assert.match(note, /问作者/u);
});

test('a long page is said in parts, figures numbered from its top', async (t) => {
	const preview = await blog(t);
	const source = `${PROPERTIES}\n![一](./img/plot.png)\n\n${Array.from({ length: 250 }, (_, index) => `第 ${index} 段。`).join('\n\n')}\n\n![二](./img/plot.png)\n`;
	const first = await preview(source);
	assert.equal(first.blocks.length, 200);
	assert.ok(first.next);
	const rest = await preview(source, { from: first.next });
	assert.equal(rest.issues, undefined);
	assert.equal(rest.blocks.at(-1).shows, '图 2「二」：./img/plot.png，文件在');
});
