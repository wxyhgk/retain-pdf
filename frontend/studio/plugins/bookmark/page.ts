import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/page.ts';

import './bookmark.css';

/**
 * The blog's pages: the cards build.mjs drew are styled (bookmark.css); a
 * picture the site no longer gives is taken away, not shown broken.
 */
export const name = 'page-bookmark';
export const inject = ['page'];

export function apply(ctx: Context): void {
	ctx.on('page/ready', () => {
		for (const image of document.querySelectorAll<HTMLImageElement>('figure.note-bookmark img.note-bookmark-image')) {
			if (image.complete && image.naturalWidth === 0) image.remove();
			else image.addEventListener('error', () => image.remove(), { once: true });
		}
	});
}
