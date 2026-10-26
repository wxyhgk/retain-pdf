import { t } from '@blog/i18n/index.mjs';
import { BOOKMARK_LANGUAGE, bookmarkCard, parseBookmark, webAddress } from './bookmark.mjs';

/**
 * The blog's build: a ```bookmark fence becomes its card (bookmark.mjs),
 * drawn from what the fence says; the page is not fetched.
 *
 * Reported for the check before publishing: a bookmark with no http(s)
 * address (`bookmark-url`).
 */
export const name = 'block-bookmark';
export const inject = ['blocks'];

export function apply(ctx) {
	ctx.blocks.register({ name, fence: BOOKMARK_LANGUAGE, remark: bookmarkFigure });
}

export function bookmarkFigure(node, file) {
	const bookmark = parseBookmark(node.value);
	if (!webAddress(bookmark.url)) {
		file.message(bookmark.url ? t('网页书签的网址不是 http(s) 开头的：{url}', { url: bookmark.url }) : t('网页书签还没有填网址'), { place: node.position, source: name, ruleId: 'bookmark-url' });
	}
	const card = bookmarkCard(bookmark);
	return { type: 'bookmark', data: { hName: card.tagName, hProperties: card.properties, hChildren: card.children } };
}
