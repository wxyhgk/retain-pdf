#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, mergeConfig } from 'vite';

import { builtPage, CLIENT_BASE, CLIENT_TYPES, ClientBuilds, sharedConfig, SITE } from './client-build.mjs';
import milkdownSource from '../plugins/milkdown-source.mjs';
import { PAGES } from './page/page-styles.mjs';
import { notesRoot } from './server/notes-root.mjs';
import studioDev from '../plugins/studio-dev.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The Studio on a server of its own: Vite's, with the Studio's parts (studio-dev.mjs: its API, the files of articles
 * and 小程序), its pages (page/render.tsx) and its code changed and seen at once, as on Astro's dev server before; the
 * blog's own server (astro dev) is not needed to write, and nothing of the blog's (a page that does not build, its
 * reloads) is in the Studio's way.
 *
 *     node src/studio/serve.mjs [--port 4321] [--host 127.0.0.1]
 *
 * While it runs it says where (its process and address) in `.studio-cache/server.json`, as `astro dev` did in
 * `.astro/dev.json`: Studio.app and the `studio` command find it there.
 */

/** Where a running Studio says where it is. */
export const SERVER_FILE = join('.studio-cache', 'server.json');

/**
 * A page's stylesheets in it as Vite keeps them while it serves (as Astro's dev server put them): each in a <style>
 * named by its module (`data-vite-dev-id`), and its module asked for too, so that a script importing the same
 * stylesheet (the editor imports Crepe's) changes that one, in its place, not another one after the page's own; and a
 * stylesheet changed is changed in the page at once.
 */
async function styleTags(server, root, imports) {
	const client = server.environments.client;
	const importer = resolve(root, 'src', 'studio', 'page', 'render.tsx');
	const tags = [];
	for (const imported of imports) {
		const id = (await client.pluginContainer.resolveId(imported, importer))?.id;
		if (!id) throw new Error(`[studio] 找不到样式表 ${imported}`); // i18n-ignore: developer log
		// Where Vite serves it: by its path in the project, or (outside it: third_party/milkdown may be a link) as a file.
		const inside = relative(root, id);
		const url = inside.startsWith('..') || isAbsolute(inside) ? `/@fs${id}` : `/${inside.split(sep).join('/')}`;
		const css = (await client.transformRequest(`${url}${url.includes('?') ? '&' : '?'}direct`))?.code ?? '';
		tags.push(`<style type="text/css" data-vite-dev-id="${id.replaceAll('"', '&quot;')}">${css.replaceAll('</style', '<\\/style')}</style>`, `<script type="module" src="${url.replaceAll('"', '&quot;')}"></script>`);
	}
	return tags.join('\n\t\t');
}

/** The blog's pages (src/pages/): what is asked for of them here goes to the blog's own server. */
const BLOG_PAGE = /^\/(?:blog|wiki|about|tags|rss\.xml|sitemap[^/]*\.xml)(?:\/|$)/u;

/**
 * The blog itself (「博客首页」, 在博客上打开): the notes' own (notes-root.mjs), on its own server, Astro's, not this one. One running already (`astro dev`
 * in a terminal: `.astro/dev.json`) is used; none, one is started for as long as this one runs (its output in
 * `.studio-cache/blog.log`), on the port after this one's (or the next free). The page asked for waits for it, then goes there.
 */
function blogPreview(root) {
	let starting = null;
	const running = () => {
		try {
			const { pid, url } = JSON.parse(readFileSync(resolve(root, '.astro', 'dev.json'), 'utf8'));
			process.kill(pid, 0);
			return url ?? null;
		} catch {
			return null;
		}
	};
	const start = (port) => {
		// Notes without a blog of their own (an Astro site beside blog/): nothing to show.
		if (!existsSync(resolve(root, 'astro.config.mjs'))) return Promise.reject(new Error(t('笔记文件夹里没有博客（astro.config.mjs）')));
		starting ??= new Promise((done, failed) => {
			mkdirSync(resolve(root, '.studio-cache'), { recursive: true });
			const log = openSync(resolve(root, '.studio-cache', 'blog.log'), 'w');
			const astro = spawn(process.execPath, [resolve(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'dev', '--port', String(port)], { cwd: root, stdio: ['ignore', log, log], env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' } });
			process.once('exit', () => astro.kill());
			astro.once('exit', () => {
				starting = null;
				failed(new Error(t('博客的服务器没能启动，看 .studio-cache/blog.log')));
			});
			const deadline = Date.now() + 90_000;
			const look = () => {
				const url = running();
				if (url) return done(url);
				if (Date.now() > deadline) return failed(new Error(t('博客的服务器一直没有启动完，看 .studio-cache/blog.log')));
				setTimeout(look, 300);
			};
			look();
		});
		return starting;
	};
	return {
		name: 'studio-blog-preview',
		configureServer(server) {
			server.middlewares.use(async (request, response, next) => {
				const [path, query = ''] = (request.url ?? '/').split('?', 2);
				if (request.method !== 'GET' || !BLOG_PAGE.test(path)) return next();
				try {
					// Beside this one (4322 beside 4321): Astro takes the next one free from there.
					const blog = running() ?? (await start((server.config.server.port ?? 4321) + 1));
					response.writeHead(302, { Location: new URL(`${path}${query ? `?${query}` : ''}`, blog).href, 'Cache-Control': 'no-store' });
					response.end();
				} catch (error) {
					response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
					response.end(error instanceof Error ? error.message : String(error));
				}
			});
		},
	};
}

/** The Studio's pages, drawn on the server; `/` is the Studio. */
function studioPages(root, builds) {
	return {
		name: 'studio-pages',
		configureServer(server) {
			// The Studio's code changed: the built one (for other devices) is out of date.
			server.watcher.on('all', (_event, file) => builds.changed(file));
			// The built Studio's files: each named by what it holds, kept by a device for good.
			server.middlewares.use(CLIENT_BASE, (request, response, next) => {
				const file = resolve(builds.folder, `.${decodeURIComponent((request.url ?? '/').split('?', 1)[0])}`);
				let stats = null;
				try {
					stats = file.startsWith(builds.folder + sep) ? statSync(file) : null;
				} catch {
					// Not there.
				}
				if (!stats?.isFile()) return next();
				const kept = file.startsWith(join(builds.folder, 'assets') + sep);
				response.writeHead(200, { 'Content-Type': CLIENT_TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Length': stats.size, 'Cache-Control': kept ? 'public, max-age=31536000, immutable' : 'no-cache' });
				if (request.method === 'HEAD') return response.end();
				createReadStream(file).pipe(response);
			});
			server.middlewares.use(async (request, response, next) => {
				const path = (request.url ?? '/').split('?', 1)[0];
				if (request.method !== 'GET' && request.method !== 'HEAD') return next();
				if (path === '/') {
					response.writeHead(302, { Location: '/studio' });
					return response.end();
				}
				const page = path === '/studio' || path === '/studio/' ? 'renderStudioPage' : path === '/studio/window' ? 'renderStudioWindow' : null;
				if (!page) return next();
				try {
					const render = await server.ssrLoadModule('/src/studio/page/render.tsx');
					const drawn = await render[page]({ root, acceptLanguage: request.headers['accept-language'] ?? null });
					// Another device (其他设备访问) is given the Studio built (client-build.mjs), once it is of the code as it is.
					const built = request.headers['x-studio-remote'] || process.env.STUDIO_CLIENT === 'built' ? builds.current() : null;
					const name = page === 'renderStudioPage' ? 'studio' : 'window';
					const html = built
						? builtPage(drawn.html, built.pages[name], { stylesMark: render.STYLES, entry: PAGES[name].entry, assets: builds.assetNames() })
						: await server.transformIndexHtml(request.url ?? path, drawn.html.replace(render.STYLES, await styleTags(server, root, drawn.styles)));
					// Its length told: then the door other devices come in by (remote-access.mjs) sends it compressed.
					response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store' });
					response.end(html);
				} catch (error) {
					server.ssrFixStacktrace?.(error);
					next(error);
				}
			});
		},
	};
}

/**
 * Starts the Studio's server at `root` (the repository: blog/, plugins/, apps/ in it). `vite` is added to its Vite
 * configuration (the browser tests' own cache, the folders it may serve).
 * @returns {Promise<{ server: import('vite').ViteDevServer, url: string, close(): Promise<void> }>}
 */
export async function startStudio({ root = process.cwd(), port = 4321, host = 'localhost', logLevel = 'info', site = SITE, strictPort = false, announce = false, vite = {} } = {}) {
	// The Studio built for other devices; the browser tests' built once before they start (STUDIO_CLIENT_DIR).
	const builds = new ClientBuilds({ root, ...(process.env.STUDIO_CLIENT_DIR ? { folder: resolve(process.env.STUDIO_CLIENT_DIR), fixed: true } : {}) });
	const server = await createServer(mergeConfig({
		root,
		configFile: false,
		appType: 'custom',
		logLevel,
		publicDir: resolve(root, 'public'),
		...sharedConfig({ root, site }),
		server: {
			port,
			host,
			// Taken (the blog's own astro dev there, say): the next one free, unless asked for this one only.
			strictPort,
			// What the page says in its console stays there (the Studio keeps what it needs to: keepNote).
			forwardConsole: false,
			// The articles, the conversations, the repositories: the Studio follows them itself (blog-watcher.mjs), they are
			// no module of its; what the blog builds is the blog's.
			watch: { ignored: ['**/blog/**', '**/chats/**', '**/repos/**', '**/dist/**', '**/.astro/**', '**/.studio-trash/**'] },
		},
		// Its dependencies bundled as it starts, found from its components as Astro looked for them (its scripts lead to
		// stylesheets of the editor's, which the scan cannot read); the rest as they are first asked for.
		optimizeDeps: {
			entries: ['src/studio/**/*.tsx', '!src/studio/server/**', '!src/studio/page/**'],
			// A stylesheet is not a dependency to bundle: Milkdown's, found in its source (milkdown-source.mjs), would be
			// read as one, and the scan given up.
			rolldownOptions: { plugins: [{ name: 'studio-stylesheets-aside', resolveId: (id) => (/\.css(?:$|\?)/u.test(id) ? { id, external: true } : null) }] },
		},
		plugins: [react({ include: /\/src\/studio\/.*\.tsx$/u }), tailwindcss(), milkdownSource({ root }), studioDev({ site, builds }), studioPages(root, builds), blogPreview(notesRoot(root))],
	}, vite));
	await server.listen();
	const url = server.resolvedUrls?.local[0] ?? `http://${host}:${port}/`;
	const told = resolve(root, SERVER_FILE);
	const forget = () => {
		try {
			if (JSON.parse(readFileSync(told, 'utf8')).pid === process.pid) rmSync(told);
		} catch {
			// Not there, or another's.
		}
	};
	if (announce) {
		mkdirSync(dirname(told), { recursive: true });
		writeFileSync(told, JSON.stringify({ pid: process.pid, url }));
		process.once('exit', forget);
	}
	return {
		server,
		url,
		close: async () => {
			if (announce) forget();
			await server.close();
		},
	};
}

/**
 * Started with pi's options (`--mode json -p …`): pi started again by an extension of the pi in a Studio's server that
 * took this file for pi's program (process.argv[1]). Never a second Studio for that: pi, as pi-child.mjs makes it.
 */
const PI_OPTIONS = /^(?:--mode|--print|-p|--no-session|--append-system-prompt|--tools)$/u;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.slice(2).some((word) => PI_OPTIONS.test(word))) {
	await import('./server/ai/pi-child.mjs');
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const asked = (name) => {
		const at = process.argv.indexOf(`--${name}`);
		return at > 0 ? process.argv[at + 1] : undefined;
	};
	const { url } = await startStudio({ port: Number(asked('port') ?? process.env.PORT ?? 4321), host: asked('host') ?? 'localhost', announce: true });
	// Stopped by a signal (Ctrl-C), its file stays: it names a process that is gone, which is how it is read (no signal
	// is listened for: that would change how the process ends, tasks.mjs's way). Studio.app's lifeline removes it.
	console.log(`Studio: ${url}studio`);
}
