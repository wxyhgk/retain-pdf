import { cp, lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { setFrontmatterField, updateStudioFrontmatter } from '@blog/document/frontmatter.ts';
import { comparePages } from '../../../articles/page-order.mjs';
import { atomicWriteText, contentRevision } from '../files/atomic-write.mjs';
import { pictureSizes } from './picture-sizes.mjs';
import { DEFAULT_ARTICLE_VIEWS, readMoleculeViews, writeMoleculeView } from '../../../articles/article-views.mjs';
import { articleBundlePaths, assertArticleSlug, resolveInside, StudioPathError } from '../../../articles/bundle-paths.mjs';
import { ARTICLE_FOLDERS, SLUG_PATTERN } from '@blog/markdown/articles/rules.mjs';
import { findArticleLinks, relinkArticle, retitleArticleLinks } from '@blog/markdown/articles/article-links.mjs';
import { relinkDatabases } from '../../../articles/database-blocks.mjs';
import { parseBibtex } from '@blog/markdown/references/bibtex.mjs';
import { ArticleValidationError, articleMacros, articleProblems, articleProperties, articleSummary, createArticleSource } from '../../../articles/schemas.mjs';
import { t } from '@blog/i18n/index.mjs';

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

/** A line that is only a link to the page `slug`: the page block the editor shows for it. */
const pageBlockLine = (slug) => new RegExp(`^[ \\t]*\\[(?:\\\\.|[^\\]\\\\\\n])*\\]\\((?:https?://[^)\\s]*)?/(?:blog|wiki)/${slug}/?\\)[ \\t]*$`, 'u');

/**
 * The page `slug` as a page block at the end of `source`, unless one is there already, or `source` is a database's (the
 * pages under it are its rows, not links in it).
 */
export function withPageBlock(source, slug, title) {
	if (articleSummary(source, '').type === 'database') return source;
	if (source.split('\n').some((line) => pageBlockLine(slug).test(line))) return source;
	return `${source.replace(/\s*$/u, '')}\n\n[${title.replace(/[[\]\\]/gu, '\\$&')}](/blog/${slug}/)\n`;
}

/** `source` without the page blocks of `slug` (lines that are only a link to it), nor the blank line each leaves. */
export function withoutPageBlock(source, slug) {
	const lines = source.split('\n');
	for (let at = lines.length - 1; at >= 0; at -= 1) {
		if (!pageBlockLine(slug).test(lines[at])) continue;
		lines.splice(at, 1);
		if (lines[at - 1] === '' && (lines[at] === '' || at === lines.length)) lines.splice(at - 1, 1);
	}
	return lines.join('\n');
}

export class ArticleRepository {
	/** Per article, the end of its queue of writes. */
	#writes = new Map();
	/** Per article whose title is being changed: the title it had, the newest, and when the links follow. */
	#titles = new Map();
	/** Per article, the page it is under as last seen (`followParents`); null till first looked at. */
	#parents = null;
	/**
	 * Per article, the links in its text as last read (`{ source, site, links }`): each article opened asks what
	 * links to it, and reading every article's Markdown again each time took most of a second (two OCR'd books),
	 * with what was clicked next waiting behind it.
	 */
	#links = new Map();

	/**
	 * @param {string} blogRoot
	 * @param {{ keep?: (slug: string, source: string) => unknown, retitleAfter?: number }} [options]
	 * `keep`: keeps a page's text as a version before the Studio rewrites it for another page's change
	 * (the links to a page renamed, retitled, merged). `retitleAfter`: how long a title stays as typed
	 * before the links that were its title follow it (ms; 0: at once), so a title typed one letter at a
	 * time is followed once, from what it was to what it became.
	 */
	constructor(blogRoot, { keep = null, retitleAfter = 0 } = {}) {
		this.blogRoot = resolve(blogRoot);
		this.keep = keep;
		this.retitleAfter = retitleAfter;
	}

	/**
	 * Runs `task` once the article's earlier writes are done. A write reads
	 * the article, checks its revision and writes it back; two of them at once
	 * could both pass the check and the later one silently undo the earlier.
	 * What changes other articles too changes them each in its own queue,
	 * after its own (#rewrite): never one queue waiting on another's, which
	 * two such changes at once could do the other way round, forever.
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
			// Not named (an empty title): listed as 无标题, as Notion lists Untitled; `untitled` says it is not a title.
			const summary = articleSummary(source, '');
			const untitled = !summary.title;
			articles.push({ slug, ...summary, title: summary.title || t('无标题'), ...(untitled ? { untitled } : {}), pubDate, description, modified });
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
		const sources = await this.#sources();
		for (const { slug: from, source } of sources) {
			if (from === slug) continue;
			const mentions = this.#linksIn(from, source, site).filter((link) => link.slug === slug);
			if (!mentions.length) continue;
			const { title, icon, draft } = articleSummary(source, from);
			found.push({ slug: from, title, icon, draft, mentions: mentions.map(({ line, text, context }) => ({ line, text, context })) });
		}
		// Those gone from disk are forgotten.
		const there = new Set(sources.map((entry) => entry.slug));
		for (const page of this.#links.keys()) if (!there.has(page)) this.#links.delete(page);
		return found.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
	}

	/** The links in `page`'s text: read again only when the text is not what was read before. */
	#linksIn(page, source, site) {
		const known = this.#links.get(page);
		if (known && known.source === source && known.site === site) return known.links;
		const links = findArticleLinks(source, { site });
		this.#links.set(page, { source, site, links });
		return links;
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
	async create({ slug, title, parent = '', body = '', files = [], type = '' }) {
		assertArticleSlug(slug);
		if (parent) assertArticleSlug(parent);
		if (typeof body !== 'string' || !Array.isArray(files)) throw new ArticleValidationError(t('新文章的内容无效'));
		const paths = articleBundlePaths(this.blogRoot, slug);
		const source = createArticleSource({ title, parent, body, type });
		// Making the folder is taking the name: two made at once, one of them is refused.
		try {
			await mkdir(paths.directory);
		} catch (error) {
			if (error?.code === 'EEXIST') throw new ArticleConflictError(t('该文章目录已经存在'));
			throw error;
		}
		try {
			await Promise.all(ARTICLE_FOLDERS.map((name) => mkdir(paths[name], { recursive: true })));
			await Promise.all([
				writeFile(paths.markdown, source, { encoding: 'utf8', flag: 'wx' }),
				writeFile(paths.views, DEFAULT_ARTICLE_VIEWS, { encoding: 'utf8', flag: 'wx' }),
			]);
			if (parent) await this.#copyParentFiles(parent, paths.directory, body, files);
		} catch (error) {
			// Not half an article.
			await rm(paths.directory, { recursive: true, force: true }).catch(() => {});
			throw error;
		}
		return { slug };
	}

	/**
	 * The parent's files a section taken from it names (`img/…`, `assets/…`), copied into the new page's
	 * folder; its library (assets/refs.bib) too when the section cites. Only files really in the parent's
	 * folder: a folder there that is a link to elsewhere is not followed.
	 */
	async #copyParentFiles(parent, into, body, files) {
		const from = articleBundlePaths(this.blogRoot, parent).directory;
		const root = await realpath(from);
		const wanted = new Set(files.filter((file) => typeof file === 'string' && /^(?:img|assets)\//u.test(file)));
		if (CITATION.test(body)) wanted.add('assets/refs.bib');
		for (const file of wanted) {
			let real;
			try {
				real = await realpath(resolveInside(from, file));
				if (!isInside(root, real) || !(await lstat(real)).isFile()) continue;
			} catch {
				continue;
			}
			const target = resolveInside(into, file);
			await mkdir(dirname(target), { recursive: true });
			await cp(real, target, { errorOnExist: false, force: false });
		}
	}

	/**
	 * Gives the article another folder name, which is its address on the blog
	 * (`/blog/<slug>/`). Its text says nothing of its folder, so nothing in it
	 * changes; the pages under it (`parent:` its old name) are put under its new one.
	 */
	async rename(slug, to, { site } = {}) {
		const moved = await this.exclusive(slug, async () => {
			const from = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(from);
			if (to === slug) return false;
			const target = articleBundlePaths(this.blogRoot, to);
			await assertFree(target.directory);
			await rename(from.directory, target.directory);
			return true;
		});
		if (!moved) return { slug, relinked: 0 };
		for (const child of await this.#children(slug)) await this.#rewrite(child, (source) => withFields(source, { parent: to }));
		// The links to it in the articles (its own too) follow it to its new address.
		let relinked = 0;
		for (const { slug: page, source } of await this.#sources()) {
			if (!source.includes(slug)) continue;
			// A database's blocks in other pages name it by its folder.
			if (await this.#rewrite(page, (text) => relinkDatabases(relinkArticle(text, slug, to, { site }).source, slug, to), { keep: true })) relinked += 1;
		}
		return { slug: to, relinked };
	}

	/**
	 * Puts the article under another page (`parent:` its folder name), or, with
	 * `parent` empty, at the top. Not under itself, nor under a page under it.
	 * With `before` or `after` (a page under the same one), just there among
	 * them: those pages are numbered again (`order:` 10, 20, …) in the order
	 * they then have. Without, after the pages given an order there, if any.
	 */
	async setParent(slug, parent, { before = '', after = '' } = {}) {
		assertArticleSlug(slug);
		if (parent) assertArticleSlug(parent);
		// The pages around it numbered again, each in its own queue once this one's is done.
		const others = await this.exclusive(slug, async () => {
			await assertReadableBundle(articleBundlePaths(this.blogRoot, slug));
			const pages = (await this.#sources()).map(({ slug: page, source }) => ({ slug: page, source, ...articleSummary(source, page) }));
			const bySlug = new Map(pages.map((page) => [page.slug, page]));
			if (parent) {
				if (!bySlug.has(parent)) throw new ArticleNotFoundError(t('上级页面不存在'));
				for (let at = parent, steps = 0; at && steps <= pages.length; at = bySlug.get(at)?.parent ?? '', steps += 1) {
					if (at === slug) throw new ArticleValidationError(t('不能放到它自己或它下面的页面下面'));
				}
			}
			const next = bySlug.get(before || after);
			if ((before || after) && (!next || next.parent !== parent || next.slug === slug)) throw new ArticleValidationError(t('要放在旁边的页面不在那里'));
			const siblings = pages.filter((page) => page.parent === parent && page.slug !== slug).sort(comparePages);
			const moved = bySlug.get(slug);
			const was = { from: moved.parent ?? '', title: moved.title || slug };
			// Under another page now: no longer a row of a database of the one it left.
			const left = (moved.parent ?? '') !== parent && moved.database ? { database: null } : {};
			if (next) {
				const index = siblings.indexOf(next) + (after ? 1 : 0);
				const placed = [...siblings.slice(0, index), moved, ...siblings.slice(index)];
				const renumbered = [];
				for (const [index, page] of placed.entries()) {
					if (page === moved) await this.#writeFields(slug, { parent, order: (index + 1) * 10, ...left });
					else if (page.order !== (index + 1) * 10) renumbered.push([page.slug, (index + 1) * 10]);
				}
				return { ...was, renumbered };
			}
			const ordered = siblings.filter((page) => typeof page.order === 'number');
			const last = ordered.length ? Math.max(...ordered.map((page) => page.order)) : null;
			await this.#writeFields(slug, { parent, order: last === null ? null : last + 10, ...left });
			return { ...was, renumbered: [] };
		});
		for (const [page, order] of others.renumbered) await this.#rewrite(page, (source) => withFields(source, { order }));
		this.#parents?.set(slug, parent);
		// As Notion has it: a page moved under another is a page block at the end of it, and no longer one in the page
		// it left (only a line that is just a link to it; a link in a sentence stays).
		if (others.from !== parent) {
			if (others.from) await this.#rewrite(others.from, (source) => withoutPageBlock(source, slug));
			if (parent) await this.#rewrite(parent, (source) => withPageBlock(source, slug, others.title));
		}
		return { slug, parent };
	}

	/**
	 * Pages whose place (`parent:`) was written by someone else (an AI editing the file, another editor): as when one is
	 * moved here (`setParent`), the page it went under gets a page block for it at its end, and the one it left loses
	 * its own. A page not seen before (new, or back from the trash) is only learned: it was not moved. The first call
	 * (with none) learns where every page is.
	 */
	async followParents(slugs = []) {
		if (!this.#parents) {
			this.#parents = new Map();
			for (const { slug, source } of await this.#sources()) this.#parents.set(slug, articleSummary(source, slug).parent ?? '');
			return;
		}
		for (const slug of new Set(slugs)) {
			let source;
			try {
				source = await readFile(articleBundlePaths(this.blogRoot, slug).markdown, 'utf8');
			} catch {
				// Gone (to the trash), or not an article.
				this.#parents.delete(slug);
				continue;
			}
			const { parent = '', title } = articleSummary(source, '');
			const from = this.#parents.get(slug);
			this.#parents.set(slug, parent);
			if (from === undefined || from === parent) continue;
			if (from) await this.#rewrite(from, (text) => withoutPageBlock(text, slug));
			if (parent) await this.#rewrite(parent, (text) => withPageBlock(text, slug, title || '无标题')); // i18n-ignore: the words of the link to it
		}
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
	async merge(slug, { site, before } = {}) {
		assertArticleSlug(slug);
		const parent = await this.exclusive(slug, async () => {
			const own = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(own);
			const source = await readFile(own.markdown, 'utf8');
			const { title, parent } = articleSummary(source, slug);
			if (!parent) throw new ArticleValidationError(t('它不在别的页面下面，没有可以并入的上级'));
			const above = articleBundlePaths(this.blogRoot, parent);
			// The parent's queue inside this one's: never the other way round (a page is not above its parent).
			await this.exclusive(parent, async () => {
				await assertReadableBundle(above);
				const parentSource = await readFile(above.markdown, 'utf8');
				// Its files first, so what the section links to is there once the section is; one of the same name
				// that is another file is copied under another name, and the section's links to it changed.
				const renamed = await mergeFiles(own.directory, above.directory);
				const body = relinkFiles(source.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, '').trim(), renamed);
				const section = `## ${title}\n\n${body}`.trim();
				// There already (a merge stopped halfway, asked again): not twice.
				if (parentSource.includes(section)) return;
				await before?.(parent, parentSource);
				const linkLine = new RegExp(`^[ \\t]*\\[[^\\]\\n]*\\]\\((?:https?://[^)\\s]*)?/(?:blog|wiki)/${slug}/?\\)[ \\t]*$`, 'mu');
				const merged = linkLine.test(parentSource)
					? parentSource.replace(linkLine, () => section)
					: `${parentSource.replace(/\s*$/u, '')}\n\n${section}\n`;
				await atomicWriteText(above.markdown, merged);
			});
			return parent;
		});
		for (const child of await this.#children(slug)) await this.#rewrite(child, (source) => withFields(source, { parent }));
		for (const { slug: page, source: text } of await this.#sources()) {
			if (page === slug || !text.includes(slug)) continue;
			await this.#rewrite(page, (current) => relinkArticle(current, slug, parent, { site }).source, { keep: true });
		}
		return { slug, parent };
	}

	/**
	 * Changes another article than the one whose queue this runs in: in its own queue, read again there
	 * (whatever was saved meanwhile is what is changed), its text kept as a version first when `keep`.
	 * Whether it changed; an article gone meanwhile is left gone.
	 * @param {(source: string) => string} change
	 */
	#rewrite(slug, change, { keep = false } = {}) {
		return this.exclusive(slug, async () => {
			const { markdown } = articleBundlePaths(this.blogRoot, slug);
			let source;
			try {
				source = await readFile(markdown, 'utf8');
			} catch (error) {
				if (error?.code === 'ENOENT') return false;
				throw error;
			}
			const next = change(source);
			if (next === source) return false;
			if (keep) await this.#keep(slug, source);
			await atomicWriteText(markdown, next);
			return true;
		});
	}

	/** Keeps a version of the article; one that cannot be kept stops nothing (it is said in the server's log). */
	async #keep(slug, source) {
		try {
			await this.keep?.(slug, source);
		} catch (error) {
			console.warn(`[studio] 没能存下 ${slug} 的历史版本：${error instanceof Error ? error.message : error}`); // i18n-ignore: developer log
		}
	}

	/** The folder names of the pages right under `slug`. */
	async #children(slug) {
		return (await this.#sources()).filter(({ source, slug: page }) => articleSummary(source, page).parent === slug).map(({ slug: page }) => page);
	}

	/** Sets the article's tree fields (withFields), in its own queue (the caller's). */
	async #writeFields(slug, fields) {
		const { markdown } = articleBundlePaths(this.blogRoot, slug);
		const source = await readFile(markdown, 'utf8');
		const next = withFields(source, fields);
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
					title: `${properties.title || '无标题'}（副本）`, // i18n-ignore: written into the article
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
			source,
			revision,
			// Not named: no title (the page shows 无标题 in grey, to type over), not its folder name.
			properties: articleProperties(source, ''),
			problems: articleProblems(source),
			macros: articleMacros(source),
			chemistryViews: readMoleculeViews(viewsSource),
			// How large its pictures are: the editor keeps their room till it loads them (picture-sizes.mjs).
			pictures: await pictureSizes(paths.directory, source),
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

	/**
	 * Writes the article. Its title changed: the links to it in the other
	 * articles whose words were its title follow it (`retitled`: in how many
	 * articles), as Notion's links to a page do; `site` is the blog's address,
	 * for links written in full. `before` is given the text as it was, before
	 * it is written over (to keep it as a version).
	 */
	async save(slug, change, { site, before } = {}) {
		const { retitle, ...saved } = await this.exclusive(slug, () => this.#save(slug, change, { before }));
		// The links in the other articles: once this one's queue is done (#rewrite).
		const retitled = retitle ? await this.#titleChanged(slug, retitle.from, retitle.to, { site }) : 0;
		return retitled ? { ...saved, retitled } : saved;
	}

	async #save(slug, { source: nextSource, expectedRevision }, { before }) {
		if (typeof nextSource !== 'string') throw new ArticleValidationError(t('文章内容必须是文本'));
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [current, viewsSource] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views)]);
		const currentRevision = bundleRevision(current, viewsSource);
		// Already so: a save sent again (its answer lost on the way) is the same save, not someone else's change.
		if (current === nextSource) return { revision: currentRevision, problems: articleProblems(current) };
		const expected = expectedRevision;
		if (expected && currentRevision !== expected) {
			throw new ArticleConflictError(t('文件已被其他程序修改，请重新载入后再保存'));
		}
		// A version that cannot be kept (a full disk…) does not keep the text typed from being saved.
		try {
			await before?.(current);
		} catch (error) {
			console.warn(`[studio] 没能存下 ${slug} 的历史版本：${error instanceof Error ? error.message : error}`); // i18n-ignore: developer log
		}
		// Another program (the CLI, an AI) may have written it meanwhile: it is not in this queue.
		if (expected && (await readFile(paths.markdown, 'utf8')) !== current) {
			throw new ArticleConflictError(t('文件已被其他程序修改，请重新载入后再保存'));
		}
		// Saved even when the properties are wrong, so nothing typed is lost; `problems` says what to fix.
		await atomicWriteText(paths.markdown, nextSource);
		const revision = bundleRevision(nextSource, viewsSource);
		// Titles as typed; a page not named is linked to as 无标题 (`/page`), which its links follow from when it is named.
		const was = articleSummary(current, '').title || '无标题'; // i18n-ignore: the words of the links to it
		const is = articleSummary(nextSource, '').title || '无标题'; // i18n-ignore: the words of the links to it
		return { revision, problems: articleProblems(nextSource), ...(was !== is ? { retitle: { from: was, to: is } } : {}) };
	}

	/**
	 * The article's title went from `from` to `to`: the links to it whose words were its title follow, at
	 * once (in how many articles), or once the title has stayed `retitleAfter` ms (0 then): from the title it
	 * had before it began to change, so links that happen to read as a title half typed are left alone.
	 */
	async #titleChanged(slug, from, to, { site }) {
		if (!this.retitleAfter) return this.#retitleLinks(slug, from, to, { site });
		const waiting = this.#titles.get(slug);
		clearTimeout(waiting?.timer);
		const first = waiting?.from ?? from;
		if (first === to) {
			this.#titles.delete(slug);
			return 0;
		}
		const timer = setTimeout(() => {
			this.#titles.delete(slug);
			this.#retitleLinks(slug, first, to, { site }).catch((error) => console.warn(`[studio] 链接文字没能跟着 ${slug} 的新标题改：${error?.message ?? error}`)); // i18n-ignore: developer log
		}, this.retitleAfter);
		timer.unref?.();
		this.#titles.set(slug, { from: first, timer });
		return 0;
	}

	/** The links to `slug` in the other articles whose words are `from`, in words `to`; in how many articles. */
	async #retitleLinks(slug, from, to, { site }) {
		let retitled = 0;
		for (const { slug: page, source } of await this.#sources()) {
			// Not parsed unless it may link there: a book's text takes a while to parse.
			if (page === slug || !source.includes(slug)) continue;
			if (await this.#rewrite(page, (text) => retitleArticleLinks(text, slug, from, to, { site }).source, { keep: true })) retitled += 1;
		}
		return retitled;
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
			throw new ArticleConflictError(t('文章或视角配置已被其他程序修改，请重新载入后再保存'));
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
		throw new StudioPathError(t('文章目录包含不允许的符号链接或文件类型'));
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
	throw new ArticleConflictError(t('已经有一篇叫 {name} 的文章了', { name: basename(directory) }));
}

export class ArticleNotFoundError extends Error {
	constructor(message = t('文章不存在')) {
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

/** A citation in Markdown: `[@key]`, `[see @key, p. 3]`. */
const CITATION = /\[[^\]\n]*@[\w:.-]/u;

function isInside(root, path) {
	return path === root || path.startsWith(root + sep);
}

/** The text with the tree's fields given (`parent`, `order`; empty or null takes one out), the rest as it was. */
function withFields(source, fields) {
	let next = source;
	for (const [key, value] of Object.entries(fields)) next = setFrontmatterField(next, key, value);
	return next;
}

/** The files under `folder` (relative, with `/`): no links, nothing hidden. */
async function filesUnder(folder, prefix = '') {
	let entries;
	try {
		entries = await readdir(folder, { withFileTypes: true });
	} catch (error) {
		if (error?.code === 'ENOENT') return [];
		throw error;
	}
	const found = [];
	for (const entry of entries) {
		if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
		if (entry.isDirectory()) found.push(...(await filesUnder(join(folder, entry.name), `${prefix}${entry.name}/`)));
		else if (entry.isFile()) found.push(`${prefix}${entry.name}`);
	}
	return found;
}

async function sameFile(left, right) {
	const [a, b] = await Promise.all([stat(left), stat(right)]);
	if (a.size !== b.size) return false;
	const [x, y] = await Promise.all([readFile(left), readFile(right)]);
	return x.equals(y);
}

/**
 * A page's img/ and assets/ copied into the folder of the page it is merged into. A file of the same name
 * there that is the same stays; one that is another file stays too, and this one is copied beside it as
 * `name-2.ext` (…-3, …); a library (assets/refs.bib) gets the entries it lacks. What was copied under
 * another name, by its path (`img/a.png` → `img/a-2.png`).
 */
async function mergeFiles(from, into) {
	const renamed = new Map();
	for (const folder of ['img', 'assets']) {
		for (const file of await filesUnder(join(from, folder), `${folder}/`)) {
			const source = resolveInside(from, file);
			const target = resolveInside(into, file);
			const there = await lstat(target).catch(() => null);
			if (!there) {
				await mkdir(dirname(target), { recursive: true });
				await cp(source, target, { errorOnExist: true, force: false });
				continue;
			}
			if (there.isFile() && (await sameFile(source, target))) continue;
			if (file === 'assets/refs.bib' && there.isFile()) {
				await atomicWriteText(target, mergedLibrary(await readFile(target, 'utf8'), await readFile(source, 'utf8')));
				continue;
			}
			const extension = extname(file);
			const stem = file.slice(0, file.length - extension.length);
			for (let number = 2; ; number += 1) {
				const name = `${stem}-${number}${extension}`;
				const other = resolveInside(into, name);
				const taken = await lstat(other).catch(() => null);
				if (taken && !(taken.isFile() && (await sameFile(source, other)))) continue;
				if (!taken) await cp(source, other, { errorOnExist: true, force: false });
				renamed.set(file, name);
				break;
			}
		}
	}
	return renamed;
}

/** `kept`'s library with the entries of `added` whose keys it lacks (one it has keeps its own). */
function mergedLibrary(kept, added) {
	const known = parseBibtex(kept);
	const heads = [...added.matchAll(/@\s*([A-Za-z]+)\s*[{(]\s*([^,\s]+)\s*,/gu)];
	const missing = [];
	for (const [index, head] of heads.entries()) {
		if (known.has(head[2]) || /^(?:comment|preamble|string)$/iu.test(head[1])) continue;
		missing.push(added.slice(head.index, heads[index + 1]?.index ?? added.length).trim());
	}
	return missing.length ? `${kept.replace(/\s*$/u, '')}\n\n${missing.join('\n\n')}\n` : kept;
}

/** The text with its links to files copied under other names (`renamed`) changed to them. */
function relinkFiles(text, renamed) {
	let next = text;
	for (const [from, to] of renamed) {
		const escaped = from.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
		next = next.replace(new RegExp(`(^|[\\s("'=:])(\\./)?${escaped}(?=$|[\\s)"'#?}\\]])`, 'gmu'), (_, lead, dot = '') => `${lead}${dot}${to}`);
	}
	return next;
}
