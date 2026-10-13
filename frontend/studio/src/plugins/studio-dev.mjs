import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import { ArticleRepository } from '../studio/server/article-repository.mjs';
import { articleBundlePaths, StudioPathError } from '../studio/server/bundle-paths.mjs';
import { FileRepository } from '../studio/server/file-repository.mjs';
import rehypeKatexMhchem from './rehype-katex-mhchem.mjs';

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

function markdownBody(content) {
	return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/u, '');
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

export default function studioDev({ chemistryLanguages }) {
	return {
		name: 'local-article-studio',
		apply: 'serve',
		configureServer(server) {
			// Browser tests point the Studio at a copy of their fixtures instead of blog/.
			const blogRoot = process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : resolve(server.config.root, 'blog');
			const articles = new ArticleRepository(blogRoot);
			const files = new FileRepository(blogRoot);
			const processorPromise = createMarkdownProcessor({
				remarkPlugins: [remarkMath],
				rehypePlugins: [rehypeKatexMhchem],
				syntaxHighlight: { type: 'shiki', excludeLangs: chemistryLanguages },
			});

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

					if (url.pathname === '/api/studio/preview' && request.method === 'POST') {
						const { content = '', slug = 'preview' } = await readJson(request);
						const processor = await processorPromise;
						const result = await processor.render(markdownBody(String(content)), {
							fileURL: pathToFileURL(articleBundlePaths(blogRoot, slug).markdown),
						});
						return json(response, 200, { html: result.code });
					}

					// Match the raw path so URL normalization cannot erase an attempted `..` traversal.
					const fileMatch = rawPathname.match(/^\/api\/studio\/articles\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
					if (fileMatch && request.method === 'GET') {
						const slug = decodePathComponent(fileMatch[1]);
						const root = decodePathComponent(fileMatch[2]);
						const resourcePath = decodePathComponent(fileMatch[3]);
						return file(response, await files.read(slug, root, resourcePath));
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
