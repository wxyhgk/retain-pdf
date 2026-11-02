import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, open, readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { visit } from 'unist-util-visit';

import { articlePath, isReferenced, referencedPaths } from '@blog/markdown/articles/article-references.mjs';
import { SLUG_PATTERN } from '@blog/markdown/articles/rules.mjs';
import { parseArticle } from '@blog/markdown/syntax.mjs';
import { articleProperties } from '../../../articles/schemas.mjs';
import { resourceContentType } from '../files/file-repository.mjs';

/**
 * What lies scattered across the notes, gathered: every piece of code (a fence in an article, or a script kept in its
 * folder — pi's `ai/work/opt.py`) and every picture (shown in it, or only kept in its folder), each with the notes it
 * is in and where. The 小程序 that show them all at once (apps/code-library, apps/image-library) ask for them through
 * `studio.notes.code()` and `studio.notes.images()`: one query of the Studio, no folder read by the app itself.
 *
 * The same code or picture in several notes is one item, with each place. A note is read again only once its
 * index.md has changed; a file only once its time or size has.
 */

/** A script's or an input's language, by its extension. */
const CODE_FILES = {
	py: 'python', sh: 'shell', bash: 'shell', zsh: 'shell', js: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript',
	jl: 'julia', r: 'r', m: 'matlab', f: 'fortran', f90: 'fortran', f95: 'fortran', f03: 'fortran', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp',
	cxx: 'cpp', hpp: 'cpp', rs: 'rust', go: 'go', java: 'java', pl: 'perl', rb: 'ruby', lua: 'lua', tcl: 'tcl', gjf: 'gaussian', com: 'gaussian', inp: 'input',
};
const PICTURES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
/** Kept out: the article's own versions (ai/history), and what tools leave behind. */
const SKIPPED = new Set(['history', 'node_modules', '__pycache__', '.git']);
/** A file larger is not code anyone reads (a log, data). */
const LARGEST_CODE = 256 * 1024;
const LARGEST_PICTURE = 30 * 1024 * 1024;
/** How many files one article's folder is looked through for. */
const MOST_FILES = 3000;

const extension = (path) => extname(path).slice(1).toLowerCase();

/**
 * Where the Studio serves a picture of a note to the 小程序 (`picture` below): any of its folder, ai/ too, unlike
 * the articles' files (only img/ and assets/, those published).
 */
export const pictureUrl = (slug, path) => `/api/studio/notes/pictures/${encodeURIComponent(slug)}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** A picture asked for that is not one, or not there. */
export class PictureNotFoundError extends Error {
	statusCode = 404;
}
const hash = (data) => createHash('sha1').update(data).digest('hex').slice(0, 16);
/** The same code, however its lines end and whatever trails them. */
const normalized = (text) => text.replace(/\r\n?/gu, '\n').replace(/[ \t]+$/gmu, '').trim();
const ONE_FILE = /^\s*@file[ \t]+\S/u;

/** The value of `title="…"` in a fence's meta. */
function metaTitle(meta) {
	return String(meta ?? '').match(/\btitle=(?:"([^"]*)"|'([^']*)'|(\S+))/u)?.slice(1).find((value) => value !== undefined) ?? '';
}

/** Where the text after the properties starts: its offset, and how many lines come before it. */
function bodyOf(source) {
	const match = source.match(/^(?:﻿)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u);
	const head = match ? match[0] : '';
	return { body: source.slice(head.length), linesBefore: head.split('\n').length - 1 };
}

/**
 * One note's code fences and pictures, as its index.md has them: each with its line in the file and the heading it is
 * under. `fences` are those plugins claim (a molecule, a job: not code to read).
 * @param {string} source
 * @param {Set<string>} fences
 */
export function readNote(source, fences = new Set()) {
	const { body, linesBefore } = bodyOf(source);
	const code = [];
	const pictures = [];
	let tree;
	try {
		tree = parseArticle(body);
	} catch {
		return { code, pictures, referenced: new Set() };
	}
	const headings = [];
	visit(tree, 'heading', (node) => {
		headings.push({ at: node.position?.start?.offset ?? 0, text: plainText(node) });
	});
	const under = (at) => headings.filter((heading) => heading.at < at).at(-1)?.text ?? '';
	visit(tree, (node) => {
		const at = node.position?.start?.offset;
		if (typeof at !== 'number') return;
		const line = (node.position?.start?.line ?? 1) + linesBefore;
		if (node.type === 'code') {
			if (ONE_FILE.test(node.value) && !node.value.trim().includes('\n')) return;
			const language = String(node.lang ?? '').toLowerCase();
			const kind = language === 'output' ? 'output' : fences.has(language) ? 'plugin' : 'block';
			code.push({ kind, language, text: node.value, title: metaTitle(node.meta), line, heading: under(at) });
		} else if (node.type === 'image') {
			pictures.push({ url: node.url, alt: node.alt ?? '', line, heading: under(at) });
		} else if (node.type === 'html') {
			for (const match of String(node.value).matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/giu)) {
				const alt = match[0].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/iu);
				pictures.push({ url: match[1] ?? match[2], alt: alt?.[1] ?? alt?.[2] ?? '', line, heading: under(at) });
			}
		}
	});
	return { code, pictures, referenced: referencedPaths(source) };
}

function plainText(node) {
	if (typeof node.value === 'string') return node.value;
	return (node.children ?? []).map(plainText).join('');
}

/** The files of an article's folder (not index.md, not its history), as paths in it, with their times and sizes. */
async function filesOf(folder) {
	const found = [];
	const walk = async (dir, prefix, depth) => {
		if (depth > 6 || found.length >= MOST_FILES) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name.startsWith('.') || SKIPPED.has(entry.name) || entry.isSymbolicLink()) continue;
			const path = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(join(dir, entry.name), path, depth + 1);
			else if (entry.isFile() && path !== 'index.md') {
				const kind = extension(path);
				if (!(kind in CODE_FILES) && !PICTURES.has(kind)) continue;
				try {
					const info = await stat(join(dir, entry.name));
					found.push({ path, size: info.size, modified: info.mtimeMs });
				} catch {
					// Gone meanwhile.
				}
			}
		}
	};
	await walk(folder, '', 0);
	return found;
}

/**
 * @typedef {{ slug: string, title: string, heading: string, line: number | null, path: string | null, modified: number }} Place
 * @typedef {{ id: string, kind: 'block' | 'file' | 'plugin' | 'output', language: string, title: string, text: string, lines: number, modified: number, places: Place[] }} CodeItem
 * @typedef {{ id: string, url: string, name: string, alt: string, size: number | null, remote: boolean, referenced: boolean, modified: number, places: Array<Place & { referenced: boolean }> }} PictureItem
 */
/** The items, and the places of each, those changed last first. */
function newestFirst(items) {
	const latest = (left, right) => right.modified - left.modified;
	for (const item of items.values()) item.places.sort(latest);
	return [...items.values()].sort(latest);
}

export class NotesIndex {
	/** @type {Map<string, { stamp: string, note: ReturnType<typeof readNote>, title: string, date: string }>} */
	#notes = new Map();
	/** A file's text or its content's hash, by where it is and when it changed. */
	#files = new Map();

	/**
	 * @param {string} blogRoot
	 * @param {{ fences?: () => Iterable<string> }} [options] the fences plugins claim, asked for each time
	 */
	constructor(blogRoot, { fences = () => [] } = {}) {
		this.blogRoot = blogRoot;
		this.fences = fences;
	}

	/** Every note: its folder name, title, date, what its index.md holds, and its folder's files. */
	async #notesRead() {
		let entries;
		try {
			entries = await readdir(this.blogRoot, { withFileTypes: true });
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}
		const fences = new Set([...this.fences()].map((fence) => String(fence).toLowerCase()));
		const fenceStamp = [...fences].sort().join(',');
		const notes = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || !SLUG_PATTERN.test(entry.name)) continue;
			const folder = join(this.blogRoot, entry.name);
			const markdown = join(folder, 'index.md');
			let info;
			try {
				info = await stat(markdown);
			} catch {
				continue;
			}
			const stamp = `${info.mtimeMs}:${info.size}:${fenceStamp}`;
			let known = this.#notes.get(entry.name);
			if (known?.stamp !== stamp) {
				const source = await readFile(markdown, 'utf8').catch(() => '');
				const { title, pubDate } = articleProperties(source, entry.name);
				known = { stamp, note: readNote(source, fences), title, date: pubDate };
				this.#notes.set(entry.name, known);
			}
			notes.push({ slug: entry.name, folder, modified: info.mtimeMs, ...known, files: await filesOf(folder) });
		}
		// Those gone are forgotten.
		const there = new Set(notes.map((note) => note.slug));
		for (const slug of this.#notes.keys()) if (!there.has(slug)) this.#notes.delete(slug);
		return notes;
	}

	/**
	 * A picture of a note (`pictureUrl`): only a picture, only inside the note's folder (no `..`, no link followed, not
	 * its history), to be sent.
	 */
	async picture(slug, path) {
		const segments = String(path ?? '').split('/');
		const wrong = !SLUG_PATTERN.test(String(slug)) || !PICTURES.has(extension(String(path))) || segments.some((segment) => !segment || segment.startsWith('.') || segment === '..' || segment.includes('\\') || segment.includes('\0'));
		if (wrong || (segments[0] === 'ai' && segments[1] === 'history')) throw new PictureNotFoundError();
		let current = join(this.blogRoot, slug);
		for (const segment of ['', ...segments]) {
			current = segment ? join(current, segment) : current;
			const info = await lstat(current).catch(() => null);
			if (!info || info.isSymbolicLink()) throw new PictureNotFoundError();
		}
		const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => null);
		if (!handle) throw new PictureNotFoundError();
		const { size } = await handle.stat();
		return { body: handle.createReadStream(), contentType: resourceContentType(path), size, range: null };
	}

	/** A file's `what` (its text, or its content's hash), read again only when its time or size changed. */
	async #file(full, size, modified, what) {
		const key = `${what}\0${full}`;
		const known = this.#files.get(key);
		if (known && known.size === size && known.modified === modified) return known.value;
		const data = await readFile(full);
		const value = what === 'text' ? data.toString('utf8') : hash(data);
		this.#files.set(key, { size, modified, value });
		return value;
	}

	/**
	 * All the code in the notes: fences (plugins' and run results' marked so, for the app to leave out), and the
	 * scripts and inputs kept in their folders. The same code is one item, with each place it is in.
	 * @returns {Promise<CodeItem[]>}
	 */
	async code() {
		/** @type {Map<string, CodeItem>} */
		const items = new Map();
		const add = (kind, language, title, text, place) => {
			const id = hash(`${kind === 'file' ? 'block' : kind}\0${language}\0${normalized(text)}`);
			const item = items.get(id) ?? { id, kind, language, title, text, lines: text.split('\n').length, modified: 0, places: [] };
			item.places.push(place);
			item.modified = Math.max(item.modified, place.modified);
			item.title ||= title;
			items.set(id, item);
		};
		for (const note of await this.#notesRead()) {
			for (const block of note.note.code) {
				if (!block.text.trim()) continue;
				add(block.kind, block.language, block.title, block.text, { slug: note.slug, title: note.title, heading: block.heading, line: block.line, path: null, modified: note.modified });
			}
			for (const file of note.files) {
				const language = CODE_FILES[extension(file.path)];
				if (!language || file.size > LARGEST_CODE) continue;
				let text;
				try {
					text = await this.#file(join(note.folder, file.path), file.size, file.modified, 'text');
				} catch {
					continue;
				}
				if (!text.trim() || text.includes('\0')) continue;
				add('file', language, file.path.split('/').at(-1) ?? file.path, text, { slug: note.slug, title: note.title, heading: '', line: null, path: file.path, modified: file.modified });
			}
		}
		return newestFirst(items);
	}

	/**
	 * All the pictures of the notes: those shown in them (their own files, or on the web) and those only kept in their
	 * folders (`referenced` false: an AI's plot never put in, an upload left over). The same picture is one item.
	 * @returns {Promise<PictureItem[]>}
	 */
	async images() {
		/** @type {Map<string, PictureItem>} */
		const items = new Map();
		for (const note of await this.#notesRead()) {
			const shown = new Map();
			for (const picture of note.note.pictures) {
				const path = articlePath(picture.url);
				if (path) {
					if (!shown.has(path)) shown.set(path, picture);
					continue;
				}
				if (!/^https?:\/\//iu.test(picture.url)) continue;
				const id = hash(`web\0${picture.url}`);
				const item = items.get(id) ?? { id, url: picture.url, name: picture.url.split(/[/?#]/u).filter(Boolean).at(-1) ?? picture.url, alt: picture.alt, size: null, remote: true, referenced: true, modified: note.modified, places: [] };
				item.places.push({ slug: note.slug, title: note.title, heading: picture.heading, line: picture.line, path: null, modified: note.modified, referenced: true });
				item.alt ||= picture.alt;
				items.set(id, item);
			}
			for (const file of note.files) {
				if (!PICTURES.has(extension(file.path)) || file.size > LARGEST_PICTURE) continue;
				let content;
				try {
					content = await this.#file(join(note.folder, file.path), file.size, file.modified, 'hash');
				} catch {
					continue;
				}
				const where = shown.get(file.path);
				const referenced = Boolean(where) || isReferenced(note.note.referenced, file.path);
				const place = { slug: note.slug, title: note.title, heading: where?.heading ?? '', line: where?.line ?? null, path: file.path, modified: file.modified, referenced };
				const item = items.get(content) ?? { id: content, url: pictureUrl(note.slug, file.path), name: file.path.split('/').at(-1) ?? file.path, alt: '', size: file.size, remote: false, referenced: false, modified: 0, places: [] };
				item.places.push(place);
				item.alt ||= where?.alt ?? '';
				item.modified = Math.max(item.modified, file.modified);
				// Shown somewhere: its address is where it is shown.
				if (referenced && !item.referenced) item.url = pictureUrl(note.slug, file.path);
				item.referenced ||= referenced;
				items.set(content, item);
			}
		}
		return newestFirst(items);
	}
}
