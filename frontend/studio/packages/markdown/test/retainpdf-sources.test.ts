import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { markdownPlugins } from '../pipeline.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins();

async function render(markdown: string): Promise<string> {
	return String(await unified().use(remarkParse).use(remarkPlugins as never).use(remarkRehype, { allowDangerousHtml: true }).use(rehypePlugins as never).use(rehypeStringify).process(markdown));
}

test('a passage quoted from RetainPDF: no link to it on the page, where it is from said at the end of its paragraph', async () => {
	const html = await render('[量子化学 · 第 12 页](retainpdf:job-1/p012-b0003?page=12) 变分原理告诉我们……\n');
	assert.equal(html.trim(), '<p>变分原理告诉我们…… <cite class="retainpdf-source">量子化学 · 第 12 页</cite></p>');
	assert.doesNotMatch(html, /retainpdf:/u);
});

test('the link on a line of its own (a formula after it): where it stood; other links as they are', async () => {
	const html = await render('[量子化学 · 第 3 页](retainpdf:job-1/p003-b0001?page=3)\n\n[RetainPDF](https://example.com/)\n');
	assert.match(html, /<p><cite class="retainpdf-source">量子化学 · 第 3 页<\/cite><\/p>/u);
	assert.match(html, /<a href="https:\/\/example\.com\/">RetainPDF<\/a>/u);
});
