import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ArticleFiles } from '../studio/server/article-files.mjs';
import { ArticleRepository } from '../studio/server/article-repository.mjs';
import { StudioPathError } from '../studio/server/bundle-paths.mjs';
import { ArticleFileManager } from '../studio/server/file-manager.mjs';
import { FileRepository } from '../studio/server/file-repository.mjs';
import { revealInFileManager } from '../studio/server/reveal.mjs';

function json(response, status, data) {
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

function file(response, resource) {
	response.statusCode = 200;
	response.setHeader('Content-Type', resource.contentType);
	response.setHeader('Content-Length', resource.size);
	response.setHeader('Cache-Control', 'no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Content-Security-Policy', 'sandbox');
	response.end(resource.body);
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
			// Removed files wait here, outside blog/ and ignored by git, until someone empties it.
			const manager = new ArticleFileManager(blogRoot, {
				trashRoot: testBlogRoot ? resolve(testBlogRoot, '.studio-trash') : resolve(server.config.root, '.studio-trash'),
			});
			const articleFiles = new ArticleFiles(articles, manager);

			server.middlewares.use(async (request, response, next) => {
				const rawPathname = (request.url ?? '/').split('?', 1)[0];
				const url = new URL(request.url ?? '/', 'http://localhost');
				const publicFileMatch = rawPathname.match(/^\/article-assets\/([^/]+)\/([^/]+)\/(.+)$/u);
				if (publicFileMatch && request.method === 'GET') {
					try {
						const slug = decodePathComponent(publicFileMatch[1]);
						const root = decodePathComponent(publicFileMatch[2]);
						const resourcePath = decodePathComponent(publicFileMatch[3]);
						return file(response, await files.read(slug, root, resourcePath));
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
					if (url.pathname === '/api/studio/articles' && request.method === 'GET') {
						return json(response, 200, { articles: await articles.list() });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'POST') {
						const created = await articles.create(await readJson(request));
						return json(response, 201, created);
					}

					// Match the raw path so URL normalization cannot erase an attempted `..` traversal.
					const fileMatch = rawPathname.match(/^\/api\/studio\/articles\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
					if (fileMatch && request.method === 'GET') {
						const slug = decodePathComponent(fileMatch[1]);
						const root = decodePathComponent(fileMatch[2]);
						const resourcePath = decodePathComponent(fileMatch[3]);
						return file(response, await files.read(slug, root, resourcePath));
					}

					const managerMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/(tree|files|folders|move|trash|reveal)$/u);
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
