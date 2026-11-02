import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { buildBlocks } from '@blog/kernel/testing.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';

import * as chemistry from '../build.mjs';

const render = async (markdown: string, blocks: unknown) => {
	const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: blocks as never });
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified().use(remarkParse).use(remarkPlugins as never).use(remarkRehype).use(rehypePlugins as never).use(rehypeStringify).process(markdown);
	return String(file);
};

test('chemistry fences are the plugin’s: left as code for the page to draw, not taken for code files', async () => {
	const blocks = await buildBlocks(chemistry);
	assert.ok(blocks.fences().includes('smiles') && blocks.fences().includes('cube'));
	assert.match(await render('```smiles\nCCO\n```\n', blocks), /^<pre><code class="language-smiles">CCO\n<\/code><\/pre>$/u);
	// A structure file of the article stays the block that names it (the page reads it); not a code file's figure.
	assert.match(await render('```xyz\n@file ./assets/water.xyz\n```\n', blocks), /<pre><code class="language-xyz">@file .\/assets\/water.xyz/u);
});
