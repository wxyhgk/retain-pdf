import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { articleBundlePaths, resolveInside } from '../../../articles/bundle-paths.mjs';
import { setFrontmatterField } from '@blog/document/frontmatter.ts';
import { t } from '@blog/i18n/index.mjs';

/**
 * A page given out as Markdown (导出 Markdown), to read or carry to another editor: its `index.md` as `<title>.md`, its
 * `img/` and `assets/` beside it (its `ai/` is the AIs' and stays), the links to them as they are (`./img/a.png`). A
 * page with no files is the `.md` alone; with files, or its pages under it, a `.zip`: each page under it a folder of
 * its own beside it (`<title>/<title>.md`, as Notion gives them). Where it is in the tree (`parent:`, `order:`) means
 * nothing elsewhere and is left out; a link to a page given out with it leads to its `.md`, one to another page to the
 * blog's address of it.
 */

const LINK = /\]\(\s*(?:https?:\/\/[^/)\s]+)?\/(blog|wiki)\/([a-z0-9][a-z0-9-]*)\/?((?:[#?][^)\s]*)?)\s*\)/gu;

/** A title as a file's name: what a file system refuses taken out; none left, the folder's name. */
export function fileNameOf(title, slug) {
	const name = String(title ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/gu, ' ').replace(/\s+/gu, ' ').trim().replace(/^\.+/u, '').slice(0, 80);
	return name || slug;
}

export class ArticleExport {
	constructor({ articles, manager, blogRoot, site }) {
		this.articles = articles;
		this.manager = manager;
		this.blogRoot = blogRoot;
		this.site = site;
	}

	/** `slug` given out (with the pages under it when `children`): `{ name, type, body }`. */
	async export(slug, { children = false } = {}) {
		const all = await this.articles.list();
		const root = all.find((article) => article.slug === slug);
		if (!root) throw Object.assign(new Error(t('页面不存在')), { statusCode: 404 });
		// The pages given out, each with the folder it goes in (the root's: none), named apart from those beside it.
		const placed = new Map([[slug, { folder: '', name: fileNameOf(root.untitled ? '' : root.title, slug) }]]);
		const under = (parent, folder) => {
			const taken = new Set();
			for (const page of all.filter((article) => article.parent === parent)) {
				let name = fileNameOf(page.untitled ? '' : page.title, page.slug);
				for (let number = 2; taken.has(name); number += 1) name = `${fileNameOf(page.title, page.slug)} ${number}`;
				taken.add(name);
				const inside = folder ? `${folder}/${name}` : name;
				placed.set(page.slug, { folder: inside, name });
				under(page.slug, inside);
			}
		};
		if (children) under(slug, '');

		const zip = new JSZip();
		let files = 0;
		let rootText = '';
		for (const [page, { folder, name }] of placed) {
			const { source } = await this.articles.read(page);
			const text = this.#links(setFrontmatterField(setFrontmatterField(source, 'parent', null), 'order', null), folder, placed);
			if (page === slug) rootText = text;
			zip.file(folder ? `${folder}/${name}.md` : `${name}.md`, text);
			const { directory } = articleBundlePaths(this.blogRoot, page);
			for (const entry of await this.manager.list(page)) {
				if (entry.kind !== 'file' || !/^(?:img|assets)\//u.test(entry.path)) continue;
				zip.file(folder ? `${folder}/${entry.path}` : entry.path, await readFile(resolveInside(directory, ...entry.path.split('/'))));
				files += 1;
			}
		}
		const name = placed.get(slug).name;
		if (placed.size === 1 && !files) return { name: `${name}.md`, type: 'text/markdown; charset=utf-8', body: Buffer.from(rootText) };
		return { name: `${name}.zip`, type: 'application/zip', body: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
	}

	/** The page links of a page in `folder`: to one given out, its `.md` from there; to another, the blog's address. */
	#links(source, folder, placed) {
		const depth = folder ? folder.split('/').length : 0;
		return source.replace(LINK, (whole, kind, slug, rest) => {
			const target = placed.get(slug);
			if (target) {
				const up = '../'.repeat(depth);
				const path = `${up}${target.folder ? `${target.folder}/` : ''}${target.name}.md`;
				return `](${encodeURI(path)}${rest.startsWith('#') ? rest : ''})`;
			}
			return this.site ? `](${new URL(`/${kind}/${slug}/${rest}`, this.site).href})` : whole;
		});
	}
}
