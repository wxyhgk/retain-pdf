import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatexMhchem from './rehype-katex-mhchem.mjs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function hash(content) {
	return createHash('sha256').update(content).digest('hex');
}

function articleTitle(content, fallback) {
	const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/u)?.[1] ?? '';
	const rawTitle = frontmatter.match(/^title:\s*(.+)$/mu)?.[1]?.trim();
	return rawTitle?.replace(/^['"]|['"]$/g, '') || fallback;
}

function markdownBody(content) {
	return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/u, '');
}

async function listFiles(directory, prefix = '') {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		const files = [];
		for (const entry of entries) {
			if (entry.name === '.gitkeep') continue;
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relative));
			else files.push(relative);
		}
		return files;
	} catch {
		return [];
	}
}

export default function studioDev({ chemistryLanguages }) {
	return {
		name: 'local-article-studio',
		apply: 'serve',
		configureServer(server) {
			const blogRoot = resolve(server.config.root, 'blog');
			const processorPromise = createMarkdownProcessor({
				remarkPlugins: [remarkMath],
				rehypePlugins: [rehypeKatexMhchem],
				syntaxHighlight: { type: 'shiki', excludeLangs: chemistryLanguages },
			});

			server.middlewares.use(async (request, response, next) => {
				const url = new URL(request.url ?? '/', 'http://localhost');
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
						const entries = await readdir(blogRoot, { withFileTypes: true });
						const articles = [];
						for (const entry of entries) {
							if (!entry.isDirectory() || !slugPattern.test(entry.name)) continue;
							try {
								const content = await readFile(join(blogRoot, entry.name, 'index.md'), 'utf8');
								articles.push({ slug: entry.name, title: articleTitle(content, entry.name) });
							} catch { /* Ignore directories without an article. */ }
						}
						articles.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
						return json(response, 200, { articles });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'POST') {
						const { slug, title } = await readJson(request);
						if (!slugPattern.test(slug ?? '')) return json(response, 400, { error: 'slug 只能包含小写字母、数字和连字符' });
						if (typeof title !== 'string' || !title.trim()) return json(response, 400, { error: '文章标题不能为空' });
						const articleDirectory = join(blogRoot, slug);
						try {
							await stat(articleDirectory);
							return json(response, 409, { error: '该文章目录已经存在' });
						} catch { /* Expected for a new article. */ }
						await Promise.all(['img', 'assets', 'ai'].map((name) => mkdir(join(articleDirectory, name), { recursive: true })));
						const today = new Date().toISOString().slice(0, 10);
						const content = `---\ntitle: '${title.trim().replaceAll("'", "''")}'\ndescription: ''\npubDate: '${today}'\ntags: []\ndraft: true\n---\n\n从这里开始写作。\n`;
						await Promise.all([
							writeFile(join(articleDirectory, 'index.md'), content, { flag: 'wx' }),
							writeFile(join(articleDirectory, 'article.config.yaml'), 'render:\n  toc: true\n  math: true\n  chemistry: true\n', { flag: 'wx' }),
						]);
						return json(response, 201, { slug });
					}

					if (url.pathname === '/api/studio/preview' && request.method === 'POST') {
						const { content = '', slug = 'preview' } = await readJson(request);
						const processor = await processorPromise;
						const result = await processor.render(markdownBody(String(content)), {
							fileURL: pathToFileURL(join(blogRoot, slug, 'index.md')),
						});
						return json(response, 200, { html: result.code });
					}

					const match = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)$/);
					if (match) {
						const slug = decodeURIComponent(match[1]);
						if (!slugPattern.test(slug)) return json(response, 400, { error: '无效的文章 slug' });
						const articleDirectory = join(blogRoot, slug);
						const articlePath = join(articleDirectory, 'index.md');

						if (request.method === 'GET') {
							const content = await readFile(articlePath, 'utf8');
							const [img, assets, ai] = await Promise.all(['img', 'assets', 'ai'].map((name) => listFiles(join(articleDirectory, name))));
							return json(response, 200, {
								slug,
								content,
								hash: hash(content),
								files: { img, assets, ai },
							});
						}

						if (request.method === 'PUT') {
							const { content, expectedHash } = await readJson(request);
							if (typeof content !== 'string') return json(response, 400, { error: '文章内容必须是文本' });
							const current = await readFile(articlePath, 'utf8');
							if (expectedHash && hash(current) !== expectedHash) {
								return json(response, 409, { error: '文件已被其他程序修改，请重新载入后再保存' });
							}
							const temporaryPath = `${articlePath}.${randomUUID()}.tmp`;
							await writeFile(temporaryPath, content, 'utf8');
							await rename(temporaryPath, articlePath);
							return json(response, 200, { hash: hash(content) });
						}
					}

					return json(response, 404, { error: 'Studio API 不存在' });
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Studio 操作失败';
					return json(response, 500, { error: message });
				}
			});
		},
	};
}
