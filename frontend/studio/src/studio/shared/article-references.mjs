import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import remarkMathBrackets from '../../plugins/remark-math-brackets.mjs';

/**
 * Where an article's `index.md` points at its own files: images and links,
 * reference definitions, `src` and `href` in inline HTML, `heroImage` in the
 * frontmatter, and the one-line `@file ./assets/…` of chemistry blocks.
 *
 * Each reference carries the article-relative path it names (`img/a.png`)
 * and, when it can be edited in place, where that path is written in the
 * source, so a rename changes only those characters and keeps everything
 * else the author wrote. Web addresses, site paths (`/…`) and anchors are not
 * the article's files and are left out.
 */

const parser = unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets);

const HTML_ATTRIBUTE = /\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu;
const FILE_DIRECTIVE = /^@file[ \t]+(.+?)[ \t]*$/u;
const HERO_IMAGE = /^heroImage:[ \t]*(["']?)([^"'#\r\n]*?)\1[ \t]*(?:#.*)?$/u;

/**
 * @typedef {'image' | 'link' | 'definition' | 'html' | 'file' | 'frontmatter'} ReferenceKind
 * @typedef {{ path: string, kind: ReferenceKind, start: number, end: number, raw: string } } ArticleReference
 */

/**
 * Every reference to a file inside the article, in source order.
 * @param {string} source the whole `index.md`
 * @returns {ArticleReference[]}
 */
export function findArticleReferences(source) {
	const { bodyStart, frontmatter } = splitSource(source);
	const references = [];
	if (frontmatter) references.push(...frontmatterReferences(source, frontmatter));

	const body = source.slice(bodyStart);
	let tree;
	try {
		tree = parser.runSync(parser.parse(body));
	} catch {
		return references;
	}
	visit(tree, (node) => {
		const start = node.position?.start?.offset;
		const end = node.position?.end?.offset;
		if (typeof start !== 'number' || typeof end !== 'number') return;
		const written = body.slice(start, end);
		const at = bodyStart + start;
		if (node.type === 'image' || node.type === 'link') add(references, node.type, node.url, written, at, destinationAfter(written, '](', node.url));
		else if (node.type === 'definition') add(references, 'definition', node.url, written, at, destinationAfter(written, ']:', node.url));
		else if (node.type === 'html') {
			for (const match of written.matchAll(HTML_ATTRIBUTE)) {
				const value = match[1] ?? match[2] ?? match[3];
				const offset = match.index + match[0].length - value.length - (match[3] === undefined ? 1 : 0);
				add(references, 'html', decodeHtmlEntities(value), written, at, { offset, raw: value });
			}
		} else if (node.type === 'code' && node.lang) {
			const directive = fileDirective(node.value, written);
			if (directive) add(references, 'file', directive.raw, written, at, directive);
		}
	});
	return references.sort((left, right) => left.start - right.start);
}

/**
 * The article-relative paths the source refers to.
 * @param {string} source
 * @returns {Set<string>}
 */
export function referencedPaths(source) {
	return new Set(findArticleReferences(source).map((reference) => reference.path));
}

/**
 * Whether `path` is referenced, directly or (for a folder) through something inside it.
 * @param {Set<string>} referenced from `referencedPaths`
 * @param {string} path article-relative, without a trailing slash
 */
export function isReferenced(referenced, path) {
	if (referenced.has(path)) return true;
	for (const entry of referenced) if (entry.startsWith(`${path}/`)) return true;
	return false;
}

/**
 * Where a file or folder ends up when `from` is moved to `to`, or null when the move leaves it alone.
 * @param {string} path
 * @param {string} from
 * @param {string} to
 * @returns {string | null}
 */
export function movedPath(path, from, to) {
	if (path === from) return to;
	if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
	return null;
}

/**
 * The source with every reference into `from` pointed at `to` instead,
 * written the way the original was (`./` or not, percent-encoded or not).
 * @param {string} source
 * @param {string} from article-relative file or folder
 * @param {string} to its new path
 * @returns {{ source: string, changed: number, moves: Array<{ kind: ReferenceKind, from: string, to: string }> }}
 */
export function rewriteMovedReferences(source, from, to) {
	const edits = [];
	for (const reference of findArticleReferences(source)) {
		const target = movedPath(reference.path, from, to);
		if (target === null) continue;
		edits.push({ reference, text: writeLike(reference.raw, target, reference.kind) });
	}
	let next = source;
	for (const { reference, text } of [...edits].reverse()) {
		next = `${next.slice(0, reference.start)}${text}${next.slice(reference.end)}`;
	}
	return {
		source: next,
		changed: edits.length,
		moves: edits.map(({ reference, text }) => ({ kind: reference.kind, from: reference.raw, to: text })),
	};
}

/**
 * An article-relative path from a written URL, or null for what is not one
 * of the article's files: web addresses, site paths, anchors, paths that
 * climb out of the article folder.
 * @param {string} written
 * @returns {string | null}
 */
export function articlePath(written) {
	const url = written.trim();
	if (!url || /^[a-z][a-z0-9+.-]*:/iu.test(url) || url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) return null;
	const segments = [];
	for (const segment of url.replace(/[?#].*$/su, '').split('/')) {
		const name = safeDecode(segment);
		if (name === '' || name === '.') continue;
		if (name === '..') {
			if (segments.length === 0) return null;
			segments.pop();
		} else segments.push(name);
	}
	return segments.length ? segments.join('/') : null;
}

function add(references, kind, url, written, at, location) {
	const path = articlePath(url);
	if (!path || !location) return;
	// Only the path itself is rewritten; a `?query` or `#anchor` after it stays.
	const raw = location.raw.replace(/[?#].*$/su, '');
	references.push({ path, kind, start: at + location.offset, end: at + location.offset + raw.length, raw });
}

/** Where a link's destination is written, after `](` (or `]:` for a definition). */
function destinationAfter(written, marker, url) {
	for (let index = written.lastIndexOf(marker); index >= 0; index = written.lastIndexOf(marker, index - 1)) {
		let offset = index + marker.length;
		while (offset < written.length && /\s/u.test(written[offset])) offset += 1;
		if (written[offset] === '<') offset += 1;
		// Escapes and character references make the written form differ from the URL; those are found but not rewritten.
		if (written.startsWith(url, offset)) return { offset, raw: url };
		if (index === 0) break;
	}
	return null;
}

/** A fence whose whole content is `@file <path>`; the path is found after the opening fence line. */
function fileDirective(value, written) {
	const match = FILE_DIRECTIVE.exec(value.trim());
	if (!match) return null;
	const directive = written.indexOf('@file', written.search(/\r?\n/u));
	if (directive < 0) return null;
	const offset = written.indexOf(match[1], directive + '@file'.length);
	return offset < 0 ? null : { offset, raw: match[1] };
}

function frontmatterReferences(source, frontmatter) {
	const references = [];
	let lineStart = frontmatter.yamlStart;
	for (const line of source.slice(frontmatter.yamlStart, frontmatter.yamlEnd).split(/(?<=\n)/u)) {
		const content = line.replace(/\r?\n$/u, '');
		const match = HERO_IMAGE.exec(content);
		if (match && match[2]) {
			const offset = content.indexOf(match[2], 'heroImage:'.length);
			add(references, 'frontmatter', match[2], content, lineStart, { offset, raw: match[2] });
		}
		lineStart += line.length;
	}
	return references;
}

/** The new path written in the style of the old one. */
function writeLike(oldRaw, path, kind) {
	const prefix = oldRaw.startsWith('./') || kind === 'file' ? './' : '';
	const encoded = /%[0-9a-f]{2}/iu.test(oldRaw) || (kind !== 'file' && /[\s()<>]/u.test(path));
	const written = encoded ? path.split('/').map(encodeURIComponent).join('/') : path;
	return `${prefix}${written}`;
}

function safeDecode(segment) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

function decodeHtmlEntities(value) {
	return value.replace(/&(amp|lt|gt|quot|#39);/gu, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]);
}

/**
 * The frontmatter's YAML and where the body starts, by the same rules as
 * the Studio's document parser: an optional BOM, a `---` line, and the first
 * later `---` or `...` line closing it.
 */
function splitSource(source) {
	const contentStart = source.startsWith('﻿') ? 1 : 0;
	const lines = [];
	for (let cursor = contentStart; cursor < source.length;) {
		const start = cursor;
		while (cursor < source.length && source[cursor] !== '\n' && source[cursor] !== '\r') cursor += 1;
		const contentEnd = cursor;
		if (source[cursor] === '\r' && source[cursor + 1] === '\n') cursor += 2;
		else if (cursor < source.length) cursor += 1;
		lines.push({ start, end: cursor, marker: source.slice(start, contentEnd).trimEnd(), terminated: cursor > contentEnd });
	}
	const [opening, ...rest] = lines;
	if (!opening || opening.marker !== '---' || !opening.terminated) return { bodyStart: contentStart, frontmatter: null };
	const closing = rest.find((line) => line.marker === '---' || line.marker === '...');
	if (!closing) return { bodyStart: contentStart, frontmatter: null };
	return { bodyStart: closing.end, frontmatter: { yamlStart: opening.end, yamlEnd: closing.start } };
}

/** Where the Studio serves a file of the article: `img/a.png` → `/api/studio/articles/<slug>/files/img/a.png`. */
export function studioFileUrl(slug, path) {
	return `/api/studio/articles/${encodeURIComponent(slug)}/files/${path.split('/').map(encodeURIComponent).join('/')}`;
}
