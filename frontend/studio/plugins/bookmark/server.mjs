import { previewPage } from './preview.mjs';

/**
 * The Studio's dev server: what a bookmark shows of a page, read when the
 * bookmark is made (or read again), so the blog's build never fetches it.
 * Under /api/studio/plugins/bookmark/:
 *
 *     GET  preview?url=…   { bookmark: { url, title, description, image, site } }
 */
export const name = 'server-bookmark';
export const inject = ['routes'];

export function apply(ctx) {
	ctx.routes.get('/bookmark/preview', async ({ query }) => ({ bookmark: await previewPage(query.get('url') ?? '') }));
}
