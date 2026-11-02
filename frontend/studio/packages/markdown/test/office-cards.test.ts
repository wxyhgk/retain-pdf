import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { officeFileOf } from '../articles/article-references.mjs';
import { markdownPlugins } from '../pipeline.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins();

test('a link to one of the article’s office files, published with it', () => {
	assert.equal(officeFileOf('./assets/%E7%BB%84%E4%BC%9A.pptx'), 'assets/组会.pptx');
	assert.equal(officeFileOf('img/table.xlsx?v=2'), 'img/table.xlsx');
	assert.equal(officeFileOf('./ai/draft.docx'), null);
	assert.equal(officeFileOf('https://example.com/a.docx'), null);
	assert.equal(officeFileOf('./assets/notes.pdf'), null);
});

/** An article in a folder with these files, rendered as the blog renders it. */
async function render(t: { after: (fn: () => void) => void }, markdown: string, files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), 'office-cards-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const folder = join(root, 'group-meeting');
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, path, '..'), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	mkdirSync(folder, { recursive: true });
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: join(folder, 'index.md') }));
	return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
}

test('a link alone in its paragraph to an office file is a card; other links to the article’s files point where they are published', async (t) => {
	const { html, messages } = await render(
		t,
		[
			'[组会报告](./assets/%E7%BB%84%E4%BC%9A.pptx)',
			'',
			'> [数据.xlsx](assets/data.xlsx)',
			'',
			'见 [组会](./assets/%E7%BB%84%E4%BC%9A.pptx#p2) 和 [日志](./assets/run.log)，还有 [外面](https://example.com/a.docx)。',
			'',
			'- [列表里的](./assets/data.xlsx)',
			'',
			'[旧的](./assets/old.doc)',
			'',
			'[不在了](./assets/gone.docx)',
		].join('\n'),
		{ 'assets/组会.pptx': 'x'.repeat(2048), 'assets/data.xlsx': 'xlsx', 'assets/run.log': 'log', 'assets/old.doc': 'doc' },
	);
	const deck = '/article-assets/group-meeting/assets/%E7%BB%84%E4%BC%9A.pptx';
	assert.ok(html.includes(`<div class="office-card" data-office-kind="slides" data-office-size="2048"><div class="office-card-thumb"></div><div class="office-card-info"><a class="office-card-name" href="${deck}">组会报告</a><span class="office-card-meta"></span></div></div>`), html);
	assert.match(html, /<blockquote>\s*<div class="office-card" data-office-kind="sheet" data-office-size="4">/u);
	// In a sentence: links, marked by what they are (files/file-cards.css); one elsewhere as it was.
	assert.ok(html.includes(`见 <a href="${deck}#p2" class="file-link" data-file-kind="text">组会</a> 和 <a href="/article-assets/group-meeting/assets/run.log" class="file-link" data-file-kind="data">日志</a>，还有 <a href="https://example.com/a.docx">外面</a>。`), html);
	assert.ok(html.includes('<li><a href="/article-assets/group-meeting/assets/data.xlsx" class="file-link" data-file-kind="table">列表里的</a></li>'), html);
	assert.match(html, /<div class="office-card" data-office-kind="old" data-office-size="3">/u);
	assert.match(html, /<div class="office-card" data-office-kind="document"><div class="office-card-thumb">/u);
	assert.deepEqual(messages.filter(([rule]) => rule === 'missing-file'), [['missing-file', '找不到文件 ./assets/gone.docx']]);
});

test('a link alone in its paragraph to another file is a card to download it by: its kind, its size; a list item’s stays a link', async (t) => {
	const { html, messages } = await render(
		t,
		['[论文全文](./assets/paper.pdf)', '', '[opt.py](./assets/opt.py)', '', '- [列表里的](./assets/opt.py)', '', '[没有了](./assets/gone.zip)'].join('\n'),
		{ 'assets/paper.pdf': 'x'.repeat(3000), 'assets/opt.py': 'print(1)\n' },
	);
	assert.ok(html.includes('<div class="file-card" data-file-kind="pdf"><div class="file-card-info"><a class="file-card-name" href="/article-assets/group-meeting/assets/paper.pdf" download="paper.pdf">论文全文</a><span class="file-card-meta">PDF · 2.9 KB</span></div></div>'), html);
	assert.ok(html.includes('<div class="file-card" data-file-kind="code">'), html);
	assert.ok(html.includes('<span class="file-card-meta">代码 · 9 B</span>'), html);
	assert.ok(html.includes('<li><a href="/article-assets/group-meeting/assets/opt.py" class="file-link" data-file-kind="code">列表里的</a></li>'), html);
	assert.ok(html.includes('<span class="file-card-meta">压缩包</span>'), html);
	assert.deepEqual(messages.filter(([rule]) => rule === 'missing-file'), [['missing-file', '找不到文件 ./assets/gone.zip']]);
});
