import { Readable } from 'node:stream';

import JSZip from 'jszip';

import { createArticleSource } from '../../../articles/schemas.mjs';
import { withPageBlock } from './article-repository.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * Markdown brought in as pages (导入 Markdown), from a zip (one of Notion's or Obsidian's, or the files and folders the
 * Studio packed): each `.md` a page; a folder a page of what is in it, unless a `.md` of its name is beside it (as
 * Notion gives them: `Page.md` and `Page/`), which is then the page the folder's go under. A page's title is the one in
 * its properties, else its first `# heading`, else its file's name (without the id Notion puts after it). What it shows
 * or links to that came with it (`![](images/a.png)`, `[data](files/x.csv)`, Obsidian's `![[a.png]]`) is copied into
 * its `img/` or `assets/` and linked there; a link to another page brought in (`[b](b.md)`, `[[b]]`) leads to it.
 */

const IMAGE = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/iu;
const MARKDOWN = /\.(?:md|markdown)$/iu;
const LARGEST = 512 * 1024 * 1024;

class ImportError extends Error {
	constructor(message, statusCode = 400) {
		super(message);
		this.statusCode = statusCode;
	}
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const baseOf = (path) => path.slice(path.lastIndexOf('/') + 1);
/** A file's name as its page's title: without `.md`, and without the id Notion writes after it. */
const titleFromName = (name) => name.replace(MARKDOWN, '').replace(/\s+[0-9a-f]{32}$/u, '').trim();

/** `path` (written in a page at `from`) as a path in the zip: `..` and `.` gone, %-escapes read. */
function resolvePath(from, path) {
	let decoded = path;
	try {
		decoded = decodeURI(path);
	} catch {
		// As written.
	}
	const parts = from ? from.split('/') : [];
	for (const part of decoded.split('/')) {
		if (part === '..') parts.pop();
		else if (part && part !== '.') parts.push(part);
	}
	return parts.join('/');
}

/** A page's own lines at its top and the rest: its title, if it says one. */
function splitPage(source) {
	const text = source.replace(/^﻿/u, '').replace(/\r\n?/gu, '\n');
	const match = /^---\n([\s\S]*?)\n---\n?/u.exec(text);
	const title = match ? /^title:\s*(.*)$/mu.exec(match[1])?.[1]?.trim().replace(/^(['"])(.*)\1$/u, '$2') : undefined;
	return { title: title || '', body: match ? text.slice(match[0].length) : text };
}

export class ArticleImport {
	constructor({ articles, manager, slugs }) {
		this.articles = articles;
		this.manager = manager;
		/** Folder names for new pages, free of those taken (`note-<date>-<time>`, numbered). */
		this.slugs = slugs;
	}

	/** The zip's pages made under `parent` ('' for none): `{ pages: [{ slug, title }], files, missing }`. */
	async import(zipBytes, { parent = '' } = {}) {
		if (zipBytes.length > LARGEST) throw new ImportError(t('太大了（超过 512 MB）'), 413);
		let zip;
		try {
			zip = await JSZip.loadAsync(zipBytes);
		} catch {
			throw new ImportError(t('读不出这个压缩包'));
		}
		const files = new Map();
		for (const entry of Object.values(zip.files)) {
			const path = entry.name.replace(/\\/gu, '/').replace(/^\/+/u, '');
			if (entry.dir || path.split('/').some((part) => part.startsWith('.') || part === '__MACOSX')) continue;
			files.set(path, entry);
		}
		const pages = [...files.keys()].filter((path) => MARKDOWN.test(path)).sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
		if (!pages.length) throw new ImportError(t('里面没有 Markdown 文件（.md）'));

		// The pages to make: each .md, and each folder with Markdown in it that has no .md of its name beside it.
		const nodes = new Map();
		for (const path of pages) nodes.set(path, { key: path, file: path, dir: dirOf(path) });
		const folders = new Set(pages.flatMap((path) => dirOf(path).split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))).filter(Boolean));
		const folderPage = new Map();
		for (const folder of folders) {
			const beside = [...nodes.values()].find((node) => node.file && node.dir === dirOf(folder) && titleFromName(baseOf(node.file)) === titleFromName(baseOf(folder)));
			if (beside) folderPage.set(folder, beside.key);
			else {
				nodes.set(`${folder}/`, { key: `${folder}/`, file: null, dir: dirOf(folder), folder });
				folderPage.set(folder, `${folder}/`);
			}
		}
		// Each page's parent: the page of the folder it is in (a folder's own page: of the folder it is in).
		const parentOf = (node) => {
			const dir = node.dir;
			if (!dir) return null;
			const page = folderPage.get(dir);
			return page && page !== node.key ? page : null;
		};

		// Titles, then folder names, parents before those under them.
		const existing = new Set((await this.articles.list()).map((article) => article.slug));
		const made = [];
		const slugOf = new Map();
		const read = new Map();
		const depth = (node) => (parentOf(node) ? depth(nodes.get(parentOf(node))) + 1 : 0);
		const order = [...nodes.values()].sort((left, right) => depth(left) - depth(right));
		for (const node of order) {
			let title = titleFromName(baseOf(node.folder ?? node.file));
			let body = '';
			if (node.file) {
				const page = splitPage(await files.get(node.file).async('string'));
				body = page.body;
				const heading = /^\s*#\s+(.+?)\s*#*\s*\n/u.exec(body);
				if (page.title) title = page.title;
				else if (heading) {
					title = heading[1];
					body = body.slice(heading[0].length);
				}
			}
			const slug = this.slugs(existing);
			existing.add(slug);
			slugOf.set(node.key, slug);
			read.set(node.key, { title, body });
			const above = parentOf(node);
			await this.articles.create({ slug, title, parent: above ? slugOf.get(above) : parent });
			made.push({ slug, title, key: node.key });
		}

		// Their text, with what they show and link to brought along.
		const byName = new Map();
		for (const path of files.keys()) if (!byName.has(baseOf(path))) byName.set(baseOf(path), path);
		const byTitle = new Map(made.map((page) => [page.title, page.slug]));
		for (const page of made) byTitle.set(titleFromName(baseOf(page.key.replace(/\/$/u, ''))), page.slug);
		let copied = 0;
		const missing = [];
		for (const page of made) {
			const node = nodes.get(page.key);
			const { title, body } = read.get(page.key);
			const brought = new Map();
			const bring = async (path) => {
				if (brought.has(path)) return brought.get(path);
				const entry = files.get(path);
				if (!entry) return null;
				const folder = IMAGE.test(path) ? 'img' : 'assets';
				const { path: kept } = await this.manager.upload(page.slug, folder, baseOf(path), Readable.from([await entry.async('nodebuffer')]));
				copied += 1;
				brought.set(path, `./${kept}`);
				return `./${kept}`;
			};
			let text = body;
			// ![alt](path) and [words](path), the path not a web address nor a place in the page.
			const links = [...text.matchAll(/(!?)\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(\s+"[^"]*")?\s*\)/gu)];
			for (const link of links.reverse()) {
				const [whole, bang, words, written] = link;
				if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/iu.test(written)) continue;
				const [path, anchor = ''] = written.split('#');
				const target = resolvePath(node.dir, path);
				let to = null;
				if (MARKDOWN.test(target) && slugOf.has(target)) to = `/blog/${slugOf.get(target)}/${anchor ? `#${anchor}` : ''}`;
				else to = await bring(target);
				if (!to) {
					missing.push(`${page.title}: ${target}`);
					continue;
				}
				text = text.slice(0, link.index) + `${bang}[${words}](${to})` + text.slice(link.index + whole.length);
			}
			// Obsidian's ![[a.png]] (a file of the vault, by its name) and [[Page|words]].
			const embeds = [...text.matchAll(/(!?)\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/gu)];
			for (const embed of embeds.reverse()) {
				const [whole, bang, name, words] = embed;
				const wanted = name.trim();
				let replaced = null;
				if (bang) {
					const path = byName.get(baseOf(wanted)) ?? (files.has(wanted) ? wanted : null);
					const to = path ? await bring(path) : null;
					if (to) replaced = IMAGE.test(path) ? `![${words && !/^\d+(?:x\d+)?$/u.test(words) ? words : ''}](${to})` : `[${baseOf(path)}](${to})`;
					else missing.push(`${page.title}: ${wanted}`);
				} else {
					const slug = byTitle.get(titleFromName(baseOf(wanted.split('#')[0])));
					if (slug) replaced = `[${words || wanted}](/blog/${slug}/)`;
				}
				if (replaced) text = text.slice(0, embed.index) + replaced + text.slice(embed.index + whole.length);
			}
			// The pages under it, each a page block (as when one is moved under it), unless it is there already.
			for (const child of made) if (parentOf(nodes.get(child.key)) === page.key) text = withPageBlock(text, child.slug, child.title);
			const parentSlug = parentOf(node) ? slugOf.get(parentOf(node)) : parent;
			const { revision } = await this.articles.read(page.slug);
			await this.articles.save(page.slug, { source: createArticleSource({ title, parent: parentSlug, body: text.trim() ? text : ' ' }), expectedRevision: revision });
		}
		return { pages: made.map(({ slug, title }) => ({ slug, title })), files: copied, missing };
	}
}
