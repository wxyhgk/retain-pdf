import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { markdownPlugins } from '../pipeline.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins({});

async function render(markdown: string) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: '/blog/note/index.md' }));
	return { html: String(file), messages: file.messages.map((message) => message.ruleId) };
}

test('a display formula that can be broken into lines has them drawn, hidden, after it; its number in both', async () => {
	const { html, messages } = await render('$$\na = b + c = d + e = f \\tag{1}\n$$\n\n$$\nE = mc^2 \\tag{2}\n$$\n');
	assert.deepEqual(messages, []);
	const displays = html.match(/<span class="katex-display[^"]*"[^>]*>/gu) ?? [];
	assert.deepEqual(displays, ['<span class="katex-display">', '<span class="katex-display katex-broken" hidden>', '<span class="katex-display">']);
	assert.equal(html.match(/\(1\)/gu)?.length, 2);
	assert.equal(html.match(/\(2\)/gu)?.length, 1);
});

test('a formula with a mistake is reported once, and has no lines drawn', async () => {
	const { html, messages } = await render('$$\na = \\frac{b = c = d\n$$\n');
	assert.deepEqual(messages, ['formula']);
	assert.doesNotMatch(html, /katex-broken/u);
});
