import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { markdownPlugins } from '../pipeline.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins();

test('a ```database (the Studio’s table of sub-pages) is left out of the blog, not shown as its settings', async () => {
	const html = String(
		await unified()
			.use(remarkParse)
			.use(remarkPlugins as never)
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(rehypePlugins as never)
			.use(rehypeStringify)
			.process('前一段。\n\n```database\n{ "columns": [], "view": "table" }\n```\n\n后一段。\n'),
	);
	assert.match(html, /前一段。[\s\S]*后一段。/u);
	assert.doesNotMatch(html, /columns|<pre/u);
});
