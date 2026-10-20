/**
 * A web bookmark, written in the article as a fence: the address on its
 * first line, then what the Studio read of the page, one `key: value` a line.
 *
 *     ```bookmark
 *     https://example.com/paper
 *     title: 一篇论文
 *     description: 它讲了什么
 *     image: https://example.com/cover.png
 *     site: Example
 *     ```
 *
 * The blog draws it as a card from that alone: it never fetches the page.
 */

export const BOOKMARK_LANGUAGE = 'bookmark';

/** The lines after the address, in the order they are written. */
export const BOOKMARK_FIELDS = /** @type {const} */ (['title', 'description', 'image', 'site']);

/**
 * @typedef {{ url: string, title: string, description: string, image: string, site: string }} Bookmark
 */

/** An address a page may link to or show: http or https only; '' for anything else. */
export function webAddress(text) {
	const trimmed = String(text ?? '').trim();
	if (!/^https?:\/\//iu.test(trimmed)) return '';
	try {
		return new URL(trimmed).href;
	} catch {
		return '';
	}
}

/** The site an address is on, as it is read: `pubs.acs.org`, without `www.`. */
export function hostOf(url) {
	try {
		return new URL(url).hostname.replace(/^www\./u, '');
	} catch {
		return '';
	}
}

/** One line: the whitespace of what a page gave (line breaks too) as single spaces. */
const oneLine = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();

/** @returns {Bookmark} */
export function parseBookmark(text) {
	const [first = '', ...rest] = String(text ?? '').split('\n');
	/** @type {Bookmark} */
	const bookmark = { url: first.trim(), title: '', description: '', image: '', site: '' };
	for (const line of rest) {
		const match = /^([a-z]+):\s?(.*)$/u.exec(line);
		if (match && BOOKMARK_FIELDS.includes(/** @type {never} */ (match[1]))) bookmark[/** @type {keyof Bookmark} */ (match[1])] = match[2].trim();
	}
	return bookmark;
}

/** @param {Partial<Bookmark>} bookmark */
export function writeBookmark(bookmark) {
	const lines = [oneLine(bookmark.url)];
	for (const key of BOOKMARK_FIELDS) {
		const value = oneLine(bookmark[key]);
		if (value) lines.push(`${key}: ${value}`);
	}
	return lines.join('\n');
}

/**
 * The card, as a HAST tree: the build puts it in the page, the Studio draws
 * it in the editor. A link to the page, its title (the address when there is
 * none), what it says of itself, its site, its picture on the right.
 *
 * @param {Bookmark} bookmark
 */
export function bookmarkCard(bookmark) {
	const url = webAddress(bookmark.url);
	const image = webAddress(bookmark.image);
	const text = (value) => ({ type: 'text', value });
	const span = (name, value) => ({ type: 'element', tagName: 'span', properties: { className: [`note-bookmark-${name}`] }, children: [text(value)] });
	const words = [span('title', bookmark.title || bookmark.url || '网页书签')];
	if (bookmark.description) words.push(span('description', bookmark.description));
	words.push(span('site', bookmark.site || hostOf(url)));
	const children = [{ type: 'element', tagName: 'span', properties: { className: ['note-bookmark-text'] }, children: words }];
	// No referrer: the site is not told which page showed its picture.
	if (image) children.push({ type: 'element', tagName: 'img', properties: { className: ['note-bookmark-image'], src: image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }, children: [] });
	const link = url
		? { type: 'element', tagName: 'a', properties: { className: ['note-bookmark-link'], href: url, target: '_blank', rel: ['noopener', 'noreferrer'] }, children }
		: { type: 'element', tagName: 'div', properties: { className: ['note-bookmark-link'] }, children };
	return { type: 'element', tagName: 'figure', properties: { className: ['note-bookmark'] }, children: [link] };
}
