import { t } from '@blog/i18n/index.mjs';
import { hostOf, webAddress } from './bookmark.mjs';

/**
 * What a bookmark shows of a page, read once by the dev server: the page's
 * title, description, picture and site, from its `<meta>` (Open Graph,
 * Twitter, plain) and `<title>`. A DOI (doi.org/10.…) is asked of doi.org
 * instead, which gives the paper's title, authors, journal and year:
 * publishers' pages often turn programs away.
 */

export class PreviewError extends Error {
	constructor(message, statusCode = 502) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** Read no more of a page than this: what is wanted is in its head. */
const MOST = 768 * 1024;

const DOI = /^https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/\S+)$/iu;

/**
 * @param {string} address
 * @param {typeof fetch} [fetchPage]
 * @returns {Promise<import('./bookmark.mjs').Bookmark>}
 */
export async function previewPage(address, fetchPage = globalThis.fetch) {
	const url = webAddress(address);
	if (!url) throw new PreviewError(t('网址要以 http:// 或 https:// 开头'), 400);
	const doi = DOI.exec(url);
	if (doi) return { url, ...(await previewDoi(decodeURIComponent(doi[1]), fetchPage)) };
	let response;
	try {
		response = await fetchPage(url, {
			headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; blog-studio bookmark)' },
			redirect: 'follow',
			signal: AbortSignal.timeout(12_000),
		});
	} catch {
		throw new PreviewError(t('连不上 {host}，检查一下网络', { host: hostOf(url) }));
	}
	if (!response.ok) throw new PreviewError(t('{host} 没有给出这个页面（{status}）', { host: hostOf(url), status: response.status }));
	const type = response.headers.get('content-type') ?? '';
	if (type && !/html|xml/iu.test(type)) return { url, title: '', description: '', image: '', site: hostOf(url) };
	const html = await readHead(response, type);
	return { url, ...describePage(html, response.url || url) };
}

/** The start of the page as text, in the charset it says it is in (UTF-8 if none). */
async function readHead(response, type) {
	const reader = response.body?.getReader();
	const chunks = [];
	let size = 0;
	if (reader) {
		while (size < MOST) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			size += value.length;
		}
		void reader.cancel().catch(() => {});
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk.subarray(0, Math.min(chunk.length, size - at)), at);
		at += chunk.length;
	}
	const ascii = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
	const charset = /charset=["']?([\w-]+)/iu.exec(type)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/iu.exec(ascii)?.[1] ?? 'utf-8';
	try {
		return new TextDecoder(charset).decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (whole, name) => {
		if (name[0] === '#') {
			const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
		}
		return ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/** A tag's attributes, names in lower case. */
function attributes(tag) {
	const found = {};
	for (const match of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gu)) {
		found[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? '');
	}
	return found;
}

/**
 * What a page's HTML says of itself; `base` is where it was read from, for
 * a picture given relative to it.
 */
export function describePage(html, base) {
	const head = html.split(/<\/head>/iu)[0] ?? html;
	const meta = new Map();
	for (const [tag] of head.matchAll(/<meta\b[^>]*>/giu)) {
		const attrs = attributes(tag);
		const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
		if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content.trim());
	}
	const first = (...keys) => keys.map((key) => meta.get(key)).find(Boolean) ?? '';
	const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(head)?.[1];
	const title = first('og:title', 'twitter:title', 'citation_title', 'dc.title') || (titleTag ? decodeEntities(titleTag) : '');
	let image = first('og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src');
	try {
		image = image ? webAddress(new URL(image, base).href) : '';
	} catch {
		image = '';
	}
	const clean = (text) => text.replace(/\s+/gu, ' ').trim();
	return {
		title: clean(title),
		description: clean(first('og:description', 'twitter:description', 'description', 'dc.description')),
		image,
		site: clean(first('og:site_name', 'citation_journal_title', 'application-name')) || hostOf(base),
	};
}

/** A paper by its DOI, as doi.org gives it (CSL JSON). */
async function previewDoi(doi, fetchPage) {
	let response;
	try {
		response = await fetchPage(`https://doi.org/${encodeURI(doi)}`, {
			headers: { Accept: 'application/vnd.citationstyles.csl+json' },
			redirect: 'follow',
			signal: AbortSignal.timeout(15_000),
		});
	} catch {
		throw new PreviewError(t('连不上 doi.org，检查一下网络'));
	}
	if (response.status === 404) throw new PreviewError(t('doi.org 上没有 {doi}', { doi }), 404);
	if (!response.ok) throw new PreviewError(t('doi.org 没有给出这篇的信息（{status}）', { status: response.status }));
	let paper;
	try {
		paper = await response.json();
	} catch {
		throw new PreviewError(t('doi.org 给的不是论文信息'));
	}
	const text = (value) => (Array.isArray(value) ? value[0] : value) ?? '';
	const authors = (paper.author ?? []).map((author) => author.family ?? author.literal ?? '').filter(Boolean);
	const byline = authors.length > 2 ? `${authors[0]} 等` : authors.join('、'); // i18n-ignore: written into the article
	const year = paper.issued?.['date-parts']?.[0]?.[0] ?? '';
	const journal = String(text(paper['container-title-short']) || text(paper['container-title']));
	const strip = (value) => String(value).replace(/<[^>]+>/gu, '').replace(/\s+/gu, ' ').trim();
	return {
		title: strip(text(paper.title)),
		description: [byline, [journal, year].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
		image: '',
		site: journal || 'doi.org',
	};
}
