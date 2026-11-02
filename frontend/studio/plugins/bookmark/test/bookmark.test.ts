import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { buildBlocks } from '@blog/kernel/testing.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';
import { parseBookmark, webAddress, writeBookmark } from '../bookmark.mjs';
import * as bookmark from '../build.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: await buildBlocks(bookmark) });

async function render(markdown: string) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path: '/blog/note/index.md' }));
	return { html: String(file), messages: file.messages.map((message) => [message.ruleId, message.reason]) };
}

test('a bookmark is its address, then what was read of the page, a line each; written back the same', () => {
	const text = 'https://example.com/paper\ntitle: 一篇论文\ndescription: 讲了 a: b\nimage: https://example.com/c.png\nsite: Example';
	assert.deepEqual(parseBookmark(text), { url: 'https://example.com/paper', title: '一篇论文', description: '讲了 a: b', image: 'https://example.com/c.png', site: 'Example' });
	assert.equal(writeBookmark(parseBookmark(text)), text);
	// Line breaks a page gave become spaces; what is empty is left out; unknown lines are dropped.
	assert.equal(writeBookmark({ url: 'https://a.org', title: '两\n行', description: '' }), 'https://a.org\ntitle: 两 行');
	assert.equal(parseBookmark('https://a.org\nauthor: x').title, '');
});

test('only http(s) addresses are linked or shown', () => {
	assert.equal(webAddress(' https://example.com/a b '), 'https://example.com/a%20b');
	assert.equal(webAddress('javascript:alert(1)'), '');
	assert.equal(webAddress('example.com'), '');
});

test('the blog draws the card from the fence: link, title, description, site, picture', async () => {
	const { html, messages } = await render('```bookmark\nhttps://www.example.com/paper\ntitle: 论文 <一>\ndescription: 简介\nimage: https://example.com/c.png\n```\n');
	assert.deepEqual(messages, []);
	assert.equal(
		html,
		'<figure class="note-bookmark"><a class="note-bookmark-link" href="https://www.example.com/paper" target="_blank" rel="noopener noreferrer">' +
			'<span class="note-bookmark-text"><span class="note-bookmark-title">论文 &#x3C;一></span><span class="note-bookmark-description">简介</span><span class="note-bookmark-site">example.com</span></span>' +
			'<img class="note-bookmark-image" src="https://example.com/c.png" alt="" loading="lazy" referrerpolicy="no-referrer"></a></figure>',
	);
});

test('a bookmark with no web address is drawn unlinked and reported', async () => {
	const { html, messages } = await render('```bookmark\njavascript:alert(1)\nimage: javascript:x\n```\n');
	assert.deepEqual(messages, [['bookmark-url', '网页书签的网址不是 http(s) 开头的：javascript:alert(1)']]);
	assert.doesNotMatch(html, /href=|<img/u);
	assert.match(html, /<div class="note-bookmark-link">/u);
	const empty = await render('```bookmark\n```\n');
	assert.deepEqual(empty.messages, [['bookmark-url', '网页书签还没有填网址']]);
});
