import { lstat } from 'node:fs/promises';
import { delimiter, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { checkArticle } from '../studio/server/article-check.mjs';
import { ArticleFiles } from '../studio/server/article-files.mjs';
import { ArticleGit } from '../studio/server/article-git.mjs';
import { ArticleHistory } from '../studio/server/article-history.mjs';
import { ArticleLibrary } from '../studio/server/article-library.mjs';
import { ArticleRepository } from '../studio/server/article-repository.mjs';
import { BlogWatcher } from '../studio/server/blog-watcher.mjs';
import { chooseFolder } from '../studio/server/choose-folder.mjs';
import { CodeFilePreviews } from '../studio/server/code-file-previews.mjs';
import { Drive } from '../studio/server/drive.mjs';
import { DriveText, TEXT_FOLDER } from '../studio/server/drive-text.mjs';
import { articleBundlePaths, resolveInside, StudioPathError } from '../articles/bundle-paths.mjs';
import { ArticleFileManager } from '../studio/server/file-manager.mjs';
import { FileRepository } from '../studio/server/file-repository.mjs';
import { revealInFileManager } from '../studio/server/reveal.mjs';
import { TerminalHost } from '../studio/server/terminal-host.mjs';
import { AgentSettings } from '../studio/server/agent-settings.mjs';
import { startInstruction } from '../studio/server/instructions.mjs';
import { OCR_COMMAND, startPdfOcr } from '../studio/server/pdf-ocr.mjs';
import { MiniApps, proxyFetch } from '../studio/server/mini-apps.mjs';
import { Tasks, commandWords, runProgram } from '../studio/server/tasks.mjs';
import { markContentReloads } from '../studio/server/content-reloads.mjs';
import { pageVersion, studioBlogRoot } from '../studio/server/page-version.mjs';
import { atomicWriteText } from '../studio/server/atomic-write.mjs';
import { listPlugins, serverKernel } from '@blog/kernel/node.mjs';
import { PluginSettings } from '../studio/server/plugin-settings.mjs';
import { AiSettings } from '../studio/server/ai-settings.mjs';
import { askAboutImage } from '../studio/server/ai-vision.mjs';
import { insertBelowImage } from '../studio/server/image-insert.mjs';
import { readAnswer } from '@blog/kernel/routes.mjs';

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
	// Asked in part (a video's player seeking; WebKit plays nothing it cannot ask in part): those bytes.
	response.setHeader('Accept-Ranges', 'bytes');
	if (resource.range === 'unsatisfiable') {
		response.statusCode = 416;
		response.setHeader('Content-Range', `bytes */${resource.size}`);
		response.end();
		return;
	}
	const { range } = resource;
	response.statusCode = range ? 206 : 200;
	response.setHeader('Content-Type', resource.contentType);
	response.setHeader('Content-Length', range ? range.end - range.start + 1 : resource.size);
	if (range) response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${resource.size}`);
	response.setHeader('Cache-Control', 'no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	// Chrome's PDF viewer does not open in a sandboxed page; a PDF is not a page that could run the Studio's API.
	if (!String(resource.contentType).startsWith('application/pdf')) response.setHeader('Content-Security-Policy', 'sandbox');
	await pipeline(resource.body, response);
}

/**
 * @param {{ site?: string }} [options] the blog's address, so links to its articles written in full count as theirs
 */
export default function studioDev({ site } = {}) {
	return {
		name: 'local-article-studio',
		apply: 'serve',
		// The editor is hundreds of modules: made ready when the server starts, not when the Studio is first opened.
		config: () => ({ server: { warmup: { clientFiles: ['./src/studio/main.ts'] } } }),
		// A plugin's file that nothing imports any more (its plugin was removed, and now it is written
		// again) is no dead end that would load the page again: the plugins' list (src/studio/plugin-modules.ts)
		// takes it in, and the Studio puts the plugin in without loading the page (src/studio/plugins.ts).
		// (Vite 8's hook for this: handleHotUpdate is not told of files made or removed.)
		hotUpdate({ file, modules }) {
			if (this.environment.name !== 'client' || !file.startsWith(resolve(this.environment.config.root, 'plugins') + sep)) return;
			return modules.filter((module) => module.importers.size > 0 || module.isSelfAccepting);
		},
		configureServer(server) {
			// Browser tests point the Studio at a copy of their fixtures instead of blog/.
			const testBlogRoot = process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : null;
			const blogRoot = studioBlogRoot(server.config.root);
			const articles = new ArticleRepository(blogRoot);
			const files = new FileRepository(blogRoot);
			const codeFiles = new CodeFilePreviews(files);
			// Removed files wait here, outside blog/ and ignored by git, until someone empties it.
			const manager = new ArticleFileManager(blogRoot, {
				trashRoot: testBlogRoot ? resolve(testBlogRoot, '.studio-trash') : resolve(server.config.root, '.studio-trash'),
			});
			const articleFiles = new ArticleFiles(articles, manager);
			const articleGit = new ArticleGit(blogRoot);
			const history = new ArticleHistory(blogRoot);
			const library = new ArticleLibrary(blogRoot, articles);
			const watcher = new BlogWatcher(blogRoot);
			// The author's own folder of files (资料库), chosen once and kept outside git; the browser tests bring their own.
			const testDriveRoot = process.env.STUDIO_DRIVE_DIR ? resolve(process.env.STUDIO_DRIVE_DIR) : null;
			const settingsFile = testBlogRoot ? resolve(testBlogRoot, '.studio-settings.json') : resolve(server.config.root, '.studio-settings.json');
			const drive = new Drive({
				settingsFile,
				fixedRoot: testDriveRoot,
				forbidden: [server.config.root, blogRoot],
			});
			// The drive's words, for search and for an AI to read: `.studio-text/` in the drive.
			const driveText = new DriveText(drive);
			const terminals = new TerminalHost(resolve(server.config.root, 'tools', 'studio-terminal'));
			// What the project's plugins do on this server (plugins/*/server.mjs): their API, under /api/studio/plugins/.
			const privateRoot = testBlogRoot ?? server.config.root;
			// Those turned off in the Studio (插件) are not applied.
			const pluginSettings = new PluginSettings(settingsFile);
			// Which large model the Studio asks (AI 设置); its key stays on this machine.
			const aiSettings = new AiSettings(settingsFile);
			const agentSettings = new AgentSettings(settingsFile);
			// 小程序: the tools of apps/ at the repository's root, each in a floating window.
			const miniApps = new MiniApps(resolve(server.config.root, 'apps'));
			const tasks = new Tasks();
			/**
			 * The environment of a program the Studio runs for an AI (a terminal's shell, an agent run by Alt+Enter):
			 * `studio …` on its PATH (the pages' operations), which article and where it is, the drive and its text
			 * (blog/AGENTS.md names these).
			 */
			const programEnv = (slug, driveRoot) => ({
				PATH: `${resolve(server.config.root, 'bin')}${delimiter}${process.env.PATH ?? ''}`,
				...(slug ? { STUDIO_ARTICLE: slug, STUDIO_ARTICLE_DIR: articleBundlePaths(blogRoot, slug).directory, STUDIO_ARTICLE_FILE: articleBundlePaths(blogRoot, slug).markdown } : {}),
				...(driveRoot ? { STUDIO_DRIVE_DIR: driveRoot, STUDIO_DRIVE_TEXT: resolve(driveRoot, TEXT_FOLDER) } : {}),
			});
			const plugins = pluginSettings.disabled().then((disabled) => serverKernel(server.config.root, {
				projectRoot: server.config.root,
				blogRoot,
				settingsFile,
				privateFile: (name) => resolve(privateRoot, name),
				testing: Boolean(testBlogRoot),
				files: { articleFolder: (slug) => articleBundlePaths(blogRoot, slug).directory, inside: resolveInside, writeText: atomicWriteText },
				logger: server.config.logger,
			}, { warn: (message) => server.config.logger.warn(`[studio] ${message}`), disabled }));
			server.httpServer?.on('close', () => {
				watcher.close();
				terminals.close();
				// What runs in the background stops with the server (an AI left alone would go on writing).
				for (const task of tasks.list()) if (task.state === 'running') tasks.cancel(task.id);
				void plugins.then((kernel) => kernel.dispose());
			});
			markContentReloads(server);
			// A plugin's file made or removed: what Vite kept of it is forgotten, so that one written again where one was is read anew.
			const pluginsFolder = resolve(server.config.root, 'plugins') + sep;
			const forgetPluginFile = (file) => {
				if (!file.startsWith(pluginsFolder)) return;
				const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph;
				for (const module of graph?.getModulesByFile(file) ?? []) graph.invalidateModule(module, new Set(), Date.now(), true);
			};
			server.watcher?.on('add', forgetPluginFile);
			server.watcher?.on('unlink', forgetPluginFile);

			server.middlewares.use(async (request, response, next) => {
				const rawPathname = (request.url ?? '/').split('?', 1)[0];
				const url = new URL(request.url ?? '/', 'http://localhost');
				// A 小程序's files, for its frame (which has no origin of its own: it asks nothing of the Studio's API but through `studio`).
				const appFileMatch = rawPathname.match(/^\/studio-apps\/([^/]+)\/(.*)$/u);
				if (appFileMatch && request.method === 'GET') {
					const found = await miniApps.file(decodePathComponent(appFileMatch[1]), decodePathComponent(appFileMatch[2]));
					if (!found) return json(response, 404, { error: '没有这个小程序文件' });
					response.writeHead(200, { 'Content-Type': found.type, 'Cache-Control': 'no-store' });
					return response.end(found.body);
				}
				const publicFileMatch = rawPathname.match(/^\/article-assets\/([^/]+)\/([^/]+)\/(.+)$/u);
				if (publicFileMatch && request.method === 'GET') {
					try {
						const slug = decodePathComponent(publicFileMatch[1]);
						const root = decodePathComponent(publicFileMatch[2]);
						const resourcePath = decodePathComponent(publicFileMatch[3]);
						return await file(response, await files.stream(slug, root, resourcePath, { range: request.headers.range }));
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

					// The AIs the Studio starts (the 终端 tab's buttons, Alt+Enter), set in AI 设置.
					if (url.pathname === '/api/studio/agents') {
						if (request.method === 'GET') return json(response, 200, await agentSettings.shown());
						if (request.method === 'PUT') return json(response, 200, await agentSettings.set(await readJsonChange(request)));
					}

					// The background tasks: the list, each one's log, and as events while they go; one cancelled.
					if (url.pathname === '/api/studio/tasks/events' && request.method === 'GET') {
						response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
						response.write('retry: 2000\n\n');
						response.write(`data: ${JSON.stringify({ type: 'all', tasks: tasks.list() })}\n\n`);
						const stop = tasks.subscribe((event) => response.write(`data: ${JSON.stringify(event)}\n\n`));
						const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 25_000);
						request.on('close', () => {
							clearInterval(keepAlive);
							stop();
						});
						return;
					}
					const taskMatch = url.pathname.match(/^\/api\/studio\/tasks\/([^/]+)(\/cancel)?$/u);
					if (taskMatch) {
						const id = decodePathComponent(taskMatch[1]);
						if (taskMatch[2] && request.method === 'POST') return json(response, 200, { cancelled: tasks.cancel(id) });
						if (!taskMatch[2] && request.method === 'GET') {
							const task = tasks.get(id);
							return task ? json(response, 200, task) : json(response, 404, { error: '没有这个任务' });
						}
					}

					// 小程序: the list; what one may do beyond its frame, if its app.json asks for it (net, run).
					if (url.pathname === '/api/studio/apps' && request.method === 'GET') return json(response, 200, { apps: await miniApps.list() });
					const appMatch = url.pathname.match(/^\/api\/studio\/apps\/([^/]+)\/(fetch|run)$/u);
					if (appMatch && request.method === 'POST') {
						const app = await miniApps.get(decodePathComponent(appMatch[1]));
						if (!app) return json(response, 404, { error: '没有这个小程序' });
						const wanted = appMatch[2] === 'fetch' ? 'net' : 'run';
						if (!app.permissions.includes(wanted)) return json(response, 403, { error: `小程序「${app.name}」没有在 app.json 里要「${wanted}」这个权限` });
						const asked = await readJsonChange(request);
						if (wanted === 'net') return json(response, 200, await proxyFetch(asked));
						const argv = Array.isArray(asked.argv) ? asked.argv.map(String) : [];
						if (!argv.length) return json(response, 400, { error: '要给出运行的命令（argv）' });
						const slug = typeof asked.slug === 'string' && asked.slug ? asked.slug : null;
						const cwd = slug ? articleBundlePaths(blogRoot, slug).directory : server.config.root;
						const task = tasks.start({ kind: 'app', title: `${app.name}：${argv.join(' ').slice(0, 60)}`, slug }, ({ log, signal }) => runProgram(argv, { cwd, env: programEnv(slug, null), log, signal }));
						return json(response, 202, { id: task.id });
					}

					// A PDF of the article read by PaddleOCR into a page under it, as a task (STUDIO_OCR_COMMAND: browser tests' stand-in).
					const ocrMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/ocr$/u);
					if (ocrMatch && request.method === 'POST') {
						const slug = decodePathComponent(ocrMatch[1]);
						const { path } = await readJsonChange(request);
						const command = process.env.STUDIO_OCR_COMMAND ? commandWords(process.env.STUDIO_OCR_COMMAND) : OCR_COMMAND;
						return json(response, 202, await startPdfOcr({ tasks, articles, blogRoot, slug, path, env: programEnv(slug, await drive.root()), command }));
					}

					// Alt+Enter: an AI does what a line of the article asks, in its folder, as a task.
					const instructMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/instruct$/u);
					if (instructMatch && request.method === 'POST') {
						const slug = decodePathComponent(instructMatch[1]);
						const { line, fresh, agent } = await readJsonChange(request);
						const folder = articleBundlePaths(blogRoot, slug).directory;
						await manager.locate(slug, '');
						const task = await startInstruction({ tasks, agents: agentSettings, slug, folder, env: programEnv(slug, await drive.root()), line, fresh: Boolean(fresh), agentId: agent });
						return json(response, 202, { id: task.id });
					}

					// A shell for the 终端 tab: in the repository, the open article's folder, or the drive.
					if (url.pathname === '/api/studio/terminal' && request.method === 'POST') {
						const { cwd, slug } = await readJsonChange(request);
						const driveRoot = await drive.root();
						if (cwd === 'drive' && !driveRoot) return json(response, 409, { error: '还没有选择资料库文件夹' });
						const folder = cwd === 'article' ? articleBundlePaths(blogRoot, slug).directory : cwd === 'drive' ? driveRoot : server.config.root;
						if (cwd === 'article') await manager.locate(slug, '');
						const env = programEnv(cwd === 'article' ? slug : null, driveRoot);
						// The drive's text brought up to date for what the AI may read.
						if (driveRoot) void driveText.refresh().catch(() => {});
						return json(response, 200, { ...(await terminals.open(folder, env)), cwd: folder });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'GET') {
						return json(response, 200, { articles: await articles.list() });
					}

					if (url.pathname === '/api/studio/articles' && request.method === 'POST') {
						const created = await articles.create(await readJson(request));
						return json(response, 201, created);
					}

					// Articles whose title or text holds `q`.
					if (url.pathname === '/api/studio/search' && request.method === 'GET') {
						return json(response, 200, { results: await articles.search(url.searchParams.get('q') ?? '') });
					}

					// What is in the trash, and deleting something in it for good.
					if (url.pathname === '/api/studio/trash' && request.method === 'GET') {
						return json(response, 200, { entries: await manager.listTrash() });
					}
					if (url.pathname === '/api/studio/trash/purge' && request.method === 'POST') {
						const { trashed } = await readJsonChange(request);
						return json(response, 200, await manager.purge(trashed));
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

					// Under another page, or at the top (`parent` empty): the tree of pages.
					const parentMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/parent$/u);
					if (parentMatch && request.method === 'POST') {
						const { parent, before, after } = await readJsonChange(request);
						const text = (value) => (typeof value === 'string' ? value : '');
						return json(response, 200, await articles.setParent(decodePathComponent(parentMatch[1]), text(parent), { before: text(before), after: text(after) }));
					}

					// AI 设置: the page sees no key, only whether there is one.
					if (url.pathname === '/api/studio/ai/settings') {
						if (request.method === 'GET') return json(response, 200, await aiSettings.shown());
						if (request.method === 'PUT') return json(response, 200, await aiSettings.set(await readJsonChange(request)));
					}

					// 识别: a picture of the article (`./img/…` or `./assets/…`) read by the model, as asked by `prompt`.
					const recognizeMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/recognize$/u);
					if (recognizeMatch && request.method === 'POST') {
						const slug = decodePathComponent(recognizeMatch[1]);
						const { image, prompt } = await readJsonChange(request);
						if (typeof prompt !== 'string' || !prompt.trim()) return json(response, 400, { error: '要说明识别什么（prompt）' });
						const picture = String(image ?? '').replace(/^\.\//u, '').match(/^(img|assets)\/(.+)$/u);
						if (!picture) return json(response, 400, { error: '只能识别文章自己的图片（./img/ 或 ./assets/ 里的）' });
						const { body, contentType } = await files.read(slug, picture[1], picture[2], { sizeLimit: 20 * 1024 * 1024 });
						const text = await askAboutImage(await aiSettings.config(), { image: body, mediaType: String(contentType).split(';')[0], prompt });
						return json(response, 200, { text });
					}

					// What was read from a picture, put under it in the file (the text as it was goes into history first):
					// open in the Studio, it comes as a change from outside, to accept or not.
					const belowImageMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/below-image$/u);
					if (belowImageMatch && request.method === 'POST') {
						const slug = decodePathComponent(belowImageMatch[1]);
						const { image, markdown } = await readJsonChange(request);
						if (typeof image !== 'string' || typeof markdown !== 'string' || !markdown.trim()) return json(response, 400, { error: '要给出图片和要放的内容' });
						const { source, revision } = await articles.read(slug);
						const next = insertBelowImage(source, image, markdown);
						if (next === null) return json(response, 404, { error: '没在文章里找到这张图' });
						await history.keep(slug, source, 'before-change');
						await articles.save(slug, { source: next, expectedRevision: revision });
						return json(response, 200, { slug });
					}

					// 并入上级页面: its text into the page it is under (whose text as it was goes into that page's history), then itself to the trash.
					const mergeMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/merge$/u);
					if (mergeMatch && request.method === 'POST') {
						const slug = decodePathComponent(mergeMatch[1]);
						const merged = await articles.merge(slug, { site, before: (parent, source) => history.keep(parent, source, 'before-change') });
						const { trashed } = await articles.exclusive(slug, () => manager.trashArticle(slug));
						return json(response, 200, { ...merged, trashed });
					}

					// Another folder name for an article, or a copy of it under one.
					const articleActionMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/(rename|duplicate)$/u);
					if (articleActionMatch && request.method === 'POST') {
						const slug = decodePathComponent(articleActionMatch[1]);
						const { to } = await readJsonChange(request);
						const result = articleActionMatch[2] === 'rename' ? await articles.rename(slug, to, { site }) : await articles.duplicate(slug, to);
						return json(response, articleActionMatch[2] === 'rename' ? 200 : 201, result);
					}

					// The drive (资料库): which folder it is, choosing it, what is in it, and changing that.
					if (url.pathname === '/api/studio/drive' && request.method === 'GET') return json(response, 200, await drive.describe());
					if (url.pathname === '/api/studio/drive/root' && request.method === 'POST') {
						const { path } = await readJsonChange(request);
						const chosen = await drive.choose(path);
						void driveText.refresh().catch(() => {});
						return json(response, 200, chosen);
					}
					if (url.pathname === '/api/studio/drive/choose' && request.method === 'POST') {
						assertContentType(request, 'application/json');
						const chosen = await chooseFolder('选择资料库文件夹');
						if (!chosen) return json(response, 200, { ...(await drive.describe()), cancelled: true });
						const described = await drive.choose(chosen);
						void driveText.refresh().catch(() => {});
						return json(response, 200, described);
					}
					if (url.pathname === '/api/studio/drive/search' && request.method === 'GET') {
						return json(response, 200, await driveText.search(url.searchParams.get('q') ?? ''));
					}
					if (url.pathname === '/api/studio/drive/list' && request.method === 'GET') {
						return json(response, 200, { entries: await drive.list(url.searchParams.get('path') ?? '') });
					}
					const driveFileMatch = rawPathname.match(/^\/api\/studio\/drive\/files\/(.+)$/u);
					if (driveFileMatch && request.method === 'GET') {
						return await file(response, await drive.stream(driveFileMatch[1].split('/').map(decodePathComponent).join('/')));
					}
					const driveActionMatch = url.pathname.match(/^\/api\/studio\/drive\/(upload|folders|move|trash|restore|reveal)$/u);
					if (driveActionMatch && request.method === 'POST') {
						const action = driveActionMatch[1];
						// What changes in the drive is read for its words once the change is done.
						if (action !== 'reveal') response.once('finish', () => void driveText.refresh().catch(() => {}));
						if (action === 'upload') {
							assertContentType(request, 'application/octet-stream');
							const declared = Number(request.headers['content-length']);
							if (declared > drive.uploadSizeLimit) return json(response, 413, { error: `文件超过 ${drive.uploadSizeLimit / 1024 / 1024} MB 上传上限` });
							return json(response, 201, await drive.upload(url.searchParams.get('folder') ?? '', url.searchParams.get('name') ?? '', request, { replace: url.searchParams.get('replace') === '1' }));
						}
						const body = await readJsonChange(request);
						if (action === 'folders') return json(response, 201, await drive.createFolder(body.path));
						if (action === 'move') return json(response, 200, await drive.move(body.from, body.to));
						if (action === 'trash') return json(response, 200, await drive.trash(body.path));
						if (action === 'restore') return json(response, 200, await drive.restore(body.trashed));
						const absolute = await drive.locate(body.path ?? '');
						// Browser tests must not open windows on the machine running them.
						if (!testDriveRoot) await revealInFileManager(absolute, { isDirectory: (await lstat(absolute)).isDirectory() });
						return json(response, 200, { path: body.path ?? '' });
					}

					// Match the raw path so URL normalization cannot erase an attempted `..` traversal.
					const fileMatch = rawPathname.match(/^\/api\/studio\/articles\/([^/]+)\/files\/([^/]+)\/(.+)$/u);
					if (fileMatch && request.method === 'GET') {
						const slug = decodePathComponent(fileMatch[1]);
						const root = decodePathComponent(fileMatch[2]);
						const resourcePath = decodePathComponent(fileMatch[3]);
						return await file(response, await files.stream(slug, root, resourcePath, { range: request.headers.range }));
					}

					// Earlier versions of an article, kept in its ai/history: the list, one of them, one more.
					const historyMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/history(?:\/([^/]+))?$/u);
					if (historyMatch) {
						const slug = decodePathComponent(historyMatch[1]);
						const name = historyMatch[2] ? decodePathComponent(historyMatch[2]) : null;
						if (!name && request.method === 'GET') return json(response, 200, { versions: await history.list(slug) });
						if (name && request.method === 'GET') return json(response, 200, { source: await history.read(slug, name) });
						if (!name && request.method === 'POST') {
							const { source, reason } = await readJsonChange(request);
							return json(response, 201, await history.keep(slug, source, reason));
						}
					}

					// A work added to the article's library (assets/refs.bib) by its DOI.
					const referencesMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/references$/u);
					if (referencesMatch && request.method === 'POST') {
						const slug = decodePathComponent(referencesMatch[1]);
						const { doi } = await readJsonChange(request);
						return json(response, 200, await library.addDoi(slug, doi));
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

					// The project's plugins (插件): each, the environments it is in, whether it is on, how its server side is doing; one turned on or off.
					if (url.pathname === '/api/studio/plugins' && (request.method === 'GET' || request.method === 'PUT')) {
						const kernel = await plugins;
						let disabled = await pluginSettings.disabled();
						if (request.method === 'PUT') {
							const { id, enabled } = await readJsonChange(request);
							if (!listPlugins(server.config.root).some((plugin) => plugin.id === id)) return json(response, 404, { error: `没有叫 ${id} 的插件` });
							disabled = await pluginSettings.setEnabled(id, enabled);
							await kernel.setDisabled(disabled);
						}
						return json(response, 200, {
							plugins: listPlugins(server.config.root).map((plugin) => ({
								...plugin,
								enabled: !disabled.includes(plugin.id),
								server: plugin.entries.includes('server.mjs') ? kernel.status(plugin.id) : null,
							})),
						});
					}

					// A plugin's API (plugins/*/server.mjs): what it answers, as JSON; a change must say it is JSON.
					if (url.pathname.startsWith('/api/studio/plugins/')) {
						const found = (await plugins).routes.match(request.method ?? 'GET', rawPathname.slice('/api/studio/plugins'.length));
						if (found) {
							if (request.method !== 'GET') assertContentType(request, 'application/json');
							const answer = readAnswer(await found.handler({ params: found.params, query: url.searchParams, json: () => readJson(request), request }));
							return json(response, answer.status, answer.value);
						}
					}

					// The articles that link to this one.
					const backlinksMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/backlinks$/u);
					if (backlinksMatch && request.method === 'GET') {
						return json(response, 200, { backlinks: await articles.backlinks(decodePathComponent(backlinksMatch[1]), { site }) });
					}

					// The mark the page keeps its picture of itself under (page-version.mjs).
					const versionMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/page-version$/u);
					if (versionMatch && request.method === 'GET') {
						return json(response, 200, { version: await pageVersion(blogRoot, decodePathComponent(versionMatch[1])) });
					}

					// A code block's `@file`, drawn as the blog draws it.
					const codeFileMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/code-file$/u);
					if (codeFileMatch && request.method === 'GET') {
						const slug = decodePathComponent(codeFileMatch[1]);
						const { searchParams: query } = url;
						const figure = await codeFiles.figure(slug, query.get('path') ?? '', query.get('language') ?? '', query.get('meta') ?? '');
						return json(response, 200, { figure });
					}

					const managerMatch = url.pathname.match(/^\/api\/studio\/articles\/([^/]+)\/(tree|files|folders|move|trash|restore|reveal|import)$/u);
					if (managerMatch) {
						const slug = decodePathComponent(managerMatch[1]);
						const action = `${request.method} ${managerMatch[2]}`;
						if (action === 'GET tree') return json(response, 200, { entries: await manager.list(slug) });
						if (action === 'POST files') {
							assertContentType(request, 'application/octet-stream');
							const declared = Number(request.headers['content-length']);
							const name = url.searchParams.get('name') ?? '';
							const limit = manager.uploadLimitFor(name);
							if (declared > limit) return json(response, 413, { error: `文件超过 ${limit / 1024 / 1024} MB 上传上限` });
							const uploaded = await manager.upload(slug, url.searchParams.get('folder') ?? '', name, request, {
								replace: url.searchParams.get('replace') === '1',
								subfolders: (url.searchParams.get('subfolder') ?? '').split('/').filter(Boolean),
							});
							return json(response, 201, uploaded);
						}
						// A file of the drive, copied into the article (`img/` or `assets/`) under a name a link takes.
						if (action === 'POST import') {
							const { from, folder } = await readJsonChange(request);
							const source = await drive.stream(String(from ?? ''));
							const limit = manager.uploadLimitFor(source.name);
							if (source.size > limit) {
								source.body.destroy();
								return json(response, 413, { error: `${source.name} 有 ${Math.round(source.size / 1024 / 1024)} MB，超过文章文件 ${limit / 1024 / 1024} MB 的上限` });
							}
							try {
								return json(response, 201, await manager.upload(slug, folder ?? 'assets', source.name, source.body));
							} finally {
								source.body.destroy();
							}
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
							// What was written kept as a version every while (as Notion keeps a page's history).
							return json(response, 200, await articles.save(slug, await readJson(request), { site, before: (current) => history.keepWritten(slug, current) }));
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
