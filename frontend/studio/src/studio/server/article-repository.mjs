import { cp, lstat, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { updateStudioFrontmatter } from '../document/frontmatter.ts';
import { atomicWriteText, contentRevision } from './atomic-write.mjs';
import { DEFAULT_ARTICLE_VIEWS, readMoleculeViews, writeMoleculeView } from './article-views.mjs';
import {
	ARTICLE_RESOURCE_DIRECTORIES,
	ARTICLE_SLUG_PATTERN,
	articleBundlePaths,
	assertArticleSlug,
	StudioPathError,
} from './bundle-paths.mjs';
import { ArticleValidationError, articleMacros, articleProblems, articleProperties, articleSummary, createArticleSource } from './schemas.mjs';

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

	async list() {
		let entries;
		try {
			entries = await readdir(this.blogRoot, { withFileTypes: true });
		} catch (error) {
			if (error?.code === 'ENOENT') return [];
			throw error;
		}

		const articles = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.isSymbolicLink() || !ARTICLE_SLUG_PATTERN.test(entry.name)) continue;
			try {
				const source = await readFile(articleBundlePaths(this.blogRoot, entry.name).markdown, 'utf8');
				const summary = articleSummary(source, entry.name);
				articles.push({ slug: entry.name, title: summary.title, draft: summary.draft, icon: summary.icon, tags: summary.tags });
			} catch (error) {
				if (error?.code !== 'ENOENT') throw error;
			}
		}
		articles.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
		return articles;
	}

	async create({ slug, title }) {
		assertArticleSlug(slug);
		const paths = articleBundlePaths(this.blogRoot, slug);
		try {
			await stat(paths.directory);
			throw new ArticleConflictError('该文章目录已经存在');
		} catch (error) {
			if (error instanceof ArticleConflictError) throw error;
			if (error?.code !== 'ENOENT') throw error;
		}

		const source = createArticleSource({ title });
		await Promise.all(ARTICLE_RESOURCE_DIRECTORIES.map((name) => mkdir(paths[name], { recursive: true })));
		await Promise.all([
			writeFile(paths.markdown, source, { encoding: 'utf8', flag: 'wx' }),
			writeFile(paths.views, DEFAULT_ARTICLE_VIEWS, { encoding: 'utf8', flag: 'wx' }),
		]);
		return { slug };
	}

	/**
	 * Gives the article another folder name, which is its address on the blog
	 * (`/blog/<slug>/`). Its text says nothing of its folder, so nothing in it changes.
	 */
	rename(slug, to) {
		return this.exclusive(slug, async () => {
			const from = articleBundlePaths(this.blogRoot, slug);
			await assertReadableBundle(from);
			if (to === slug) return { slug };
			const target = articleBundlePaths(this.blogRoot, to);
			await assertFree(target.directory);
			await rename(from.directory, target.directory);
			return { slug: to };
		});
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
		const [source, viewsSource] = await Promise.all([readFile(paths.markdown, 'utf8'), readViewsSource(paths.views)]);
		const revision = bundleRevision(source, viewsSource);
		return {
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
