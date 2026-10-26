// What can be done to the blog's pages from outside the Studio: by a program, and above all by an AI
// (bin/studio.mjs on the command line, bin/studio-mcp.mjs as an MCP server). The same modules the
// Studio's server uses, on the same files, so the Studio, open or not, sees each change as any other
// made on disk (an article open in it shows the change to accept or reject).
import { resolve } from 'node:path';

import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { comparePages } from '../../articles/page-order.mjs';
import { parseStudioDocument } from '../document/parse.ts';
import { replaceStudioDocumentBody } from '../document/serialize.ts';
import { updateStudioFrontmatter } from '../document/frontmatter.ts';
import { checkArticle } from '../server/article-check.mjs';
import { ArticleGit } from '../server/article-git.mjs';
import { ArticleHistory } from '../server/article-history.mjs';
import { ArticleRepository } from '../server/article-repository.mjs';
import { Drive } from '../server/drive.mjs';
import { DriveText } from '../server/drive-text.mjs';
import { ArticleFileManager } from '../server/file-manager.mjs';
import { studioBlogRoot } from '../server/page-version.mjs';
import { autoSlug, freeSlug, isAutoSlug, readableSlug } from '../pages/page-names.ts';
import { filesNamed } from '../editor/split-section.ts';
import { markdownSection } from './markdown-section.mjs';

/** A mistake in what was asked: said back as it is, not as a failure of the program. */
export class StudioOpsError extends Error {
	constructor(message) {
		super(message);
		this.name = 'StudioOpsError';
	}
}

/**
 * The operations, on the project at `root` (its `blog/`, or `STUDIO_BLOG_DIR`
 * as the Studio's server takes it). `site`: the blog's address, so links to
 * its pages written in full count as theirs.
 */
export function createStudioOps({ root, site } = {}) {
	const projectRoot = resolve(root ?? process.cwd());
	const testBlog = process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : null;
	const blogRoot = testBlog ?? studioBlogRoot(projectRoot);
	const history = new ArticleHistory(blogRoot);
	// One command and done: links follow a new title at once.
	const articles = new ArticleRepository(blogRoot, { keep: (slug, source) => history.keep(slug, source, 'before-change') });
	const manager = new ArticleFileManager(blogRoot, { trashRoot: testBlog ? resolve(testBlog, '.studio-trash') : resolve(projectRoot, '.studio-trash') });
	const git = new ArticleGit(blogRoot);
	const settingsFile = testBlog ? resolve(testBlog, '.studio-settings.json') : resolve(projectRoot, '.studio-settings.json');
	const drive = new Drive({ settingsFile, fixedRoot: process.env.STUDIO_DRIVE_DIR ? resolve(process.env.STUDIO_DRIVE_DIR) : null, forbidden: [projectRoot, blogRoot] });

	const pages = () => articles.list();
	const find = async (slug) => {
		const page = (await pages()).find((entry) => entry.slug === slug);
		if (!page) throw new StudioOpsError(`没有文件夹名为 ${slug} 的页面`);
		return page;
	};
	/** The pages under `slug`, all the way down. */
	const under = (all, slug) => {
		const found = [];
		const seen = new Set([slug]);
		for (let index = -1, at = slug; ; ) {
			for (const page of all) if (page.parent === at && !seen.has(page.slug)) (seen.add(page.slug), found.push(page));
			index += 1;
			if (index >= found.length) return found;
			at = found[index].slug;
		}
	};
	const address = (page) => articleAddress(page.kind, page.slug);
	/** A change written by these operations: what was there kept in the page's history first, as the Studio keeps it. */
	const write = async (slug, next) => {
		const { source, revision } = await articles.read(slug);
		if (next === source) return;
		await history.keep(slug, source, 'before-change');
		await articles.save(slug, { source: next, expectedRevision: revision });
	};

	return {
		blogRoot,

		/** Every page: folder name, title, the page it is under, its order there, draft or not, kind, tags, address. */
		async listPages() {
			return (await pages()).map((page) => ({ ...page, address: address(page) }));
		},

		/** The pages as a tree, each with those under it, in the order the Studio shows them. */
		async pageTree() {
			const all = await pages();
			const known = new Set(all.map((page) => page.slug));
			const node = (page) => ({ slug: page.slug, title: page.title, draft: page.draft, address: address(page), children: childrenOf(page.slug) });
			const childrenOf = (slug) => all.filter((page) => page.parent === slug && page.slug !== slug).sort(comparePages).map(node);
			return all.filter((page) => !page.parent || !known.has(page.parent)).sort(comparePages).map(node);
		},

		/** A page: its whole Markdown, its properties, what is wrong with them. */
		async readPage({ slug }) {
			const page = await articles.read(slug);
			return { slug, source: page.source, properties: page.properties, problems: page.problems };
		},

		/** The pages whose title or text holds `query`, with the lines it is on. */
		/** @param {{ query: string, limit?: number }} args */
		searchPages({ query, limit }) {
			return articles.search(query, { limit });
		},

		/** The pages that link to it, with the words around each link. */
		backlinks({ slug }) {
			return articles.backlinks(slug, { site });
		},

		/**
		 * A new page, a draft: `title`, under `parent` (a folder name) when given,
		 * its text `body` (Markdown) when given. Its folder name is made up
		 * (`note-…`) unless `slug` is given; it gets one read from its title when
		 * it is published. Files of the parent its body names (`./img/…`) are copied in.
		 */
		/** @param {{ title: string, parent?: string, body?: string, slug?: string }} args */
		async createPage({ title, parent = '', body = '', slug }) {
			if (!title?.trim()) throw new StudioOpsError('标题不能为空');
			const all = await pages();
			if (parent && !all.some((page) => page.slug === parent)) throw new StudioOpsError(`上级页面 ${parent} 不存在`);
			const folder = slug || freeSlug(autoSlug(), all.map((page) => page.slug));
			await articles.create({ slug: folder, title: title.trim(), parent, body, files: parent ? filesNamed(body) : [] });
			return { slug: folder, address: `/blog/${folder}/`, parent };
		},

		/**
		 * A page's text and properties changed: `body` (Markdown, the whole text
		 * after the properties), and any of `title`, `description`, `tags`,
		 * `icon`. The text before is kept in its history.
		 */
		/** @param {{ slug: string, body?: string, title?: string, description?: string, tags?: string[], icon?: string }} args */
		async updatePage({ slug, body, title, description, tags, icon }) {
			const { source, properties } = await articles.read(slug);
			let next = source;
			if (title !== undefined || description !== undefined || tags !== undefined || icon !== undefined) {
				next = updateStudioFrontmatter(next, {
					...properties,
					...(title !== undefined ? { title } : {}),
					...(description !== undefined ? { description } : {}),
					...(tags !== undefined ? { tags } : {}),
					...(icon !== undefined ? { icon } : {}),
				});
			}
			if (body !== undefined) next = replaceStudioDocumentBody(parseStudioDocument(next), `${body.replace(/\s*$/u, '')}\n`);
			await write(slug, next);
			return { slug, problems: (await articles.read(slug)).problems };
		},

		/**
		 * Puts a page under another (`parent`, a folder name), or at the top with
		 * `parent` empty; with `before` or `after` (a page under the same one),
		 * just there. Not under itself, nor under a page under it.
		 */
		/** @param {{ slug: string, parent?: string, before?: string, after?: string }} args */
		movePage({ slug, parent = '', before, after }) {
			return articles.setParent(slug, parent, { before: before ?? '', after: after ?? '' });
		},

		/** Another folder name (its address on the blog): the links to it in the other pages follow it. */
		renamePage({ slug, to }) {
			return articles.rename(slug, to, { site });
		},

		/**
		 * 转成子页面: the section a heading begins (its text `heading`, the first
		 * so if several; to the next heading as high or higher) made a page under
		 * this one, the heading its title, the files it names copied; in its
		 * place, a link to the new page.
		 */
		async splitPage({ slug, heading }) {
			const { source } = await articles.read(slug);
			const document = parseStudioDocument(source);
			const section = markdownSection(document.body.raw, heading);
			if (!section) throw new StudioOpsError(`这篇里没有标题「${heading}」`);
			const all = await pages();
			const folder = freeSlug(autoSlug(), all.map((page) => page.slug));
			await articles.create({ slug: folder, title: section.title, parent: slug, body: section.text, files: filesNamed(section.text) });
			const body = `${document.body.raw.slice(0, section.from)}[${section.title}](/blog/${folder}/)\n\n${document.body.raw.slice(section.to).replace(/^\s+/u, '')}`;
			await write(slug, replaceStudioDocumentBody(document, body));
			return { slug: folder, title: section.title, address: `/blog/${folder}/`, parent: slug };
		},

		/** 并入上级页面: its text a section of the page it is under (in place of the link to it), itself to the trash. */
		async mergePage({ slug }) {
			const merged = await articles.merge(slug, { site, before: (parent, source) => history.keep(parent, source, 'before-change') });
			const { trashed } = await articles.exclusive(slug, () => manager.trashArticle(slug));
			return { ...merged, trashed };
		},

		/**
		 * To the trash, from where `restorePage` brings it back (30 days): with
		 * the pages under it (`children: 'delete'`, the default), or alone, those
		 * under it put under the page it was under (`children: 'lift'`).
		 */
		/** @param {{ slug: string, children?: 'delete' | 'lift' }} args */
		async deletePage({ slug, children = 'delete' }) {
			const all = await pages();
			const page = await find(slug);
			const below = under(all, slug);
			if (children === 'lift') {
				for (const child of all.filter((entry) => entry.parent === slug)) await articles.setParent(child.slug, page.parent ?? '');
			}
			const going = children === 'lift' ? [page] : [page, ...below];
			const trashed = [];
			for (const one of [...going].reverse()) trashed.push((await articles.exclusive(one.slug, () => manager.trashArticle(one.slug))).trashed);
			return { deleted: going.map((one) => one.slug), trashed };
		},

		/** What is in the trash. */
		async listTrash() {
			return (await manager.listTrash()).filter((entry) => entry.kind === 'article');
		},

		/** Brings back a page from the trash (`trashed` as listed). */
		restorePage({ trashed }) {
			return manager.restoreArticle(trashed);
		},

		/** What would stop the blog's build, or show broken on the page, if it were published as it is now. */
		async checkPage({ slug }) {
			const { source } = await articles.read(slug);
			return checkArticle(blogRoot, slug, source);
		},

		/**
		 * Published: no longer a draft, after the check before publishing (refused
		 * when it finds what would stop the build). A page with a made-up folder
		 * name gets one read from its title, its address from now on (the links
		 * to it follow). The site goes up once it is pushed.
		 */
		async publishPage({ slug }) {
			const { source, properties } = await articles.read(slug);
			const errors = (await checkArticle(blogRoot, slug, source)).filter((issue) => issue.severity === 'error');
			if (errors.length) throw new StudioOpsError(`发布前检查没通过：${errors.map((issue) => issue.message).join('；')}`);
			await write(slug, updateStudioFrontmatter(source, { ...properties, draft: false }));
			let at = slug;
			if (isAutoSlug(slug)) {
				const wanted = readableSlug(properties.title);
				if (wanted && !isAutoSlug(wanted)) {
					at = freeSlug(wanted, (await pages()).map((page) => page.slug));
					await articles.rename(slug, at, { site });
				}
			}
			const page = await find(at);
			return { slug: at, address: address(page) };
		},

		/** A draft again: off the blog at its next build. */
		async unpublishPage({ slug }) {
			const { source, properties } = await articles.read(slug);
			await write(slug, updateStudioFrontmatter(source, { ...properties, draft: true }));
			return { slug, draft: true };
		},

		/** Commits the page's folder to git (and folders of pages gone), with `message`. Not pushed. */
		commitPage({ slug, message }) {
			return git.commit(slug, message);
		},

		/** What git has not committed yet, by page. */
		gitStatus() {
			return git.status();
		},

		/** The versions kept of a page (before each change made on disk, before restoring), newest first. */
		listHistory({ slug }) {
			return history.list(slug);
		},

		/** One kept version of a page: its whole Markdown. */
		async readHistory({ slug, name }) {
			return { slug, name, source: await history.read(slug, name) };
		},

		/** Files in the drive (资料库) whose name or words hold `query`: where the drive is, and each file's path in it. */
		/** @param {{ query: string, limit?: number }} args */
		async searchDrive({ query, limit }) {
			const root = await drive.root();
			if (!root) throw new StudioOpsError('还没有选资料库的文件夹（在 Studio 的「资料库」里选）');
			const found = await new DriveText(drive).search(query, { limit });
			return { root, ...found };
		},
	};
}
