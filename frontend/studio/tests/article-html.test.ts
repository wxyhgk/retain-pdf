import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import rehypeArticleHtml from '../src/plugins/rehype-article-html.mjs';

function render(markdown: string): string {
	return String(
		unified()
			.use(remarkParse)
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypeArticleHtml)
			.use(rehypeStringify, { allowDangerousHtml: true })
			.processSync(markdown),
	);
}

test('scripts, event handlers and javascript: links are removed', () => {
	const html = render('<div class="note" onclick="alert(1)"><a href="javascript:alert(2)">坏</a><a href="https://example.com">好</a></div>\n\n<script>alert(3)</script>\n\n<img src="x.png" onerror="alert(4)">');
	assert.doesNotMatch(html, /onclick|onerror|javascript:|alert\(3\)|<script/);
	assert.match(html, /<div class="note">/);
	assert.match(html, /href="https:\/\/example.com"/);
	assert.match(html, /<img src="x.png">/);
});

test('inline tags that Markdown splits close around their text', () => {
	assert.match(render('上标 <sup>2</sup> 与 <span style="color: red">红字</span>'), /<sup>2<\/sup> 与 <span style="color: red">红字<\/span>/);
	assert.match(render('<details><summary>展开</summary>内容</details>'), /<details><summary>展开<\/summary>内容<\/details>/);
});

test('an article without HTML is left as it was', () => {
	const markdown = '# 标题\n\n段落 *强调* 与 `code`。';
	const plain = String(unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).processSync(markdown));
	assert.equal(render(markdown), plain);
});
