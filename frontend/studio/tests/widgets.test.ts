import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { rehypePlugins, remarkPlugins } from '../src/plugins/markdown-pipeline.mjs';
import { unpinnedScripts, widgetDocument, widgetOptions } from '../src/widgets/widgets.mjs';

const render = async (markdown: string) => {
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified().use(remarkParse).use(remarkPlugins as never).use(remarkRehype, { allowDangerousHtml: true }).use(rehypePlugins as never).use(rehypeStringify).process(markdown);
	return { html: String(file), messages: file.messages };
};

const WIDGET = '```widget title="Morse 势能" height=300\n<b id="x">hi</b>\n<script>document.querySelector("#x").textContent = "ok"</script>\n```\n';

test('a widget fence becomes a sandboxed frame showing its page, with its title under it', async () => {
	const { html } = await render(WIDGET);
	assert.match(html, /^<figure class="note-widget"><iframe class="note-widget-frame" sandbox="allow-scripts" loading="lazy" title="Morse 势能" style="height:300px" srcdoc="/u);
	assert.match(html, /<\/iframe><figcaption>Morse 势能<\/figcaption><\/figure>$/u);
	assert.ok(!html.includes('data-widget'));
	// The page is all in srcdoc (quoted, so its tags are text there): the script runs in the frame, not in the article.
	const srcdoc = /srcdoc="([^"]*)"/u.exec(html)?.[1] ?? '';
	assert.match(srcdoc, /<script>document\.querySelector\(&#x22;#x&#x22;\)/u);
	assert.ok(!html.replace(srcdoc, '').includes('<script'));
});

test('with other HTML in the article, the widget keeps its page and a hand-written frame gets none', async () => {
	const { html } = await render(`Hi <sup>x</sup>\n\n${WIDGET}\n<iframe srcdoc="<script>alert(1)</script>"></iframe>\n`);
	assert.equal(html.match(/srcdoc=/gu)?.length, 1);
	assert.match(html, /<sup>x<\/sup>/u);
	assert.match(html, /<iframe><\/iframe>/u);
});

test('the frame’s page holds the tokens, the bridge and the source; a whole page keeps its own shape', () => {
	const page = widgetDocument('<p>hi</p>');
	assert.match(page, /^<!doctype html><html><head><meta charset="utf-8">/u);
	assert.match(page, /--ink: #37352f/u);
	assert.match(page, /window\.note = note/u);
	assert.match(page, /<body><p>hi<\/p><\/body><\/html>$/u);
	const whole = widgetDocument('<html lang="zh"><head><title>t</title></head><body>b</body></html>');
	assert.match(whole, /^<html lang="zh"><head><meta charset="utf-8">.*<title>t<\/title>/su);
	assert.equal(whole.match(/<head/gu)?.length, 1);
});

test('fence options', () => {
	assert.deepEqual(widgetOptions('title="势能 面" height=420'), { title: '势能 面', height: 420 });
	assert.deepEqual(widgetOptions(''), { title: '', height: 240 });
	assert.equal(widgetOptions('height=99999').height, 2000);
	assert.equal(widgetOptions('height=abc').height, 240);
});

test('scripts from elsewhere without a version are reported before publishing', async () => {
	assert.deepEqual(
		unpinnedScripts(
			[
				'<script src="https://cdn.jsdelivr.net/npm/plotly.js@2.35.2/dist/plotly.min.js"></script>',
				'<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>',
				'<script src="https://unpkg.com/three"></script>',
				"<script src='//cdn.example.com/lib.js'></script>",
				'<script src="./local.js"></script>',
			].join('\n'),
		),
		['https://unpkg.com/three', '//cdn.example.com/lib.js'],
	);
	const { messages } = await render('```widget\n<script src="https://unpkg.com/three"></script>\n```\n');
	assert.deepEqual(messages.map((message) => message.ruleId), ['widget-script']);
	assert.equal(messages[0].line, 1);
});
