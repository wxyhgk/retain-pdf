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

import { buildBlocks } from '@blog/kernel/testing.mjs';
import { markdownPlugins } from '@blog/markdown/pipeline.mjs';

import * as widget from '../build.mjs';
import { publicArticlePath, unpinnedScripts, widgetDocument, widgetFile, widgetOptions, widgetReads } from '../widgets.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: await buildBlocks(widget) });
const render = async (markdown: string, path?: string) => {
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path }));
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
	const page = widgetDocument('<p>hi</p>', { ink: '#37352f', muted: 'rgb(120, 119, 116)' });
	assert.match(page, /^<!doctype html><html><head><meta charset="utf-8">/u);
	assert.match(page, /:root \{ --ink: #37352f; --muted: rgb\(120, 119, 116\); \}/u);
	assert.match(page, /window\.note = note/u);
	assert.match(page, /<body><p>hi<\/p><\/body><\/html>$/u);
	const whole = widgetDocument('<html lang="zh"><head><title>t</title></head><body>b</body></html>');
	assert.match(whole, /^<html lang="zh"><head><meta charset="utf-8">.*<title>t<\/title>/su);
	assert.equal(whole.match(/<head/gu)?.length, 1);
});

test('what the frame is given: whether there is an AI to ask, what it told before; none on the blog', () => {
	assert.doesNotMatch(widgetDocument('<p>hi</p>'), /__noteGiven = /u);
	const given = widgetDocument('<p>hi</p>', {}, { canAsk: true, state: { a: 7, note: '</script><b>' } });
	assert.match(given, /window\.__noteGiven = \{"canAsk":true,"state":\{"a":7,"note":"\\u003c\/script>\\u003cb>"\}\};<\/script><script>/u);
	// Given before the bridge reads it.
	assert.ok(given.indexOf('__noteGiven =') < given.indexOf('window.note = note'));
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

/** An article folder with these files, removed after the test. */
function articleWith(t: { after: (fn: () => void) => void }, files: Record<string, string>): string {
	const folder = mkdtempSync(join(tmpdir(), 'widget-article-'));
	t.after(() => rmSync(folder, { recursive: true, force: true }));
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(folder, path, '..'), { recursive: true });
		writeFileSync(join(folder, path), text);
	}
	return join(folder, 'index.md');
}

test('a widget that is a file of the article is read in at build time', async (t) => {
	const index = articleWith(t, { 'assets/plot.html': '<p>来自文件</p><script>note.file("assets/opt.log")</script>', 'assets/opt.log': 'SCF Done' });
	const { html, messages } = await render('```widget title="图"\n@file ./assets/plot.html\n```\n', index);
	const srcdoc = /srcdoc="([^"]*)"/u.exec(html)?.[1] ?? '';
	assert.match(srcdoc, /<body><p>来自文件<\/p><script>note\.file/u);
	assert.deepEqual(messages, []);
});

test('a widget file that is not there, or a read of what is not published, is reported', async (t) => {
	const index = articleWith(t, { 'assets/reads.html': '<script>note.file("assets/gone.log"); note.file("ai/notes.md")</script>' });
	const missing = await render('```widget\n@file ./assets/nowhere.html\n```\n', index);
	assert.match(/srcdoc="([^"]*)"/u.exec(missing.html)?.[1] ?? '', /找不到交互模块文件 \.\/assets\/nowhere\.html/u);
	assert.deepEqual(missing.messages.map((message) => message.ruleId), ['missing-file']);

	const reads = await render('```widget\n@file ./assets/reads.html\n```\n', index);
	assert.deepEqual(
		reads.messages.map((message) => [message.ruleId, message.reason]),
		[
			['widget-file', '交互模块读的 ./assets/gone.log 不存在'],
			['widget-file', '交互模块读的 ai/notes.md 不在页面的 img/ 或 assets/ 里，发布后读不到'],
		],
	);
});

test('which paths a widget may be and read', () => {
	assert.equal(widgetFile('@file ./assets/plot.html'), 'assets/plot.html');
	assert.equal(widgetFile('  @file assets/plot.html  \n'), 'assets/plot.html');
	assert.equal(widgetFile('<p>@file ./assets/plot.html</p>'), null);
	assert.equal(publicArticlePath('./assets/a/b.log'), 'assets/a/b.log');
	assert.equal(publicArticlePath('img/plot.png'), 'img/plot.png');
	assert.equal(publicArticlePath('ai/notes.md'), null);
	assert.equal(publicArticlePath('assets/../index.md'), null);
	assert.equal(publicArticlePath('../other/assets/x.log'), null);
	assert.equal(publicArticlePath('https://example.com/assets/x.log'), null);
	assert.deepEqual(widgetReads(`note.file('assets/a.log'); note.file("img/b.png"); note.file(\`assets/c.txt\`); note.file(name)`), ['assets/a.log', 'img/b.png', 'assets/c.txt']);
});
