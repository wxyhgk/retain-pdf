import { t } from '@blog/i18n/index.mjs';
import { isLocalOnly, PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';

/**
 * A video, written in the article as a fence: where it is on its first line,
 * then one `key: value` a line.
 *
 *     ```video
 *     ./assets/run.mp4
 *     cover: ./img/run.jpg
 *     caption: 实验录像
 *     width: 80%
 *     ```
 *
 * A video of the article (`./assets/…`, rules.mjs) stays on the author's
 * machine: the Studio plays it, the blog shows its cover. A link to a video on
 * Bilibili or YouTube is shown by their player, in the Studio and on the blog.
 */

export const VIDEO_LANGUAGE = 'video';

/** The lines after the address, in the order they are written. */
export const VIDEO_FIELDS = /** @type {const} */ (['cover', 'caption', 'width']);

/**
 * @typedef {{ src: string, cover: string, caption: string, width: string }} Video
 * @typedef {{ provider: 'bilibili' | 'youtube', embed: string }} OnlineVideo
 */

/** One line: the whitespace of what is typed (line breaks too) as single spaces. */
const oneLine = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();

/** @returns {Video} */
export function parseVideo(text) {
	const [first = '', ...rest] = String(text ?? '').split('\n');
	/** @type {Video} */
	const video = { src: first.trim(), cover: '', caption: '', width: '' };
	for (const line of rest) {
		const match = /^([a-z]+):\s?(.*)$/u.exec(line);
		if (match && VIDEO_FIELDS.includes(/** @type {never} */ (match[1]))) video[/** @type {keyof Video} */ (match[1])] = match[2].trim();
	}
	return video;
}

/** @param {Partial<Video>} video */
export function writeVideo(video) {
	const lines = [oneLine(video.src)];
	for (const key of VIDEO_FIELDS) {
		const value = oneLine(video[key]);
		if (value) lines.push(`${key}: ${value}`);
	}
	return lines.join('\n');
}

/** A width as figures take it (`80%`, `640px`, `640`); '' for anything else. */
export function videoWidth(text) {
	const value = String(text ?? '').trim();
	if (/^\d+(?:\.\d+)?$/u.test(value)) return `${value}px`;
	return /^\d+(?:\.\d+)?(?:%|px|em|rem)$/u.test(value) ? value : '';
}

/** A file of the article (`./assets/run.mp4` → `assets/run.mp4`) in one of its published folders; null for anything else. */
export function articleFile(text) {
	const path = String(text ?? '').trim().replace(/^\.\//u, '');
	const segments = path.split('/');
	if (segments.length < 2 || !PUBLISHED_FOLDERS.includes(segments[0])) return null;
	if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
	return path;
}

/** The video file of the article a fence plays (`assets/run.mp4`), or null. */
export function localVideo(src) {
	const path = articleFile(src);
	return path && isLocalOnly(path) ? path : null;
}

/** Where the cover of a video of the article is put: `assets/clips/run.mp4` → `img/run.jpg`. */
export function coverFor(videoPath) {
	const name = videoPath.slice(videoPath.lastIndexOf('/') + 1).replace(/\.[^.]+$/u, '');
	return `img/${name || 'video'}.jpg`;
}

/** Seconds, from `90`, `90s`, `1m30s`, `1h2m3s`; 0 for anything else. */
function seconds(text) {
	const value = String(text ?? '').trim();
	if (/^\d+(?:\.\d+)?$/u.test(value)) return Math.floor(Number(value));
	const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/u.exec(value);
	if (!parts || !value) return 0;
	return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
}

/**
 * The player of a video on Bilibili or YouTube, from its address as copied from the browser
 * (`bilibili.com/video/BV…?p=2&t=30`, `youtube.com/watch?v=…&t=90`, `youtu.be/…`, `/shorts/…`);
 * null for any other address. Bilibili's short links (b23.tv) are opened in the Studio first.
 * @returns {OnlineVideo | null}
 */
export function onlineVideo(src) {
	let url;
	try {
		url = new URL(String(src ?? '').trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./u, '');
	const query = url.searchParams;

	if (host === 'bilibili.com' || host === 'player.bilibili.com') {
		const path = /^\/video\/(?:(BV[0-9A-Za-z]{10})|av(\d+))/u.exec(url.pathname);
		const bvid = path?.[1] ?? (host === 'player.bilibili.com' ? query.get('bvid') : null);
		const aid = path?.[2] ?? (host === 'player.bilibili.com' ? query.get('aid') : null);
		const id = bvid && /^BV[0-9A-Za-z]{10}$/u.test(bvid) ? { bvid } : aid && /^\d+$/u.test(aid) ? { aid } : null;
		if (!id) return null;
		const player = new URLSearchParams(id);
		const page = Number(query.get('p') ?? query.get('page'));
		if (Number.isInteger(page) && page > 1) player.set('p', String(page));
		const start = seconds(query.get('t'));
		if (start) player.set('t', String(start));
		// As embedding sites set it (Bilibili documents none of these): not playing by itself, the best
		// quality one may watch, the comments (弹幕) off.
		player.set('autoplay', '0');
		player.set('high_quality', '1');
		player.set('danmaku', '0');
		return { provider: 'bilibili', embed: `https://player.bilibili.com/player.html?${player}` };
	}

	if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
		const path = host === 'youtu.be' ? /^\/([\w-]{11})(?:\/|$)/u.exec(url.pathname) : /^\/(?:embed|shorts|live)\/([\w-]{11})(?:\/|$)/u.exec(url.pathname);
		const id = path?.[1] ?? (url.pathname === '/watch' ? query.get('v') : null);
		if (!id || !/^[\w-]{11}$/u.test(id)) return null;
		const start = seconds(query.get('t') ?? query.get('start'));
		return { provider: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}` };
	}
	return null;
}

/** What is wrong with a fence's address, said to the author; '' when nothing is. */
export function videoProblem(video) {
	if (!video.src) return t('视频还没有选文件或填链接');
	if (onlineVideo(video.src)) return '';
	if (/^https?:\/\/b23\.tv\//iu.test(video.src)) return t('B 站的短链接要先打开成完整链接（在 Studio 里填一次就好）：{src}', { src: video.src });
	if (/^https?:/iu.test(video.src)) return t('只认 B 站和 YouTube 的视频链接：{src}', { src: video.src });
	if (!localVideo(video.src)) return t('视频文件要放在文章的 assets/ 里（mp4、mov、webm…）：{src}', { src: video.src });
	return '';
}

const text = (value) => ({ type: 'text', value });
const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

/**
 * The video, as a HAST tree: the build puts it in the page, the Studio draws it in the editor.
 * A player for a video online; for a video of the article, its cover (the blog: `play` off) or
 * the video itself (the Studio: `play` on). `fileUrl` gives where a file of the article is served.
 *
 * @param {Video} video
 * @param {{ fileUrl: (path: string) => string, play?: boolean }} options
 */
export function videoFigure(video, { fileUrl, play = false }) {
	const width = videoWidth(video.width);
	const online = onlineVideo(video.src);
	const local = online ? null : localVideo(video.src);
	const cover = articleFile(video.cover);
	const caption = video.caption ? [element('figcaption', {}, [text(video.caption)])] : [];
	const properties = {
		className: ['note-video', online ? 'is-online' : 'is-local'],
		...(online ? { dataProvider: online.provider } : {}),
		...(width ? { style: `--figure-width: ${width}` } : {}),
	};
	let inside;
	if (online) {
		// As YouTube's own embed code has it: the player is told which page it is in (the Referer; without
		// it YouTube plays nothing, error 153), and given what it may use.
		inside = element('iframe', {
			src: online.embed,
			title: video.caption || t('视频'),
			loading: 'lazy',
			allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
			referrerPolicy: 'strict-origin-when-cross-origin',
			allowFullScreen: true,
			// The player may not take the page it is in elsewhere.
			sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
		});
	} else if (local && play) {
		inside = element('video', {
			src: fileUrl(local),
			controls: true,
			// With its cover, nothing of it fetched till it is played; without, enough for its first picture.
			preload: cover ? 'none' : 'metadata',
			playsInline: true,
			...(cover ? { poster: fileUrl(cover) } : {}),
		});
	} else if (cover) {
		inside = element('img', { src: fileUrl(cover), alt: video.caption || t('视频的封面'), loading: 'lazy' });
	} else {
		inside = element('div', { className: ['note-video-missing'] }, [text(local ? t('视频（还没有封面）') : t('视频'))]);
	}
	return element('figure', properties, [element('div', { className: ['note-video-frame'] }, [inside]), ...caption]);
}
