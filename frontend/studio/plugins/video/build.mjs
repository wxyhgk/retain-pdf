import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { t } from '@blog/i18n/index.mjs';
import { articleFile, localVideo, parseVideo, VIDEO_LANGUAGE, videoFigure, videoProblem } from './video.mjs';

/**
 * The blog's build: a ```video fence becomes its figure (video.mjs). A video
 * on Bilibili or YouTube is their player; a video of the article stays on the
 * author's machine, and the page shows its cover.
 *
 * Reported for the check before publishing: an address that is no video
 * (`video-src`), and a video of the article without its cover (`video-cover`).
 */
export const name = 'block-video';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: VIDEO_LANGUAGE, remark: videoBlock });
}

export function videoBlock(node, file) {
	const video = parseVideo(node.value);
	const report = (message, ruleId) => file.message(message, { place: node.position, source: name, ruleId });
	const problem = videoProblem(video);
	if (problem) report(problem, 'video-src');
	const article = file.path ? dirname(file.path) : null;
	const slug = article ? basename(article) : '';
	const cover = articleFile(video.cover);
	if (localVideo(video.src) && !problem) {
		if (!cover) report(t('视频只在本机，博客上显示它的封面：在 Studio 里点开这个视频做一张封面'), 'video-cover');
		else if (article && !existsSync(join(article, ...cover.split('/')))) report(t('找不到视频的封面 ./{cover}', { cover }), 'video-cover');
	}
	const fileUrl = (path) => `/article-assets/${encodeURIComponent(slug)}/${path.split('/').map(encodeURIComponent).join('/')}`;
	const figure = videoFigure(video, { fileUrl });
	return { type: 'video', data: { hName: figure.tagName, hProperties: figure.properties, hChildren: figure.children } };
}
