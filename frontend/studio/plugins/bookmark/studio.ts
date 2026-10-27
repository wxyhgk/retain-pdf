import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';

import { BOOKMARK_LANGUAGE, webAddress, type Bookmark } from './bookmark.mjs';
import cardCss from './bookmark.css?raw';
import { BOOKMARK_TYPE, bookmarkBlockPlugins, bookmarkMarkdown, bookmarkPreview, insertBookmark, setBookmarkHost } from './bookmark-block.ts';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

/** The editor's own parts of the block: the address field, the buttons, the card selected. */
const EDITOR_CSS = `
.bookmark-block { position: relative; margin: 6px 0; }
.bookmark-block .note-bookmark { margin: 0; }
.bookmark-block.ProseMirror-selectednode .note-bookmark-link { border-color: rgb(var(--gray-dark)); }
.bookmark-block-form { display: flex; gap: 8px; padding: 10px 12px; border: 1px dashed rgb(var(--gray-light)); border-radius: 6px; background: var(--surface-soft); }
.bookmark-block-form input { flex: 1 1 auto; min-width: 0; border: 0; outline: 0; background: transparent; color: rgb(var(--gray-dark)); font: inherit; font-size: 14px; }
.bookmark-block button { border: 1px solid rgb(var(--gray-light)); border-radius: 4px; background: var(--surface); color: rgb(var(--gray-dark)); font-size: 12px; padding: 2px 8px; cursor: pointer; }
.bookmark-block button:hover { background: var(--surface-hover); }
.bookmark-block-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 120ms ease; }
.bookmark-block:hover .bookmark-block-actions, .bookmark-block.ProseMirror-selectednode .bookmark-block-actions, .bookmark-block-actions:focus-within { opacity: 1; }
.bookmark-block-reading { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 6px; background: color-mix(in srgb, var(--surface) 70%, transparent); color: rgb(var(--gray)); font-size: 13px; }
`;

/**
 * The Studio: ```bookmark blocks (bookmark-block.ts), in the slash menu as
 * 网页书签; what they show of the page is read by the dev server (server.mjs).
 */
export const name = 'block-bookmark';
export const description = t('网页书签（```bookmark）：贴一个网址或 DOI，显示成带标题、简介和图片的卡片；网页只在 Studio 里读一次，写进文章。');
export const inject = ['studio', 'blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(cardCss + EDITOR_CSS);
	ctx.effect(() => {
		setBookmarkHost({
			preview: async (url) => (await ctx.studio.api.get<{ bookmark: Bookmark }>(`/bookmark/preview?url=${encodeURIComponent(url)}`)).bookmark,
			toast: (message, error) => ctx.studio.toast(message, error),
		});
		return () => setBookmarkHost(null);
	}, 'bookmark host');
	ctx.blocks.register({
		name,
		fence: BOOKMARK_LANGUAGE,
		milkdown: bookmarkBlockPlugins,
		// Where there is no editor (an AI's answer): its card.
		codeBlock: { preview: bookmarkPreview },
		// Any page's address: its card.
		links: { label: t('网页书签'), matches: (url) => Boolean(webAddress(url)), markdown: bookmarkMarkdown, node: BOOKMARK_TYPE },
		menu: {
			key: 'bookmark',
			label: t('网页书签'),
			description: t('网址或 DOI 显示成卡片'),
			icon: ICON,
			keywords: ['bookmark', 'link', 'url', 'web', 'doi', 'shuqian', 'wangye'],
			insert: insertBookmark,
		},
	} satisfies StudioBlock);
}
