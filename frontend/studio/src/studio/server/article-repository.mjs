import { cp, lstat, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { setFrontmatterField, updateStudioFrontmatter } from '../document/frontmatter.ts';
import { comparePages } from '../../articles/page-order.mjs';
import { atomicWriteText, contentRevision } from './atomic-write.mjs';
import { DEFAULT_ARTICLE_VIEWS, readMoleculeViews, writeMoleculeView } from '../../articles/article-views.mjs';
import { articleBundlePaths, assertArticleSlug, resolveInside, StudioPathError } from '../../articles/bundle-paths.mjs';
import { ARTICLE_FOLDERS, SLUG_PATTERN } from '@blog/markdown/articles/rules.mjs';
import { findArticleLinks, relinkArticle } from '@blog/markdown/articles/article-links.mjs';
import { ArticleValidationError, articleMacros, articleProblems, articleProperties, articleSummary, createArticleSource } from '../../articles/schemas.mjs';

/** What the editor must have read for a change to apply: the article's text and its saved views. */
function bundleRevision(source, viewsSource) {
	return contentRevision(`${source}\0${viewsSource}`);
}

async function readViewsSource(path) {
	try {
		return await readFile(path, 'utf8');
	} catch (error) {
		if (error?.code === 'ENOENT') return DEFAULT_ARTICLE_VIEWS;
		throw error;
	}
}

export class ArticleRepository {
	/** Per article, the end of its queue of writes. */
	#writes = new Map();

	constructor(blogRoot) {
		this.blogRoot = resolve(blogRoot);
	}

	/**
	 * Runs `task` once the article's earlier writes are done. A write reads
	 * the article, checks its revision and writes it back; two of them at once
	 * could both pass the check and the later one silently undo the earlier.
	 */
	exclusive(slug, task) {
		const run = (this.#writes.get(slug) ?? Promise.resolve()).then(task);
		const done = run.catch(() => {});
		this.#writes.set(slug, done);
		done.then(() => {
			if (this.#writes.get(slug) === done) this.#writes.delete(slug);
		});
		return run;
	}

	/**
	 * Every article, by title: what the sidebar shows, and the properties the
	 * table of all articles sorts and filters by, with when its text last changed.
	 */
	async list() {
		const articles = [];
		for (const { slug, source, modified } of await this.#sources()) {
			const { pubDate, description } = articleProperties(source, slug);
			articles.push({ slug, ...articleSummary(source, slug), pubDate, description, modified });
		}
		articles.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN', { numeric: true }));
		return articles;
	}

	/**
	 * The articles that link to `slug` (findArticleLinks), each with where and
	 * in what words; `site` is the blog's address, for links written in full.
	 */
	async backlinks(slug, { site } = {}) {
		assertArticleSlug(slug);
		const found = [];
		for (const { slug: from, source } of await this.#sources()) {
			if (from === slug) continue;
			const mentions = findArticleLinks(source, { site }).filter((link) => link.slug === slug);
			if (!mentions.length) continue;
			const { title, icon, draft } = articleSummary(source, from);
			found.push({ slug: from, title, icon, draft, mentions: mentions.map(({ line, text, context }) => ({ line, text, context })) });
		}
		return found.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
	}

	/** Each article's folder name, its `index.md`, and when that last changed. */
	async #sources() {
		let entries;
		try {
			entries = await readdir(this.blogRoot, { withFileTypes: true });
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}
		const sources = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.isSymbolicLink() || !SLUG_PATTERN.test(entry.name)) continue;
			const markdown = articleBundlePaths(this.blogRoot, entry.name).markdown;
			try {
				const [source, info] = await Promise.all([readFile(markdown, 'utf8'), stat(markdown)]);
				sources.push({ slug: entry.name, source, modified: info.mtimeMs });
			} catch (error) {
				if (error?.code !== 'ENOENT') throw error;
			}
		}
		return sources;
	}

	/**
	 * The articles whose title or text holds `query`, ignoring case: titles
	 * first, then by how often the text holds it, each with a few of the
	 * lines it is in (`line` counts in the whole file).
	 */
	async search(query, { limit = 30, perArticle = 3 } = {}) {
		const needle = typeof query === 'string' ? query.trim().toLocaleLowerCase('zh-CN') : '';
		if (!needle) return [];
		const results = [];
		for (const { slug, title, icon } of await this.list()) {
			let source;
			try {
				source = await readFile(articleBundlePaths(this.blogRoot, slug).markdown, 'utf8');
			} catch {
				continue;
			}
			// The properties are not the text: blank lines in their place keep the count.
			const body = source.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, (block) => block.replace(/[^\n]/gu, ''));
			const lines = body.split('\n');
			const matches = [];
			let count = 0;
			lines.forEach((text, index) => {
				if (!text.toLocaleLowerCase('zh-CN').includes(needle)) return;
				count += 1;
				// The line as read: without the marks that make it a heading, quote or list item.
				const shown = text.trim().replace(/^(?:#{1,6}|>|[-*+]|\d+[.)])\s+/u, '');
				if (matches.length < perArticle) matches.push({ line: index + 1, text: shown.slice(0, 240) });
			});
			const inTitle = title.toLocaleLowerCase('zh-CN').includes(needle) || slug.includes(needle);
			if (inTitle || count) results.push({ slug, title, icon, inTitle, count, matches });
		}
		results.sort((left, right) => Number(right.inTitle) - Number(left.inTitle) || right.count - left.count);
		return results.slice(0, limit).map(({ count, ...result }) => result);
	}

	/**
	 * A new article: a draft titled `title`, under `parent` when given. With
	 * `body`, that is its text (a section of its parent, 转成子页面), and the
	 * parent's files it names (`files`: `img/…`, `assets/…`) are copied into
	 * its own folder, where its `./img/…` links then find them.
	 */
	async create({ slug, title, parent = '', body = '', files = [] }) {
		assertArticleSlug(slug);
		if (parent) assertArticleSlug(parent);
		if (typeof body !== 'string' || !Array.isArray(files)) throw new ArticleValidationError('新文章的内容无效');
		const paths = articleBundlePaths(this.blogRoot, slug);
		try {
			await stat(paths.directory);
			throw new ArticleConflictError('该文章目录已经存在');
		} catch (error) {
			if (error instanceof ArticleConflictError) throw error;
			if (error?.code !== 'ENOENT') throw error;
		}

		const source = createArticleSource({ title, parent, body });
		await Promise.all(ARTICLE_FOLDERS.map((name) => mkdir(paths[name], { recursive: true })));
		await Promise.all([
			writeFile(paths.markdown, source, { encoding: 'utf8', flag: 'wx' }),
			writeFile(paths.views, DEFAULT_ARTICLE_VIEWS, { encoding: 'utf8', flag: 'wx' }),
		]);
		if (parent) {
			const from = articleBundlePaths(this.blogRoot, parent).directory;
			for (const file of files) {
				// Only the parent's published folders, and only what is there.
				if (typeof file !== 'string' || !/^(?:img|assets)\//u.test(file)) continue;
				const source = resolveInside(from, file);
				const target = resolveInside(paths.directory, file);
				try {
					if (!(await lstat(source)).isFile()) continue;
				} catch {
					continue;
				}
				await mkdir(dirname(target), { recursive: true });
				await cp(source, target, { errorOnExist: false, force: false });
			}
		}
		return { slug };
	}

	/**
	 * Gives the article another folder name, which is its address on the blog
	 * (`/blog/<slug>/`). Its text says nothing of its folder, so nothing in it
	 * changes; the pages under it (`parent:` its old name) are put under its new one.
	 */
	rename(slug, to, { site } = {}) {
		return this.exclusive(slug, async () => {
			const from = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(from);
			if (to === slug) return { slug, relinked: 0 };
			const target = articleBundlePaths(this.blogRoot, to);
			await assertFree(target.directory);
			await rename(from.directory, target.directory);
			for (const child of await this.#children(slug)) await this.#writeParent(child, to);
			// The links to it in the articles (its own too) follow it to its new address.
			let relinked = 0;
			for (const { slug: page, source } of await this.#sources()) {
				const { source: next, changed } = relinkArticle(source, slug, to, { site });
				if (!changed) continue;
				await atomicWriteText(articleBundlePaths(this.blogRoot, page).markdown, next);
				relinked += 1;
			}
			return { slug: to, relinked };
		});
	}

	/**
	 * Puts the article under another page (`parent:` its folder name), or, with
	 * `parent` empty, at the top. Not under itself, nor under a page under it.
	 * With `before` or `after` (a page under the same one), just there among
	 * them: those pages are numbered again (`order:` 10, 20, …) in the order
	 * they then have. Without, after the pages given an order there, if any.
	 */
	setParent(slug, parent, { before = '', after = '' } = {}) {
		assertArticleSlug(slug);
		if (parent) assertArticleSlug(parent);
		return this.exclusive(slug, async () => {
			await assertReadableBundle(articleBundlePaths(this.blogRoot, slug));
			const pages = (await this.#sources()).map(({ slug: page, source }) => ({ slug: page, source, ...articleSummary(source, page) }));
			const bySlug = new Map(pages.map((page) => [page.slug, page]));
			if (parent) {
				if (!bySlug.has(parent)) throw new ArticleNotFoundError('上级页面不存在');
				for (let at = parent, steps = 0; at && steps <= pages.length; at = bySlug.get(at)?.parent ?? '', steps += 1) {
					if (at === slug) throw new ArticleValidationError('不能放到它自己或它下面的页面下面');
				}
			}
			const next = bySlug.get(before || after);
			if ((before || after) && (!next || next.parent !== parent || next.slug === slug)) throw new ArticleValidationError('要放在旁边的页面不在那里');
			const siblings = pages.filter((page) => page.parent === parent && page.slug !== slug).sort(comparePages);
			const moved = bySlug.get(slug);
			if (next) {
				const index = siblings.indexOf(next) + (after ? 1 : 0);
				const placed = [...siblings.slice(0, index), moved, ...siblings.slice(index)];
				for (const [index, page] of placed.entries()) {
					if (page === moved) await this.#writeFields(slug, { parent, order: (index + 1) * 10 });
					else if (page.order !== (index + 1) * 10) await this.#writeFields(page.slug, { order: (index + 1) * 10 });
				}
				return { slug, parent };
			}
			const ordered = siblings.filter((page) => typeof page.order === 'number');
			const last = ordered.length ? Math.max(...ordered.map((page) => page.order)) : null;
			await this.#writeFields(slug, { parent, order: last === null ? null : last + 10 });
			return { slug, parent };
		});
	}

	/**
	 * 并入上级页面 (the way back from 转成子页面): the article's text goes into
	 * the page it is under, as a section headed by its title, in place of a
	 * line that is only a link to it, or at the end; its files are copied to
	 * that page's folder (its own names kept: one there already stays), the
	 * pages under it go under that page, and links to it go to that page.
	 * `before(parent, source)` is told the parent's text as it was, first. The
	 * article itself is left for the caller to put in the trash.
	 */
	merge(slug, { site, before } = {}) {
		assertArticleSlug(slug);
		return this.exclusive(slug, async () => {
			const own = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(own);
			const source = await readFile(own.markdown, 'utf8');
			const { title, parent } = articleSummary(source, slug);
			if (!parent) throw new ArticleValidationError('它不在别的页面下面，没有可以并入的上级');
			const above = articleBundlePaths(this.blogRoot, parent);
			await assertReadableBundle(above);
			const parentSource = await readFile(above.markdown, 'utf8');
			await before?.(parent, parentSource);
			const body = source.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, '').trim();
			const section = `## ${title}\n\n${body}`.trim();
			const linkLine = new RegExp(`^[ \\t]*\\[[^\\]\\n]*\\]\\((?:https?://[^)\\s]*)?/(?:blog|wiki)/${slug}/?\\)[ \\t]*$`, 'mu');
			const merged = linkLine.test(parentSource)
				? parentSource.replace(linkLine, () => section)
				: `${parentSource.replace(/\s*$/u, '')}\n\n${section}\n`;
			await atomicWriteText(above.markdown, merged);
			for (const folder of ['img', 'assets']) {
				try {
					await cp(resolveInside(own.directory, folder), resolveInside(above.directory, folder), { recursive: true, errorOnExist: false, force: false });
				} catch (error) {
					if (error?.code !== 'ENOENT') throw error;
				}
			}
			for (const child of await this.#children(slug)) await this.#writeParent(child, parent);
			for (const { slug: page, source: text } of await this.#sources()) {
				if (page === slug) continue;
				const { source: next, changed } = relinkArticle(text, slug, parent, { site });
				if (changed) await atomicWriteText(articleBundlePaths(this.blogRoot, page).markdown, next);
			}
			return { slug, parent };
		});
	}

	/** The folder names of the pages right under `slug`. */
	async #children(slug) {
		return (await this.#sources()).filter(({ source, slug: page }) => articleSummary(source, page).parent === slug).map(({ slug: page }) => page);
	}

	async #writeParent(slug, parent) {
		await this.#writeFields(slug, { parent });
	}

	/** Sets the tree's fields given (`parent`, `order`; empty or null takes one out), the rest of the text as it was. */
	async #writeFields(slug, fields) {
		const { markdown } = articleBundlePaths(this.blogRoot, slug);
		const source = await readFile(markdown, 'utf8');
		let next = source;
		for (const [key, value] of Object.entries(fields)) next = setFrontmatterField(next, key, value);
		if (next !== source) await atomicWriteText(markdown, next);
	}

	/**
	 * Copies the article, its files and saved views, into a new folder: a
	 * draft dated today, its title marked 副本, the rest of its text as it is.
	 */
	duplicate(slug, to, { now = new Date() } = {}) {
		return this.exclusive(slug, async () => {
			const from = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(from);
			const target = articleBundlePaths(this.blogRoot, to);
			await assertFree(target.directory);
			await cp(from.directory, target.directory, {
				recursive: true,
				errorOnExist: true,
				force: false,
				// Links and hidden files (.DS_Store, an upload under way) stay behind.
				filter: async (path) => !basename(path).startsWith('.') && !(await lstat(path)).isSymbolicLink(),
			});
			const source = await readFile(target.markdown, 'utf8');
			const properties = articleProperties(source, slug);
			try {
				const copy = updateStudioFrontmatter(source, {
					...properties,
					title: `${properties.title}（副本）`,
					pubDate: now.toISOString().slice(0, 10),
					draft: true,
				});
				await atomicWriteText(target.markdown, copy);
			} catch {
				// Properties it cannot change (broken YAML): the copy keeps them as they are.
			}
			return { slug: to };
		});
	}

	async read(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [source, viewsSource, info] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views), stat(paths.markdown)]);
		const revision = bundleRevision(source, viewsSource);
		return {
			// When its text last changed, in milliseconds.
			modified: info.mtimeMs,
			slug,
			content: source,
			hash: revision,
			source,
			revision,
			properties: articleProperties(source, slug),
			problems: articleProblems(source),
			macros: articleMacros(source),
			chemistryViews: readMoleculeViews(viewsSource),
		};
	}

	/** The article's text files as they are now, with the revision they make together. */
	async snapshot(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [source, viewsSource] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views)]);
		return { paths, source, viewsSource, revision: bundleRevision(source, viewsSource) };
	}

	/**
	 * Writes a new `index.md` and `article.views.json` computed from `snapshot`.
	 * Only files that differ are written. Take the snapshot and write it
	 * within one `exclusive`, or another write may come in between.
	 */
	async writeSnapshot(snapshot, { source, viewsSource }) {
		if (source !== snapshot.source) await atomicWriteText(snapshot.paths.markdown, source);
		if (viewsSource !== snapshot.viewsSource) await atomicWriteText(snapshot.paths.views, viewsSource);
		return bundleRevision(source, viewsSource);
	}

	save(slug, change) {
		return this.exclusive(slug, () => this.#save(slug, change));
	}

	async #save(slug, { content, source, expectedHash, expectedRevision }) {
		const nextSource = source ?? content;
		if (typeof nextSource !== 'string') throw new ArticleValidationError('文章内容必须是文本');
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [current, viewsSource] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views)]);
		const currentRevision = bundleRevision(current, viewsSource);
		// Already so: a save sent again (its answer lost on the way) is the same save, not someone else's change.
		if (current === nextSource) return { hash: currentRevision, revision: currentRevision, problems: articleProblems(current) };
		const expected = expectedRevision ?? expectedHash;
		if (expected && currentRevision !== expected) {
			throw new ArticleConflictError('文件已被其他程序修改，请重新载入后再保存');
		}
		// Saved even when the properties are wrong, so nothing typed is lost; `problems` says what to fix.
		await atomicWriteText(paths.markdown, nextSource);
		const revision = bundleRevision(nextSource, viewsSource);
		return { hash: revision, revision, problems: articleProblems(nextSource) };
	}

	saveMoleculeView(slug, key, change) {
		return this.exclusive(slug, () => this.#saveMoleculeView(slug, key, change));
	}

	async #saveMoleculeView(slug, key, { format, view, display, expectedRevision }) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [source, viewsSource] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views)]);
		const currentRevision = bundleRevision(source, viewsSource);
		if (expectedRevision && currentRevision !== expectedRevision) {
			throw new ArticleConflictError('文章或视角配置已被其他程序修改，请重新载入后再保存');
		}
		const nextViewsSource = writeMoleculeView(viewsSource, key, format, view, display);
		await atomicWriteText(paths.views, nextViewsSource);
		const revision = bundleRevision(source, nextViewsSource);
		return { revision, chemistryViews: readMoleculeViews(nextViewsSource) };
	}
}

async function assertReadableBundle(paths) {
	const [directory, markdown] = await Promise.all([lstat(paths.directory), lstat(paths.markdown)]).catch((error) => {
		if (error?.code === 'ENOENT') throw new ArticleNotFoundError();
		throw error;
	});
	if (directory.isSymbolicLink() || !directory.isDirectory() || markdown.isSymbolicLink() || !markdown.isFile()) {
		throw new StudioPathError('文章目录包含不允许的符号链接或文件类型');
	}
}

/** No article, or anything else, has this folder yet. */
async function assertFree(directory) {
	try {
		await lstat(directory);
	} catch (error) {
		if (error?.code === 'ENOENT') return;
		throw error;
	}
	throw new ArticleConflictError(`已经有一篇叫 ${basename(directory)} 的文章了`);
}

export class ArticleNotFoundError extends Error {
	constructor(message = '文章不存在') {
		super(message);
		this.name = 'ArticleNotFoundError';
		this.statusCode = 404;
	}
}

export class ArticleConflictError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ArticleConflictError';
		this.statusCode = 409;
	}
}
