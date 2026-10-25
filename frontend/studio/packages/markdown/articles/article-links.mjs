import { visitParents } from 'unist-util-visit-parents';

import { parseArticle } from '../syntax.mjs';
import { ARTICLE_ADDRESS } from './rules.mjs';

/** Blocks a link is read in, for the words around it. */
const BLOCKS = new Set(['paragraph', 'heading', 'tableCell', 'listItem', 'blockquote']);
/** Words kept around a link: about this many on the page. */
const CONTEXT = 110;

/**
 * @typedef {object} ArticleLink
 * @property {string} url as written
 * @property {'blog' | 'wiki'} section the address it is under
 * @property {string} slug the article linked
 * @property {number | undefined} line where it is in `source`
 * @property {string} text the link's own words (empty for a `[label]: url` definition)
 * @property {string} context the words of the sentence or line it is in, shortened around it
 */

/**
 * The links in an article to the blog's articles: `[标题](/blog/<slug>/)`,
 * `/wiki/<slug>/#eq-1`, and with `site` (the blog's own address) the same
 * written in full, `https://…/blog/<slug>/` (bare too). What is in code or a
 * formula is not a link.
 * @param {string} source
 * @param {{ site?: string }} [options]
 * @returns {ArticleLink[]}
 */
export function findArticleLinks(source, { site } = {}) {
	const origin = site ? new URL(site).origin : null;
	const links = [];
	visitParents(parseArticle(source), (node, ancestors) => {
		if ((node.type !== 'link' && node.type !== 'definition') || typeof node.url !== 'string') return;
		const address = origin && node.url.startsWith(`${origin}/`) ? node.url.slice(origin.length) : node.url;
		const match = ARTICLE_ADDRESS.exec(address);
		if (!match) return;
		const text = node.type === 'link' ? plainText(node) : '';
		const block = node.type === 'link' ? ancestors.findLast((ancestor) => BLOCKS.has(ancestor.type)) : undefined;
		links.push({
			url: node.url,
			section: match[1],
			slug: match[2],
			line: node.position?.start.line,
			text,
			context: block ? around(block, node) : '',
		});
	});
	return links;
}

/**
 * `source` with its links to the article `from` pointing at `to` instead
 * (its folder renamed): the address alone changes, its `#…` kept, every other
 * byte as it was. With `site`, links written in full too. How many changed.
 * @param {string} source
 * @param {string} from
 * @param {string} to
 * @param {{ site?: string }} [options]
 * @returns {{ source: string, changed: number }}
 */
export function relinkArticle(source, from, to, { site } = {}) {
	const origin = site ? new URL(site).origin : null;
	const spans = [];
	visitParents(parseArticle(source), (node) => {
		if ((node.type !== 'link' && node.type !== 'definition') || typeof node.url !== 'string') return;
		const address = origin && node.url.startsWith(`${origin}/`) ? node.url.slice(origin.length) : node.url;
		const match = ARTICLE_ADDRESS.exec(address);
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (match?.[2] !== from || start == null || end == null) return;
		spans.push({ start, end, section: match[1] });
	});
	let next = source;
	let changed = 0;
	// From the last, so that the places of those before stay.
	for (const { start, end, section } of spans.sort((a, b) => b.start - a.start)) {
		const written = next.slice(start, end);
		// The address in the link's text: `/blog/<from>` not followed by more of a folder name.
		const pattern = new RegExp(`/${section}/${from}(?![a-z0-9-])`, 'u');
		if (!pattern.test(written)) continue;
		next = `${next.slice(0, start)}${written.replace(pattern, `/${section}/${to}`)}${next.slice(end)}`;
		changed += 1;
	}
	return { source: next, changed };
}

/** What Markdown would read as something else in a link's text, with a backslash before it. */
const SPECIAL = /[\\`*_[\]<>$~|]/gu;

/**
 * `source` with its links to the article `slug` whose words are its title as
 * it was, `from`, in its title as it is, `to` (it was renamed, as Notion's
 * links to a page follow it). A link given words of its own is left as it is,
 * and so is one whose words are not plain text. How many changed.
 * @param {string} source
 * @param {string} slug
 * @param {string} from
 * @param {string} to
 * @param {{ site?: string }} [options]
 * @returns {{ source: string, changed: number }}
 */
export function retitleArticleLinks(source, slug, from, to, { site } = {}) {
	const origin = site ? new URL(site).origin : null;
	const spans = [];
	visitParents(parseArticle(source), (node) => {
		if (node.type !== 'link' || typeof node.url !== 'string') return;
		const address = origin && node.url.startsWith(`${origin}/`) ? node.url.slice(origin.length) : node.url;
		if (ARTICLE_ADDRESS.exec(address)?.[2] !== slug) return;
		const [words, ...more] = node.children ?? [];
		if (more.length || words?.type !== 'text' || words.value !== from) return;
		const start = words.position?.start.offset;
		const end = words.position?.end.offset;
		if (start != null && end != null) spans.push({ start, end });
	});
	let next = source;
	// From the last, so that the places of those before stay.
	for (const { start, end } of spans.sort((a, b) => b.start - a.start)) next = `${next.slice(0, start)}${to.replace(SPECIAL, '\\$&')}${next.slice(end)}`;
	return { source: next, changed: spans.length };
}

/** A node's words, formulas and code as written. */
function plainText(node) {
	if (typeof node.value === 'string' && node.type !== 'html') return node.value;
	return (node.children ?? []).map(plainText).join('');
}

/** The words of `block`, cut to about `CONTEXT` characters around `link`. */
function around(block, link) {
	let before = '';
	let found = false;
	let after = '';
	const walk = (node) => {
		if (node === link) {
			found = true;
			before += '\u0000';
			return;
		}
		if (typeof node.value === 'string' && node.type !== 'html') {
			if (found) after += node.value;
			else before += node.value;
			return;
		}
		for (const child of node.children ?? []) walk(child);
		// Blocks inside the block (a list item's paragraphs) read as lines.
		if (node !== block && BLOCKS.has(node.type)) {
			if (found) after += ' ';
			else before += ' ';
		}
	};
	walk(block);
	const squash = (text) => text.replace(/\s+/gu, ' ');
	const [head] = squash(before).split('\u0000');
	const own = plainText(link);
	const tail = squash(after);
	const room = Math.max(0, CONTEXT - own.length);
	const keepHead = Math.min(head.length, Math.max(Math.floor(room / 2), room - tail.length));
	const keepTail = Math.min(tail.length, room - keepHead);
	const start = head.length - keepHead;
	return `${start > 0 ? '…' : ''}${head.slice(start)}${own}${tail.slice(0, keepTail)}${keepTail < tail.length ? '…' : ''}`.trim();
}
