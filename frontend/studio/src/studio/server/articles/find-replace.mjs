import { readFile } from 'node:fs/promises';

import { articleBundlePaths } from '../../../articles/bundle-paths.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * Finding words in all the articles and putting others in their place (查找替换, as SiYuan's): what is found is shown
 * first, each place with the words round it, and only the places chosen are changed, each article's text kept as a
 * version first. Never in the properties at the top; by default not in code (fenced or `inline`), formulas ($…$,
 * $$…$$) or where a link or a picture leads (`](./img/a.png)`), where a word changed would break something.
 */

class FindError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

/** The stretches of `source` not looked in: [from, to) pairs. */
export function skippedRanges(source, { skipCode = true } = {}) {
	const ranges = [];
	const frontmatter = /^(?:﻿)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(source);
	if (frontmatter) ranges.push([0, frontmatter[0].length]);
	if (!skipCode) return ranges;
	// Fenced code: from its fence to the one that closes it (or the end).
	const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gmu;
	for (let open = fence.exec(source); open; open = fence.exec(source)) {
		const mark = open[1];
		const close = new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},}\\s*$`, 'gmu');
		close.lastIndex = open.index + open[0].length;
		const end = close.exec(source);
		const to = end ? end.index + end[0].length : source.length;
		ranges.push([open.index, to]);
		fence.lastIndex = to;
	}
	const add = (pattern) => {
		for (const match of source.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
	};
	add(/\$\$[\s\S]*?\$\$/gu);
	add(/(?<![\\$])\$(?!\$)(?:[^$\n\\]|\\.)+?\$/gu);
	add(/(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu);
	add(/\]\([^)\n]*\)/gu);
	return ranges.sort((left, right) => left[0] - right[0]);
}

/** Where `find` is in `source`, but in what is skipped: [{ from, to }], in order, none overlapping. */
export function findMatches(source, find, { caseSensitive = false, skipCode = true } = {}) {
	if (typeof find !== 'string' || !find) return [];
	const skipped = skippedRanges(source, { skipCode });
	const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), caseSensitive ? 'gu' : 'giu');
	const found = [];
	for (const match of source.matchAll(pattern)) {
		const from = match.index;
		const to = from + match[0].length;
		if (!skipped.some(([start, end]) => from < end && to > start)) found.push({ from, to });
	}
	return found;
}

/** `source` with the places `chosen` (indexes into `matches`) put `replacement` in. */
export function replaceMatches(source, matches, replacement, chosen = matches.map((_, index) => index)) {
	let out = source;
	for (const index of [...new Set(chosen)].sort((left, right) => right - left)) {
		const match = matches[index];
		if (match) out = out.slice(0, match.from) + replacement + out.slice(match.to);
	}
	return out;
}

/** A place as shown: its line, the words before it on the line, what is found, the words after. */
function context(source, { from, to }) {
	const start = source.lastIndexOf('\n', from - 1) + 1;
	const end = source.indexOf('\n', to);
	const before = source.slice(start, from);
	const after = source.slice(to, end < 0 ? source.length : end);
	return {
		line: source.slice(0, from).split('\n').length,
		before: before.length > 60 ? `…${before.slice(-60)}` : before,
		text: source.slice(from, to),
		after: after.length > 60 ? `${after.slice(0, 60)}…` : after,
	};
}

/** What changing words in all the articles needs: the articles, their history (a version kept before), the blog's address. */
export class FindReplace {
	constructor({ articles, history, blogRoot, site }) {
		this.articles = articles;
		this.history = history;
		this.blogRoot = blogRoot;
		this.site = site;
	}

	/** Where `find` is in each article: `{ slug, title, icon, revision, matches: [{ line, before, text, after }] }`. */
	async preview(find, options = {}) {
		if (typeof find !== 'string' || !find.trim()) throw new FindError(t('要找什么？'));
		const results = [];
		for (const { slug, title, icon } of await this.articles.list()) {
			let source;
			try {
				source = await readFile(articleBundlePaths(this.blogRoot, slug).markdown, 'utf8');
			} catch {
				continue;
			}
			const matches = findMatches(source, find, options);
			if (!matches.length) continue;
			const { revision } = await this.articles.read(slug);
			results.push({ slug, title, icon, revision, matches: matches.map((match) => context(source, match)) });
		}
		return results;
	}

	/**
	 * `replacement` put in the places chosen (`picks`: slug → the indexes of its places as previewed, with the
	 * revision it was previewed at); an article changed since is left as it is and said so. Each article's text is
	 * kept as a version before it is written.
	 */
	async apply(find, replacement, picks, options = {}) {
		if (typeof replacement !== 'string') throw new FindError(t('换成什么？'));
		const changed = [];
		const skipped = [];
		for (const [slug, { revision, indexes }] of Object.entries(picks ?? {})) {
			if (!Array.isArray(indexes) || !indexes.length) continue;
			const read = await this.articles.read(slug);
			if (read.revision !== revision) {
				skipped.push({ slug, title: read.properties?.title ?? slug, why: t('查找之后它又改过了') });
				continue;
			}
			const matches = findMatches(read.source, find, options);
			const chosen = [...new Set(indexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < matches.length);
			const next = replaceMatches(read.source, matches, replacement, chosen);
			if (next === read.source) continue;
			await this.articles.save(slug, { source: next, expectedRevision: revision }, { site: this.site, before: (current) => this.history.keep(slug, current, 'before-change') });
			changed.push({ slug, count: chosen.length });
		}
		return { changed, skipped };
	}
}
