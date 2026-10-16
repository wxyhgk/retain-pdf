import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { calloutMarker } from '../src/callouts/callouts.mjs';
import remarkCallouts from '../src/plugins/remark-callouts.mjs';

const render = async (markdown: string) =>
	String(await unified().use(remarkParse).use(remarkCallouts).use(remarkRehype).use(rehypeStringify).process(markdown));

test('the marker names the kind on its own line, in any case', () => {
	assert.deepEqual(calloutMarker('[!TIP]\n先用小基组'), { kind: 'tip', rest: '先用小基组' });
	assert.deepEqual(calloutMarker('[!warning]'), { kind: 'warning', rest: '' });
	assert.equal(calloutMarker('[!TIP] 同一行'), null);
	assert.equal(calloutMarker('[!HINT]\nx'), null);
	assert.equal(calloutMarker('普通引用'), null);
});

test('a blockquote that starts with a marker is a callout: its icon, then what it holds', async () => {
	const html = (await render('> [!TIP]\n> 先用**小基组**跑通。\n>\n> 再换大基组。\n')).replace(/\n/gu, '');
	assert.equal(
		html,
		'<aside class="callout callout-tip" role="note" aria-label="提示"><span class="callout-icon" aria-hidden="true">💡</span><div class="callout-body"><p>先用<strong>小基组</strong>跑通。</p><p>再换大基组。</p></div></aside>',
	);
	assert.match((await render('> [!NOTE]\n>\n> - 一项\n')).replace(/\n/gu, ''), /^<aside class="callout callout-note"[^>]*><span[^>]*>ℹ️<\/span><div class="callout-body"><ul>/u);
	assert.equal(await render('> 只是引用\n'), '<blockquote>\n<p>只是引用</p>\n</blockquote>');
});
