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

import { fileSize, officeFileOf, officeKind, tableSource } from '../src/office/office-kinds.mjs';
import { rehypePlugins, remarkPlugins } from '../src/plugins/markdown-pipeline.mjs';

test('office files by extension, and the article’s office file a link points at', () => {
	assert.equal(officeKind('assets/组会.PPTX'), 'slides');
	assert.equal(officeKind('a/b.docx'), 'document');
	assert.equal(officeKind('data.xls'), 'sheet');
	assert.equal(officeKind('old.doc'), 'old');
	assert.equal(officeKind('notes.pdf'), null);
	assert.equal(officeFileOf('./assets/%E7%BB%84%E4%BC%9A.pptx'), 'assets/组会.pptx');
	assert.equal(officeFileOf('img/table.xlsx?v=2'), 'img/table.xlsx');
	assert.equal(officeFileOf('./ai/draft.docx'), null);
	assert.equal(officeFileOf('https://example.com/a.docx'), null);
	assert.equal(officeFileOf('./assets/notes.pdf'), null);
	assert.deepEqual(tableSource('a.tsv'), { sheet: false, delimiter: '\t' });
	assert.deepEqual(tableSource('a.ods'), { sheet: true, delimiter: ',' });
	assert.equal(fileSize(512), '512 B');
	assert.equal(fileSize(5734), '5.6 KB');
	assert.equal(fileSize(1399422), '1.3 MB');
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
	assert.ok(html.includes(`见 <a href="${deck}#p2">组会</a> 和 <a href="/article-assets/group-meeting/assets/run.log">日志</a>，还有 <a href="https://example.com/a.docx">外面</a>。`), html);
	assert.ok(html.includes('<li><a href="/article-assets/group-meeting/assets/data.xlsx">列表里的</a></li>'), html);
	assert.match(html, /<div class="office-card" data-office-kind="old" data-office-size="3">/u);
	assert.match(html, /<div class="office-card" data-office-kind="document"><div class="office-card-thumb">/u);
	assert.deepEqual(messages.filter(([rule]) => rule === 'missing-file'), [['missing-file', '找不到文件 ./assets/gone.docx']]);
});
