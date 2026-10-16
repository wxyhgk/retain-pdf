import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { checkArticle } from '../studio/server/article-check.mjs';
import { ArticleFiles } from '../studio/server/article-files.mjs';
import { ArticleGit } from '../studio/server/article-git.mjs';
import { ArticleRepository } from '../studio/server/article-repository.mjs';
import { BlogWatcher } from '../studio/server/blog-watcher.mjs';
import { CodeFilePreviews } from '../studio/server/code-file-previews.mjs';
import { articleBundlePaths, StudioPathError } from '../studio/server/bundle-paths.mjs';
import { ArticleFileManager } from '../studio/server/file-manager.mjs';
import { FileRepository } from '../studio/server/file-repository.mjs';
import { revealInFileManager } from '../studio/server/reveal.mjs';
import { TerminalHost } from '../studio/server/terminal-host.mjs';
import { markContentReloads } from '../studio/server/content-reloads.mjs';

function json(response, status, data) {
	// A file was being sent when it failed (the page went away): nothing more can be said.
	if (response.headersSent) {
		response.destroy?.();
		return;
	}
	response.statusCode = status;
	response.setHeader('Content-Type', 'application/json; charset=utf-8');
	response.setHeader('Cache-Control', 'no-store');
	response.end(JSON.stringify(data));
}

async function readJson(request) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 5 * 1024 * 1024) throw new Error('请求内容超过 5 MB');
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/**
 * A page elsewhere can post a form to localhost, but cannot set these types
 * without the browser asking first, so changes must declare them.
 */
function assertContentType(request, expected) {
	const type = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
	if (type !== expected) {
		const error = new Error(`请求类型必须是 ${expected}`);
		error.statusCode = 415;
		throw error;
	}
}

async function readJsonChange(request) {
	assertContentType(request, 'application/json');
	return readJson(request);
}

function decodePathComponent(component) {
	try {
		return decodeURIComponent(component);
	} catch {
		throw new StudioPathError('资源 URL 编码无效');
	}
}

/** Streams a file of the article: a log of hundreds of megabytes is served like a picture. */
async function file(response, resource) {
	response.statusCode = 200;
	response.setHeader('Content-Type', resource.contentType);
	response.setHeader('Content-Length', resource.size);
	response.setHeader('Cache-Control', 'no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Content-Security-Policy', 'sandbox');
	await pipeline(resource.body, response);
}

export default function studioDev() {
	return {
		name: 'local-article-studio',
		apply: 'serve',
		configureServer(server) {
			// Browser tests point the Studio at a copy of their fixtures instead of blog/.
			const testBlogRoot = process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : null;
			const blogRoot = testBlogRoot ?? resolve(server.config.root, 'blog');
			const articles = new ArticleRepository(blogRoot);
			const files = new FileRepository(blogRoot);
			const codeFiles = new CodeFilePreviews(files);
			// Removed files wait here, outside blog/ and ignored by git, until someone empties it.
			const manager = new ArticleFileManager(blogRoot, {
				trashRoot: testBlogRoot ? resolve(testBlogRoot, '.studio-trash') : resolve(server.config.root, '.studio-trash'),
			});
			const articleFiles = new ArticleFiles(articles, manager);
			const articleGit = new ArticleGit(blogRoot);
			const watcher = new BlogWatcher(blogRoot);
			const terminals = new TerminalHost(resolve(server.config.root, 'tools', 'studio-terminal'));
			server.httpServer?.on('close', () => {
				watcher.close();
				terminals.close();
			});
			markContentReloads(server);

			server.middlewares.use(async (request, response, next) => {
				const rawPathname = (request.url ?? '/').split('?', 1)[0];
				const url = new URL(request.url ?? '/', 'http://localhost');
				const publicFileMatch = rawPathname.match(/^\/article-assets\/([^/]+)\/([^/]+)\/(.+)$/u);
				if (publicFileMatch && request.method === 'GET') {
					try {
						const slug = decodePathComponent(publicFileMatch[1]);
						const root = decodePathComponent(publicFileMatch[2]);
						const resourcePath = decodePathComponent(publicFileMatch[3]);
						return await file(response, await files.stream(slug, root, resourcePath));
					} catch (error) {
						const message = error instanceof Error ? error.message : '文章资源读取失败';
						const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
						return json(response, status, { error: message });
					}
				}
				if (!url.pathname.startsWith('/api/studio/')) return next();
				const remoteAddress = request.socket.remoteAddress ?? '';
				const isLoopback = remoteAddress === '::1' || remoteAddress === '127.0.0.1' || remoteAddress.startsWith('::ffff:127.');
				if (!isLoopback) return json(response, 403, { error: 'Studio 只允许本机访问' });
				const origin = request.headers.origin;
				if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(origin)) {
					return json(response, 403, { error: '拒绝非本地页面访问 Studio' });
				}

				try {
					// What changes in blog/, as server-sent events: `data: [{"slug":"note","paths":["index.md"]}]`.
					if (url.pathname === '/api/studio/events' && request.method === 'GET') {
						response.writeHead(200, {
							'Content-Type': 'text/event-stream; charset=utf-8',
							'Cache-Control': 'no-store',
							Connection: 'keep-alive',
						});
						response.write('retry: 2000\n\n');
						const stop = watcher.subscribe((changes) => response.write(`data: ${JSON.stringify(changes)}\n\n`));
						// A comment now and then keeps the connection from looking idle.
						const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 25_000);
						request.on('close', () => {
							clearInterval(keepAlive);
							stop();
						});
						return;
					}

					// A shell for the 终端 tab: in the repository, or in the open article's folder.
					if (url.pathname === '/api/studio/terminal' && request.method === 'POST') {
						const { cwd, slug } = await readJsonChange(request);
						const folder = cwd === 'article' ? articleBundlePaths(blogRoot, slug).directory : server.config.root;
						if (cwd === 'article') await manager.locate(slug, '');
						const env = cwd === 'article' ? { STUDIO_ARTICLE: slug } : {};
						return json(response, 200, { ...(await terminals.open(folder, env)), cwd: folder });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'GET') {
						return json(response, 200, { articles: await articles.list() });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'POST') {
						const created = await articles.create(await readJson(request));
						return json(response, 201, created);
					}

					// Which articles have changes not committed.
					if (url.pathname === '/api/studio/git' && request.method === 'GET') {
						return json(response, 200, await articleGit.status());
					}

					// An article deleted (DELETE below), put back.
					if (url.pathname === '/api/studio/restored-articles' && request.method === 'POST') {
						const { trashed } = await readJsonChange(request);
						return json(response, 200, await manager.restoreArticle(trashed));
					}

					// An article committed, with the folders of articles gone from disk.
					const commitMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/commit$/u);
					if (commitMatch && request.method === 'POST') {
						const slug = decodePathComponent(commitMatch[1]);
						const { message } = await readJsonChange(request);
						return json(response, 200, await articles.exclusive(slug, () => articleGit.commit(slug, message)));
					}

					// Another folder name for an article, or a copy of it under one.
					const articleActionMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/(rename|duplicate)$/u);
					if (articleActionMatch && request.method === 'POST') {
						const slug = decodePathComponent(articleActionMatch[1]);
						const { to } = await readJsonChange(request);
						const result = articleActionMatch[2] === 'rename' ? await articles.rename(slug, to) : await articles.duplicate(slug, to);
						return json(response, articleActionMatch[2] === 'rename' ? 200 : 201, result);
					}

					// Match the raw path so URL normalization cannot erase an attempted `..` traversal.
					const fileMatch = rawPathname.match(/^\/api\/studio\/articles\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
					if (fileMatch && request.method === 'GET') {
						const slug = decodePathComponent(fileMatch[1]);
						const root = decodePathComponent(fileMatch[2]);
						const resourcePath = decodePathComponent(fileMatch[3]);
						return await file(response, await files.stream(slug, root, resourcePath));
					}

					// What would be wrong with the article, as the editor holds it, once published.
					const checkMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/check$/u);
					if (checkMatch && request.method === 'POST') {
						const slug = decodePathComponent(checkMatch[1]);
						const { source } = await readJsonChange(request);
						if (typeof source !== 'string') return json(response, 400, { error: '文章内容必须是文本' });
						await manager.locate(slug, '');
						return json(response, 200, { issues: await checkArticle(blogRoot, slug, source) });
					}

					// A code block's `@file`, drawn as the blog draws it.
					const codeFileMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/code-file$/u);
					if (codeFileMatch && request.method === 'GET') {
						const slug = decodePathComponent(codeFileMatch[1]);
						const { searchParams: query } = url;
						const figure = await codeFiles.figure(slug, query.get('path') ?? '', query.get('language') ?? '', query.get('meta') ?? '');
						return json(response, 200, { figure });
					}

					const managerMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/(tree|files|folders|move|trash|restore|reveal)$/u);
					if (managerMatch) {
						const slug = decodePathComponent(managerMatch[1]);
						const action = `${request.method} ${managerMatch[2]}`;
						if (action === 'GET tree') return json(response, 200, { entries: await manager.list(slug) });
						if (action === 'POST files') {
							assertContentType(request, 'application/octet-stream');
							const declared = Number(request.headers['content-length']);
							if (declared > manager.uploadSizeLimit) return json(response, 413, { error: `文件超过 ${manager.uploadSizeLimit / 1024 / 1024} MB 上传上限` });
							const uploaded = await manager.upload(slug, url.searchParams.get('folder') ?? '', url.searchParams.get('name') ?? '', request, {
								replace: url.searchParams.get('replace') === '1',
								subfolders: (url.searchParams.get('subfolder') ?? '').split('/').filter(Boolean),
							});
							return json(response, 201, uploaded);
						}
						if (action === 'POST folders') {
							const { path } = await readJsonChange(request);
							return json(response, 201, await manager.createFolder(slug, path));
						}
						if (action === 'POST move') {
							const { from, to, expectedRevision } = await readJsonChange(request);
							return json(response, 200, await articleFiles.move(slug, from, to, { expectedRevision }));
						}
						if (action === 'POST trash') {
							const { path } = await readJsonChange(request);
							return json(response, 200, await manager.trash(slug, path));
						}
						if (action === 'POST restore') {
							const { trashed } = await readJsonChange(request);
							return json(response, 200, await manager.restore(slug, trashed));
						}
						if (action === 'POST reveal') {
							const { path } = await readJsonChange(request);
							const absolute = await manager.locate(slug, path ?? '');
							// Browser tests must not open windows on the machine running them.
							if (!testBlogRoot) await revealInFileManager(absolute, { isDirectory: (await lstat(absolute)).isDirectory() });
							return json(response, 200, { path: path ?? '' });
						}
					}

					const match = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)$/u);
					if (match) {
						const slug = decodePathComponent(match[1]);

						if (request.method === 'GET') {
							return json(response, 200, await articles.read(slug));
						}

						if (request.method === 'PUT') {
							return json(response, 200, await articles.save(slug, await readJson(request)));
						}

						// To the trash, from where it can be put back.
						if (request.method === 'DELETE') {
							return json(response, 200, await articles.exclusive(slug, () => manager.trashArticle(slug)));
						}
					}

					const viewMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/chemistry-views\/([^/]+)$/u);
					if (viewMatch && request.method === 'PUT') {
						const slug = decodePathComponent(viewMatch[1]);
						const key = decodePathComponent(viewMatch[2]);
						return json(response, 200, await articles.saveMoleculeView(slug, key, await readJson(request)));
					}

					return json(response, 404, { error: 'Studio API 不存在' });
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Studio 操作失败';
					const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
					return json(response, status, { error: message });
				}
			});
		},
	};
}
