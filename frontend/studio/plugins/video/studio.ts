import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { LOCAL_ONLY_EXTENSIONS } from '@blog/markdown/articles/rules.mjs';
import { VIDEO_LANGUAGE } from './video.mjs';
import videoCss from './video.css?raw';
import { insertVideo, setVideoHost, VIDEO_TYPE, videoBlockPlugins, videoMarkdown } from './video-block.ts';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3z"/></svg>';

/** The editor's own parts of the block: the link field, the buttons, the caption, what is being done. */
const EDITOR_CSS = `
.video-block { position: relative; margin: 6px 0; }
.video-block .note-video { position: relative; margin: 0 auto; }
.video-block.ProseMirror-selectednode .note-video-frame { outline: 2px solid rgb(var(--gray-dark)); outline-offset: 2px; }
.video-block-form { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px dashed rgb(var(--gray-light)); border-radius: 6px; background: var(--surface-soft); }
.video-block-form input[type="url"] { flex: 1 1 auto; min-width: 0; border: 0; outline: 0; background: transparent; color: rgb(var(--gray-dark)); font: inherit; font-size: 14px; }
.video-block button { flex: none; border: 1px solid rgb(var(--gray-light)); border-radius: 4px; background: var(--surface); color: rgb(var(--gray-dark)); font-size: 12px; padding: 2px 8px; cursor: pointer; }
.video-block button:hover { background: var(--surface-hover); }
.video-block-actions { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 120ms ease; }
.video-block:hover .video-block-actions, .video-block.ProseMirror-selectednode .video-block-actions, .video-block-actions:focus-within { opacity: 1; }
.video-block-note { padding: 1px 7px; border-radius: 4px; background: rgb(0 0 0 / 60%); color: #fff; font-size: 12px; line-height: 20px; }
.video-block-caption { display: block; width: 100%; margin-top: 6px; padding: 0 2px; border: 0; border-radius: 4px; outline: none; background: transparent; color: rgb(var(--gray)); font: inherit; font-size: 0.9em; line-height: 1.5; text-align: center; }
.video-block-caption:focus { background: var(--surface-soft); }
.video-block-caption::placeholder { color: rgb(var(--gray)); opacity: 0.6; }
.video-block:not(:hover):not(.ProseMirror-selectednode) .video-block-caption:placeholder-shown:not(:focus) { visibility: hidden; }
.video-block-busy { position: absolute; top: 8px; left: 8px; padding: 1px 8px; border-radius: 4px; background: rgb(0 0 0 / 60%); color: #fff; font-size: 12px; line-height: 20px; }
.video-block-busy.is-alone { position: static; display: block; padding: 10px 12px; border: 1px dashed rgb(var(--gray-light)); background: var(--surface-soft); color: rgb(var(--gray)); font-size: 14px; }
.video-block-missing { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(0 0 0 / 70%); color: #fff; font-size: 13px; text-align: center; }
`;

/**
 * The Studio: ```video blocks (video-block.ts), in the slash menu as 视频; a
 * video file dropped into the article becomes one. Bilibili's short links are
 * opened by the dev server (server.mjs).
 */
export const name = 'block-video';
export const description = '视频（```video）：B 站或 YouTube 的链接显示成它们的播放器；本机的视频放在文章的 assets/ 里（不进 git），Studio 里能放，博客上显示它的封面。';
export const inject = ['studio', 'blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(videoCss + EDITOR_CSS);
	ctx.effect(() => {
		const shown = () => {
			const slug = ctx.studio.shown();
			if (!slug) throw new Error('没有打开文章');
			return slug;
		};
		setVideoHost({
			fileUrl: (path) => {
				const slug = ctx.studio.shown();
				return slug ? ctx.studio.fileUrl(slug, path) : path;
			},
			upload: async (folder, file, options) => (await ctx.studio.upload(shown(), folder, file, options)).path,
			resolve: async (url) => (await ctx.studio.api.get<{ url: string }>(`/video/resolve?url=${encodeURIComponent(url)}`)).url,
			toast: (message, error) => ctx.studio.toast(message, error),
		});
		return () => setVideoHost(null);
	}, 'video host');
	ctx.blocks.register({
		name,
		fence: VIDEO_LANGUAGE,
		milkdown: videoBlockPlugins,
		drawnWhole: [VIDEO_TYPE],
		files: { extensions: [...LOCAL_ONLY_EXTENSIONS], icon: '▶', markdown: videoMarkdown },
		menu: {
			key: 'video',
			label: '视频',
			icon: ICON,
			keywords: ['video', 'movie', 'bilibili', 'youtube', 'mp4', 'shipin', 'sp'],
			insert: insertVideo,
		},
	} satisfies StudioBlock);
}
