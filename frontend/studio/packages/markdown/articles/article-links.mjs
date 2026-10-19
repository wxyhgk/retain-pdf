import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

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
 * written in full, `https://…/blog/<slug>/`. What is in code is not a link.
 * @param {string} source
 * @param {{ site?: string }} [options]
 * @returns {ArticleLink[]}
 */
export function findArticleLinks(source, { site } = {}) {
	const origin = site ? new URL(site).origin : null;
	const links = [];
	visitParents(unified().use(remarkParse).parse(source), (node, ancestors) => {
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
