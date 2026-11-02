import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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

import * as video from '../build.mjs';
import { coverFor, localVideo, onlineVideo, parseVideo, videoProblem, writeVideo } from '../video.mjs';

const { remarkPlugins, rehypePlugins } = markdownPlugins({ blocks: await buildBlocks(video) });
const render = async (markdown: string, path?: string) => {
	// The pipeline's plugin lists are typed for Astro's options, which unified does not know.
	const file = await unified()
		.use(remarkParse)
		.use(remarkPlugins as never)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypePlugins as never)
		.use(rehypeStringify)
		.process(new VFile({ value: markdown, path }));
	return { html: String(file), messages: file.messages.map((message) => `${message.ruleId}: ${message.reason}`) };
};

/** An article folder of its own, with these files. */
function article(files: Record<string, string> = {}): string {
	const folder = join(mkdtempSync(join(tmpdir(), 'video-')), 'lab-note');
	mkdirSync(folder, { recursive: true });
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(join(folder, path, '..'), { recursive: true });
		writeFileSync(join(folder, path), content);
	}
	return join(folder, 'index.md');
}

test('a fence is its address, then its cover, caption and width, written back as read', () => {
	const read = parseVideo('./assets/run.mp4\ncover: ./img/run.jpg\ncaption: 实验录像\nwidth: 80%\nother: x');
	assert.deepEqual(read, { src: './assets/run.mp4', cover: './img/run.jpg', caption: '实验录像', width: '80%' });
	assert.equal(writeVideo(read), './assets/run.mp4\ncover: ./img/run.jpg\ncaption: 实验录像\nwidth: 80%');
	assert.equal(writeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ', caption: '两行\n说明' }), 'https://youtu.be/dQw4w9WgXcQ\ncaption: 两行 说明');
});

test('links to Bilibili and YouTube, as copied from the browser, become their players', () => {
	const embed = (url: string) => onlineVideo(url)?.embed ?? null;
	assert.equal(embed('https://www.bilibili.com/video/BV1GJ411x7h7/?spm_id_from=333&vd_source=abc'), 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&autoplay=0&high_quality=1&danmaku=0');
	assert.equal(embed('https://www.bilibili.com/video/BV1GJ411x7h7?p=3&t=95.2'), 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&p=3&t=95&autoplay=0&high_quality=1&danmaku=0');
	assert.equal(embed('https://m.bilibili.com/video/av170001'), 'https://player.bilibili.com/player.html?aid=170001&autoplay=0&high_quality=1&danmaku=0');
	assert.equal(embed('https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&page=2'), 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&p=2&autoplay=0&high_quality=1&danmaku=0');
	assert.equal(embed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90');
	assert.equal(embed('https://youtu.be/dQw4w9WgXcQ?t=42'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42');
	assert.equal(embed('https://youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
	assert.equal(onlineVideo('https://www.youtube.com/embed/dQw4w9WgXcQ')?.provider, 'youtube');
	for (const other of ['https://www.bilibili.com/', 'https://b23.tv/abc', 'https://vimeo.com/1', 'https://www.youtube.com/watch?v=short', 'javascript:alert(1)', './assets/run.mp4']) {
		assert.equal(onlineVideo(other), null, other);
	}
});

test('a video of the article is a video file in its assets/ or img/; its cover goes in img/', () => {
	assert.equal(localVideo('./assets/run.mp4'), 'assets/run.mp4');
	assert.equal(localVideo('assets/clips/Run.MOV'), 'assets/clips/Run.MOV');
	assert.equal(localVideo('./assets/run.log'), null);
	assert.equal(localVideo('./ai/run.mp4'), null);
	assert.equal(localVideo('./assets/../run.mp4'), null);
	assert.equal(coverFor('assets/clips/run 1.mp4'), 'img/run 1.jpg');
	assert.equal(videoProblem(parseVideo('')), '视频还没有选文件或填链接');
	assert.match(videoProblem(parseVideo('https://b23.tv/abc')), /短链接/u);
	assert.match(videoProblem(parseVideo('https://vimeo.com/1')), /只认 B 站和 YouTube/u);
	assert.match(videoProblem(parseVideo('/Users/me/run.mp4')), /assets/u);
});

test('on the blog a video online is its player, in a frame that may not take the page', async () => {
	const { html, messages } = await render('```video\nhttps://www.bilibili.com/video/BV1GJ411x7h7\ncaption: 演示\nwidth: 70%\n```\n');
	assert.deepEqual(messages, []);
	assert.match(html, /^<figure class="note-video is-online" data-provider="bilibili" style="--figure-width: 70%"><div class="note-video-frame"><iframe src="https:\/\/player\.bilibili\.com\/player\.html\?bvid=BV1GJ411x7h7&#x26;autoplay=0&#x26;high_quality=1&#x26;danmaku=0" title="演示" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"><\/iframe><\/div><figcaption>演示<\/figcaption><\/figure>$/u);
});

test('on the blog a video of the article is its cover: the video itself is never published', async () => {
	const path = article({ 'img/run.jpg': 'jpeg', 'assets/run.mp4': 'video' });
	const { html, messages } = await render('```video\n./assets/run.mp4\ncover: ./img/run.jpg\ncaption: 实验录像\n```\n', path);
	assert.deepEqual(messages, []);
	assert.equal(html, '<figure class="note-video is-local"><div class="note-video-frame"><img src="/article-assets/lab-note/img/run.jpg" alt="实验录像" loading="lazy"></div><figcaption>实验录像</figcaption></figure>');
	assert.ok(!html.includes('run.mp4'));
});

test('what would be wrong once published is reported: no cover, a cover not there, an address that is no video', async () => {
	const path = article({ 'assets/run.mp4': 'video' });
	const none = await render('```video\n./assets/run.mp4\n```\n', path);
	assert.deepEqual(none.messages, ['video-cover: 视频只在本机，博客上显示它的封面：在 Studio 里点开这个视频做一张封面']);
	assert.match(none.html, /<div class="note-video-missing">视频（还没有封面）<\/div>/u);
	const gone = await render('```video\n./assets/run.mp4\ncover: ./img/gone.jpg\n```\n', path);
	assert.deepEqual(gone.messages, ['video-cover: 找不到视频的封面 ./img/gone.jpg']);
	const other = await render('```video\nhttps://vimeo.com/1\n```\n', path);
	assert.deepEqual(other.messages, ['video-src: 只认 B 站和 YouTube 的视频链接：https://vimeo.com/1']);
	assert.ok(!other.html.includes('iframe'));
});
