import { delimiter, resolve, sep } from 'node:path';
import { ArticleFiles } from '../studio/server/articles/article-files.mjs';
import { ArticleGit } from '../studio/server/articles/article-git.mjs';
import { ArticleHistory } from '../studio/server/articles/article-history.mjs';
import { ArticleLibrary } from '../studio/server/articles/article-library.mjs';
import { ArticleRepository } from '../studio/server/articles/article-repository.mjs';
import { BlogWatcher } from '../studio/server/articles/blog-watcher.mjs';
import { CodeFilePreviews } from '../studio/server/articles/code-file-previews.mjs';
import { Drive } from '../studio/server/drive/drive.mjs';
import { DriveText, TEXT_FOLDER } from '../studio/server/drive/drive-text.mjs';
import { articleBundlePaths, chatsRootOf, resolveInside } from '../articles/bundle-paths.mjs';
import { ArticleFileManager, TRASH_FOLDER } from '../studio/server/files/file-manager.mjs';
import { FileRepository } from '../studio/server/files/file-repository.mjs';
import { TerminalHost } from '../studio/server/system/terminal-host.mjs';
import { AgentSettings } from '../studio/server/ai/agent-settings.mjs';
import { AgentSessions } from '../studio/server/ai/agent-sessions.mjs';
import { ChatStore } from '../studio/server/ai/chat-store.mjs';
import { PanelModels } from '../studio/server/ai/panel-models.mjs';
import { MiniApps } from '../studio/server/apps/mini-apps.mjs';
import { Tasks } from '../studio/server/tasks/tasks.mjs';
import { markContentReloads } from '../studio/server/articles/content-reloads.mjs';
import { studioBlogRoot } from '../studio/server/articles/page-version.mjs';
import { atomicWriteText } from '../studio/server/files/atomic-write.mjs';
import { serverKernel } from '@blog/kernel/node.mjs';
import { LocaleSettings, studioSettingsFile } from '../studio/server/locale-settings.mjs';
import { PluginSettings } from '../studio/server/plugin-settings.mjs';
import { AiSettings } from '../studio/server/ai/ai-settings.mjs';
import { decodePathComponent, sendFile, sendJson } from '../studio/server/api.mjs';
import { studioApi } from '../studio/server/routes/index.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The Studio on the dev server: its parts put together, the files of articles
 * and 小程序 served, and its API (src/studio/server/routes/, every request
 * checked in src/studio/server/api.mjs).
 * @param {{ site?: string }} [options] the blog's address, so links to its articles written in full count as theirs
 */
/**
 * Why the server ends, said where its output goes (.astro/dev.log, for Studio.app): who called `process.exit` (its
 * stack), the app gone (its stdin closed), an error nothing caught, its exit code. Said only: nothing is changed.
 */
let toldWhyItEnds = false;
function sayWhyItEnds() {
	if (toldWhyItEnds) return;
	toldWhyItEnds = true;
	const say = (what) => process.stderr.write(`[studio] ${new Date().toISOString()} 服务器要退出：${what}\n`); // i18n-ignore: developer log
	const exit = process.exit.bind(process);
	process.exit = (code) => {
		say(`process.exit(${code ?? ''})，调用它的是：\n${new Error('exit').stack?.split('\n').slice(2, 12).join('\n')}`); // i18n-ignore: developer log
		return exit(code);
	};
	// Listened to only where listening changes nothing: a listener for a signal, or for a rejection, would change how
	// the process ends (Node's own way, and tasks.mjs's, which looks at how many listen).
	process.stdin.prependListener?.('end', () => say('stdin 关了（Studio.app 退出了？）')); // i18n-ignore: developer log
	process.on('uncaughtExceptionMonitor', (error) => say(`没接住的错误：${error?.stack ?? error}`)); // i18n-ignore: developer log
	process.once('exit', (code) => say(`退出码 ${code}`)); // i18n-ignore: developer log
}

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
			sayWhyItEnds();
			// Browser tests point the Studio at a copy of their fixtures instead of blog/.
			const testBlogRoot = process.env.STUDIO_BLOG_DIR ? resolve(process.env.STUDIO_BLOG_DIR) : null;
			const blogRoot = studioBlogRoot(server.config.root);
			const history = new ArticleHistory(blogRoot);
			// What the Studio rewrites in other pages (links that follow a page) is kept as a version first; links
			// follow a title once it has stayed a few seconds as typed.
			const articles = new ArticleRepository(blogRoot, { keep: (slug, source) => history.keep(slug, source, 'before-change'), retitleAfter: 3000 });
			const files = new FileRepository(blogRoot);
			const codeFiles = new CodeFilePreviews(files);
			// Removed files wait here, outside blog/ and ignored by git, until someone empties it.
			const manager = new ArticleFileManager(blogRoot, {
				trashRoot: testBlogRoot ? resolve(testBlogRoot, TRASH_FOLDER) : resolve(server.config.root, TRASH_FOLDER),
			});
			const articleFiles = new ArticleFiles(articles, manager);
			const articleGit = new ArticleGit(blogRoot);
			const library = new ArticleLibrary(blogRoot, articles);
			const watcher = new BlogWatcher(blogRoot);
			// A page put under another by someone else (an AI editing its file): a page block for it there, as when it is
			// moved in the Studio.
			let stopped = false;
			let unfollow = () => {};
			server.httpServer?.on('close', () => {
				stopped = true;
				unfollow();
			});
			void articles.followParents().then(() => {
				if (stopped) return;
				unfollow = watcher.subscribe((changes) => {
					const written = changes.filter((change) => change.paths.includes('') || change.paths.includes('index.md')).map((change) => change.slug);
					if (written.length) articles.followParents(written).catch((error) => console.warn(`[studio] ${error instanceof Error ? error.message : error}`));
				});
			});
			// The author's own folder of files (资料库), chosen once and kept outside git; the browser tests bring their own.
			const testDriveRoot = process.env.STUDIO_DRIVE_DIR ? resolve(process.env.STUDIO_DRIVE_DIR) : null;
			const settingsFile = studioSettingsFile(server.config.root);
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
			// The AI panel's conversations, with the agents' ACP adapters of the project's dependencies.
			// Kept in chats/ beside blog/ (out of git), each a page; the browser tests' beside their copy of blog/.
			const chats = new ChatStore(chatsRootOf(blogRoot));
			const conversations = new AgentSessions({ binFolder: resolve(server.config.root, 'node_modules', '.bin'), store: chats });
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
				conversations.closeAll();
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

			const api = studioApi({
				site,
				projectRoot: server.config.root,
				blogRoot,
				testing: { blog: Boolean(testBlogRoot), drive: Boolean(testDriveRoot) },
				articleFolder: (slug) => articleBundlePaths(blogRoot, slug).directory,
				programEnv,
				articles,
				history,
				files,
				codeFiles,
				manager,
				articleFiles,
				articleGit,
				library,
				watcher,
				drive,
				driveText,
				terminals,
				tasks,
				miniApps,
				pluginSettings,
				localeSettings: new LocaleSettings(settingsFile),
				aiSettings,
				agentSettings,
				conversations,
				panelModels: new PanelModels(settingsFile),
				plugins,
			});

			server.middlewares.use(async (request, response, next) => {
				const rawPathname = (request.url ?? '/').split('?', 1)[0];
				// A 小程序's files, for its frame: the Studio's own origin, not sandboxed (the author's own tools).
				const appFileMatch = rawPathname.match(/^\/studio-apps\/([^/]+)\/(.*)$/u);
				if (appFileMatch && request.method === 'GET') {
					// Only to the Studio's own pages (its frames, the app's own files) and to the author typing the address:
					// not sandboxed, an app opened by another site would act as the Studio.
					const site = request.headers['sec-fetch-site'];
					if (site && site !== 'same-origin' && site !== 'none') return sendJson(response, 403, { error: t('小程序只能在 Studio 里打开') });
					try {
						const found = await miniApps.file(decodePathComponent(appFileMatch[1]), decodePathComponent(appFileMatch[2]));
						if (!found) return sendJson(response, 404, { error: t('没有这个小程序文件') });
						response.writeHead(200, {
							'Content-Type': found.type,
							'Cache-Control': 'no-store',
							'X-Content-Type-Options': 'nosniff',
						});
						return response.end(found.body);
					} catch (error) {
						const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
						return sendJson(response, status, { error: error instanceof Error ? error.message : t('读不到小程序文件') });
					}
				}
				const publicFileMatch = rawPathname.match(/^\/article-assets\/([^/]+)\/([^/]+)\/(.+)$/u);
				if (publicFileMatch && request.method === 'GET') {
					try {
						const slug = decodePathComponent(publicFileMatch[1]);
						const root = decodePathComponent(publicFileMatch[2]);
						const resourcePath = decodePathComponent(publicFileMatch[3]);
						return await sendFile(response, await files.stream(slug, root, resourcePath, { range: request.headers.range }));
					} catch (error) {
						const message = error instanceof Error ? error.message : t('文章资源读取失败');
						const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
						return sendJson(response, status, { error: message });
					}
				}
				if (!(await api.handle(request, response))) next();
			});
		},
	};
}
