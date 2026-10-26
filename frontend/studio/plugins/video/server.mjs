import { t } from '@blog/i18n/index.mjs';
import { onlineVideo } from './video.mjs';

/**
 * The Studio's dev server: a Bilibili short link (b23.tv, what its app shares) opened to the video
 * it stands for, once, when the link is put in: the blog's build never fetches it.
 * Under /api/studio/plugins/video/:
 *
 *     GET  resolve?url=…   { url }   the video's own address
 */
export const name = 'server-video';
export const inject = ['routes'];

export function apply(ctx) {
	ctx.routes.get('/video/resolve', async ({ query }) => ({ url: await resolveShortLink(query.get('url') ?? '') }));
}

/**
 * Where a b23.tv link leads, followed a few redirects at most and only while they stay short
 * links; the address of a video `onlineVideo` knows.
 * @param {typeof fetch} [fetchPage]
 */
export async function resolveShortLink(address, fetchPage = globalThis.fetch) {
	const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
	let url;
	try {
		url = new URL(address.trim());
	} catch {
		throw fail(t('不是网址'));
	}
	for (let hop = 0; hop < 4 && url.hostname.toLowerCase() === 'b23.tv'; hop += 1) {
		let response;
		try {
			response = await fetchPage(url.href, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
		} catch (error) {
			throw Object.assign(new Error(t('打不开 {url}：{error}', { url: url.href, error: error instanceof Error ? error.message : String(error) })), { statusCode: 502 });
		}
		const location = response.headers.get('location');
		if (!location) throw fail(t('这个短链接没有指向别处'));
		url = new URL(location, url);
	}
	if (!onlineVideo(url.href)) throw fail(t('这个链接打开后不是 B 站的视频：{url}', { url: url.href }));
	return url.href;
}
