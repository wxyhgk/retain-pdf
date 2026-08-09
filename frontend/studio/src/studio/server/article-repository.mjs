import { lstat, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { atomicWriteText, contentRevision } from './atomic-write.mjs';
import { DEFAULT_ARTICLE_CONFIG } from './article-config.mjs';
import { DEFAULT_ARTICLE_VIEWS, readMoleculeViews, writeMoleculeView } from './article-views.mjs';
import {
	ARTICLE_RESOURCE_DIRECTORIES,
	ARTICLE_SLUG_PATTERN,
	articleBundlePaths,
	assertArticleSlug,
	StudioPathError,
} from './bundle-paths.mjs';
import { FileRepository } from './file-repository.mjs';
import { ArticleValidationError, articleProperties, articleSummary, createArticleSource } from './schemas.mjs';

function bundleRevision(source, configSource, viewsSource) {
	return contentRevision(`${source}\0${configSource}\0${viewsSource}`);
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
	constructor(blogRoot) {
		this.blogRoot = resolve(blogRoot);
		this.files = new FileRepository(this.blogRoot);
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
				articles.push({ slug: entry.name, title: summary.title, draft: summary.draft });
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
			writeFile(paths.config, DEFAULT_ARTICLE_CONFIG, { encoding: 'utf8', flag: 'wx' }),
			writeFile(paths.views, DEFAULT_ARTICLE_VIEWS, { encoding: 'utf8', flag: 'wx' }),
		]);
		return { slug };
	}

	async read(slug) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [source, configSource, viewsSource] = await Promise.all([
			readFile(paths.markdown, 'utf8'),
			readFile(paths.config, 'utf8'),
			readViewsSource(paths.views),
		]);
		const files = await this.files.list(slug);
		const revision = bundleRevision(source, configSource, viewsSource);
		return {
			slug,
			content: source,
			hash: revision,
			source,
			revision,
			files,
			properties: articleProperties(source, slug),
			chemistryViews: readMoleculeViews(viewsSource),
		};
	}

	async save(slug, { content, source, expectedHash, expectedRevision }) {
		const nextSource = source ?? content;
		if (typeof nextSource !== 'string') throw new ArticleValidationError('文章内容必须是文本');
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [current, configSource, viewsSource] = await Promise.all([
			readFile(paths.markdown, 'utf8'),
			readFile(paths.config, 'utf8'),
			readViewsSource(paths.views),
		]);
		const currentRevision = bundleRevision(current, configSource, viewsSource);
		const expected = expectedRevision ?? expectedHash;
		if (expected && currentRevision !== expected) {
			throw new ArticleConflictError('文件已被其他程序修改，请重新载入后再保存');
		}
		await atomicWriteText(paths.markdown, nextSource);
		const revision = bundleRevision(nextSource, configSource, viewsSource);
		return { hash: revision, revision };
	}

	async saveMoleculeView(slug, key, { format, view, display, expectedRevision }) {
		const paths = articleBundlePaths(this.blogRoot, slug);
		await assertReadableBundle(paths);
		const [source, configSource, viewsSource] = await Promise.all([
			readFile(paths.markdown, 'utf8'),
			readFile(paths.config, 'utf8'),
			readViewsSource(paths.views),
		]);
		const currentRevision = bundleRevision(source, configSource, viewsSource);
		if (expectedRevision && currentRevision !== expectedRevision) {
			throw new ArticleConflictError('文章或视角配置已被其他程序修改，请重新载入后再保存');
		}
		const nextViewsSource = writeMoleculeView(viewsSource, key, format, view, display);
		await atomicWriteText(paths.views, nextViewsSource);
		const revision = bundleRevision(source, configSource, nextViewsSource);
		return { revision, chemistryViews: readMoleculeViews(nextViewsSource) };
	}
}

async function assertReadableBundle(paths) {
	const [directory, markdown] = await Promise.all([lstat(paths.directory), lstat(paths.markdown)]);
	if (directory.isSymbolicLink() || !directory.isDirectory() || markdown.isSymbolicLink() || !markdown.isFile()) {
		throw new StudioPathError('文章目录包含不允许的符号链接或文件类型');
	}
}

export class ArticleConflictError extends Error {
	constructor(message) {
		super(message);
		this.name = 'ArticleConflictError';
		this.statusCode = 409;
	}
}
