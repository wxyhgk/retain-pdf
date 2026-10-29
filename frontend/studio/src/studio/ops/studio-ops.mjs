// What can be done to the blog's pages from outside the Studio: by a program, and above all by an AI
// (bin/studio.mjs on the command line, bin/studio-mcp.mjs as an MCP server). The same modules the
// Studio's server uses, on the same files, so the Studio, open or not, sees each change as any other
// made on disk (an article open in it shows the change to accept or reject).
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { comparePages } from '../../articles/page-order.mjs';
import { parseStudioDocument } from '@blog/document/parse.ts';
import { replaceStudioDocumentBody } from '@blog/document/serialize.ts';
import { updateStudioFrontmatter } from '@blog/document/frontmatter.ts';
import { checkArticle } from '../server/articles/article-check.mjs';
import { previewArticle } from '../server/articles/article-preview.mjs';
import { ArticleGit } from '../server/articles/article-git.mjs';
import { ArticleHistory } from '../server/articles/article-history.mjs';
import { ArticleRepository } from '../server/articles/article-repository.mjs';
import { MiniApps } from '../server/apps/mini-apps.mjs';
import { Repositories } from '../server/repos/repositories.mjs';
import { reposRootOf } from '../../articles/bundle-paths.mjs';
import { Drive } from '../server/drive/drive.mjs';
import { DriveText } from '../server/drive/drive-text.mjs';
import { ArticleFileManager, TRASH_FOLDER } from '../server/files/file-manager.mjs';
import { studioBlogRoot } from '../server/articles/page-version.mjs';
import { autoSlug, freeSlug, isAutoSlug, readableSlug } from '../pages/page-names.ts';
import { filesNamed } from '../editor/split-section.ts';
import { markdownOutline, markdownSection } from './markdown-section.mjs';
import { t } from '@blog/i18n/index.mjs';

/** A mistake in what was asked: said back as it is, not as a failure of the program. */
/** How much of a page is given at once (a tool's result is kept to 60 000 characters by pi): a longer one in parts. */
const PAGE_PART = 40_000;

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
	const manager = new ArticleFileManager(blogRoot, { trashRoot: testBlog ? resolve(testBlog, TRASH_FOLDER) : resolve(projectRoot, TRASH_FOLDER) });
	const git = new ArticleGit(blogRoot);
	const settingsFile = testBlog ? resolve(testBlog, '.studio-settings.json') : resolve(projectRoot, '.studio-settings.json');
	// 代码仓库: as the Studio has them (its own beside blog/; those added, in its settings); the tests' with no home of the author's looked through.
	const repositories = new Repositories({ ownRoot: reposRootOf(blogRoot), settingsFile, home: testBlog ? `${blogRoot}-home` : undefined });
	const drive = new Drive({ settingsFile, fixedRoot: process.env.STUDIO_DRIVE_DIR ? resolve(process.env.STUDIO_DRIVE_DIR) : null, forbidden: [projectRoot, blogRoot] });

	const pages = () => articles.list();
	const find = async (slug) => {
		const page = (await pages()).find((entry) => entry.slug === slug);
		if (!page) throw new StudioOpsError(t('没有文件夹名为 {slug} 的页面', { slug }));
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

		/**
		 * Every page (or those under `parent`, `''` for those at the top; of a `kind`; drafts or not): folder name,
		 * title, the page it is under, its order there, draft or not, kind, tags, address.
		 * @param {{ parent?: string, kind?: string, draft?: boolean }} [only]
		 */
		async listPages({ parent, kind, draft } = {}) {
			return (await pages())
				.filter((page) => (parent === undefined || (page.parent || '') === parent) && (kind === undefined || page.kind === kind) && (draft === undefined || Boolean(page.draft) === draft))
				.map((page) => ({ ...page, address: address(page) }));
		},

		/** The pages as a tree, each with those under it, in the order the Studio shows them. */
		async pageTree() {
			const all = await pages();
			const known = new Set(all.map((page) => page.slug));
			const node = (page) => ({ slug: page.slug, title: page.title, draft: page.draft, address: address(page), children: childrenOf(page.slug) });
			const childrenOf = (slug) => all.filter((page) => page.parent === slug && page.slug !== slug).sort(comparePages).map(node);
			return all.filter((page) => !page.parent || !known.has(page.parent)).sort(comparePages).map(node);
		},

		/**
		 * A page: its Markdown, its properties, what is wrong with them, how long it is. A long one in parts (up to
		 * PAGE_PART characters, cut at a line's end), each saying where the next begins and the heading after it;
		 * `outline`: its headings only; `heading`: the section that heading begins; `offset`, `limit`: a part of it.
		 * @param {{ slug: string, outline?: boolean, heading?: string, offset?: number, limit?: number }} args
		 */
		async readPage({ slug, outline = false, heading, offset, limit }) {
			const page = await articles.read(slug);
			const { source } = page;
			// Its headings in the text after its properties (`---` … `---`), where they are in the whole of it.
			const start = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u.exec(source)?.[0].length ?? 0;
			const skipped = source.slice(0, start).split('\n').length - 1;
			const headings = markdownOutline(source.slice(start)).map((entry) => ({ ...entry, line: entry.line + skipped, offset: entry.offset + start }));
			// After what is read (a reader that keeps only the start of a result keeps that).
			const about = { properties: page.properties, problems: page.problems, length: source.length, lines: source.split('\n').length };
			const headingAfter = (at) => headings.find((entry) => entry.offset >= at)?.title ?? null;
			if (outline) return { slug, outline: headings.map(({ depth, title, line }) => ({ depth, title, line })), ...about };
			if (typeof heading === 'string' && heading.trim()) {
				const section = markdownSection(source, heading);
				if (!section) throw new StudioOpsError(t('这一页没有标题「{heading}」：先用 outline 看有哪些标题', { heading: heading.trim() }));
				return { slug, heading: section.title, source: source.slice(section.from, section.to), nextHeading: headingAfter(section.to), ...about };
			}
			const from = Math.max(0, Math.min(Number.isInteger(offset) ? offset : 0, source.length));
			let to = Math.min(source.length, from + Math.max(1, Math.min(Number.isInteger(limit) ? limit : PAGE_PART, PAGE_PART)));
			// At a line's end, where there is one in the part.
			if (to < source.length) {
				const end = source.lastIndexOf('\n', to);
				if (end > from) to = end + 1;
			}
			if (from === 0 && to === source.length) return { slug, source, ...about };
			return {
				slug,
				note: `只给了这一部分（第 ${from}–${to} 个字符，共 ${source.length}）：用 offset 读后面的，或用 outline 看目录、用 heading 读一节`, // i18n-ignore: for the AI
				from,
				to,
				next: to < source.length ? to : null,
				nextHeading: to < source.length ? headingAfter(to) : null,
				source: source.slice(from, to),
				...about,
			};
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
			if (!title?.trim()) throw new StudioOpsError(t('标题不能为空'));
			const all = await pages();
			if (parent && !all.some((page) => page.slug === parent)) throw new StudioOpsError(t('上级页面 {parent} 不存在', { parent }));
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
			if (!section) throw new StudioOpsError(t('这篇里没有标题「{heading}」', { heading }));
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
			const issues = await checkArticle(blogRoot, slug, source);
			const errors = issues.filter((issue) => issue.severity === 'error').length;
			// Said in so many words: nothing found is passed, not a check that did not run.
			return { ok: errors === 0, errors, warnings: issues.length - errors, issues };
		},

		/** How the page shows, block by block, in words (article-preview.mjs). */
		async previewPage({ slug, from }) {
			const { source } = await articles.read(slug);
			return previewArticle(blogRoot, slug, source, { from: Number.isInteger(from) && from > 0 ? from : 1 });
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
			if (errors.length) throw new StudioOpsError(t('发布前检查没通过：{problems}', { problems: errors.map((issue) => issue.message).join('；') }));
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

		/** What git has not committed yet, by page; of one page (`slug`): new, modified, vanished, or clean. */
		async gitStatus({ slug } = {}) {
			const status = await git.status();
			if (typeof slug !== 'string' || !slug) return status;
			const state = status.changed[slug] ?? (status.vanished.includes(slug) ? 'vanished' : 'clean');
			return { available: status.available, slug, state };
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
			if (!root) throw new StudioOpsError(t('还没有选资料库的文件夹（在 Studio 的「资料库」里选）'));
			const found = await new DriveText(drive).search(query, { limit });
			return { root, ...found };
		},

		/** The author's apps (apps/): what each is, where its code is, the blocks it gives. */
		async listApps() {
			const apps = new MiniApps(resolve(projectRoot, 'apps'));
			return Promise.all((await apps.list()).map(async (app) => ({
				id: app.id,
				name: app.name,
				description: app.description,
				kind: app.kind,
				folder: `apps/${app.id}`,
				...(app.kind === 'project' ? { code: relative(projectRoot, (await apps.root(app.id)) ?? '') || '.' } : {}),
				blocks: app.blocks.map((block) => block.fence),
				...(app.problem ? { problem: app.problem } : {}),
			})));
		},

		/** 代码仓库: the repositories it shows (the Studio's own in repos/, and those of this machine added). */
		async listRepos() {
			return repositories.list();
		},

		/** One of this machine added to 代码仓库; or, `found`, those in the usual places not added yet. */
		async addRepo({ path, found } = {}) {
			if (found) return { found: await repositories.discover() };
			if (!path) throw new StudioOpsError(t('要给出仓库的路径，或者 found: true 先找一找'));
			return { added: await repositories.add(path) };
		},

		/** A repository of the Studio's own made: repos/<name>/, git, a README, committed. */
		async createRepo({ name, description }) {
			return { created: await repositories.create({ name, description }) };
		},

		/** One added taken off 代码仓库's list (its folder left as it is). */
		async removeRepo({ id }) {
			return { removed: await repositories.remove(id) };
		},

		/** How an app is now, asked of the Studio running (its server's state and output, its pages' errors). */
		async appStatus({ id }) {
			// Where the Studio says it runs: its own server's file, or (one run by astro dev, as before) Astro's.
			const said = (file) => readFile(resolve(projectRoot, file), 'utf8').then((text) => JSON.parse(text).url, () => null);
			const url = process.env.STUDIO_URL || (await said('.studio-cache/server.json')) || (await said('.astro/dev.json'));
			if (!url) throw new StudioOpsError(t('Studio 没有开着：小程序的状态要在 Studio 开着时才看得到'));
			const answer = await fetch(new URL(`/api/studio/apps/${encodeURIComponent(String(id ?? ''))}/status`, url)).catch(() => null);
			if (!answer) throw new StudioOpsError(t('连不上 Studio（{url}）', { url }));
			const status = await answer.json();
			if (!answer.ok) throw new StudioOpsError(status.error ?? t('没有这个小程序'));
			return { id, state: status.state, error: status.error, errors: status.errors, log: String(status.log ?? '').split('\n').slice(-60).join('\n') };
		},
	};
}
