import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveInside } from '../../../articles/bundle-paths.mjs';
import { colorDeclarations, siteColors } from '../../../styles/palette.mjs';
import { publicFetch } from './public-fetch.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * 小程序: small tools the author (or an AI, by the skill studio-mini-apps)
 * makes for the Studio, each a folder of `apps/` at the repository's root:
 *
 *     apps/energy-units/
 *       app.json   { "name": "能量单位换算", "icon": "⚡", "description": "…",
 *                    "width": 360, "height": 420, "permissions": ["insert"] }
 *       app.html   what it is: markup, style, script (and other files beside it)
 *
 * Each runs in a floating window of the Studio, in a frame of the Studio's own
 * origin (`/studio-apps/<id>/`): the author's own tools, not sandboxed (as the
 * author has them). It loads the files of its folder as any page does
 * (`./lib.js`, `fetch('./data.json')`), and `/vendor/…`; `studio` (BRIDGE) does
 * what a page cannot: the article, its files, inserting, fetching across sites,
 * running commands. `permissions` in app.json is no longer asked for.
 *
 * An app can also be a project of its own (React, TypeScript, npm packages, a server of its own: docs/apps-design.md):
 * `dev` in its app.json says how its development server is started, which the Studio runs (project-apps.mjs) and puts
 * under the same address (app-proxy.mjs). Where it is on this machine, when it is not in its folder, is said in
 * `app.local.json` beside it (not committed: the repository is public), whose fields go over app.json's.
 *
 *     "dev": { "command": ["npm", "run", "dev", "--", "--port", "{port}", "--base", "{base}"], "backend": ["npm", "run", "backend"] }
 *
 * And an app can be a block of the articles (`blocks`): a fence of its own (```structura), its state the fence's body,
 * shown in the article by a page of the app (`entry`, under its address) with `studio.block` to read and change it.
 *
 *     "blocks": [{ "fence": "structura", "entry": "block.html", "height": 420, "title": "结构式" }]
 */

export const APP_PERMISSIONS = Object.freeze({
	article: '读当前文章', // i18n-ignore: not shown
	insert: '往光标处插入内容', // i18n-ignore: not shown
	files: '读写当前文章的文件', // i18n-ignore: not shown
	net: '联网', // i18n-ignore: not shown
	run: '在后台运行命令', // i18n-ignore: not shown
});

const ID = /^[a-z0-9][a-z0-9-]{0,47}$/u;
const TEXT = 'text/plain; charset=utf-8';
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.wasm': 'application/wasm',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.txt': TEXT,
	'.md': TEXT,
	'.csv': 'text/csv; charset=utf-8',
	'.tsv': 'text/tab-separated-values; charset=utf-8',
	// Molecules and inputs, as text.
	'.sdf': TEXT,
	'.mol': TEXT,
	'.xyz': TEXT,
	'.pdb': TEXT,
	'.cif': TEXT,
	'.gjf': TEXT,
	'.inp': TEXT,
};

/** Messages between an app and the Studio carry this. */
export const APP_MESSAGE = 'studio-app';

/**
 * What `studio` (BRIDGE) asks the Studio, by name: the same list as the skill studio-mini-apps and the React template's
 * studio.d.ts (the tests hold them to it).
 */
export const STUDIO_CALLS = Object.freeze(['article', 'insert', 'files.list', 'files.read', 'files.write', 'fetch', 'run', 'toast', 'appFile', 'storage.get', 'storage.set', 'openPage', 'block.get', 'block.set', 'block.picture', 'notes.code', 'notes.images', 'repos.list', 'repos.found', 'repos.add', 'repos.create', 'repos.remove', 'repos.tree', 'repos.file']);

/** What a new app starts as: one page, or a Vite + React + TypeScript project (templates/). */
export const APP_TEMPLATES = Object.freeze({ page: '一页网页', react: 'Vite + React + TypeScript 项目' }); // i18n-ignore: written into the app

const TEMPLATES = fileURLToPath(new URL('./templates/', import.meta.url));

/**
 * How a project app is run: its commands (`{port}`, `{base}` put in), in its folder.
 * @typedef {{ cwd: string, command: string[], backend: string[] | null }} AppDev
 * A block an app gives the articles: its fence, the page of the app that shows it, how tall it starts.
 * @typedef {{ fence: string, entry: string, height: number, title: string }} AppBlock
 * A command an app gives ⌘K (`> …`): its window opened at `entry` (a page of its, or `#…` it reads).
 * @typedef {{ id: string, title: string, entry: string }} AppCommand
 * @typedef {{ id: string, name: string, icon: string, description: string, width: number, height: number, permissions: string[], kind: 'page' | 'project', blocks: AppBlock[], commands: AppCommand[], problem?: string }} MiniApp
 */

/** The commands app.json says the app gives, those written right. */
function commandsOf(written) {
	if (!Array.isArray(written)) return [];
	return written.flatMap((command) => {
		if (!command || typeof command !== 'object' || typeof command.id !== 'string' || !/^[a-z][\w-]{0,31}$/u.test(command.id)) return [];
		if (typeof command.title !== 'string' || !command.title.trim()) return [];
		const entry = typeof command.entry === 'string' ? command.entry.replace(/^\.?\/+/u, '') : '';
		if (entry.split('/').includes('..')) return [];
		return [{ id: command.id, title: command.title.trim(), entry }];
	});
}

/** A fence an app's block may take: a word of its own, not a language of code. */
const FENCE = /^[a-z][a-z0-9-]{1,31}$/u;

/** The blocks app.json says the app gives, those written right. */
function blocksOf(written, id) {
	if (!Array.isArray(written)) return [];
	return written.flatMap((block) => {
		if (!block || typeof block !== 'object' || typeof block.fence !== 'string' || !FENCE.test(block.fence)) return [];
		const entry = typeof block.entry === 'string' ? block.entry.replace(/^\.?\/+/u, '') : '';
		if (entry.split('/').includes('..')) return [];
		const height = Number.isFinite(block.height) ? Math.max(120, Math.min(1600, Math.round(block.height))) : 420;
		return [{ fence: block.fence, entry, height, title: typeof block.title === 'string' && block.title.trim() ? block.title.trim() : id }];
	});
}

/** A command as app.json writes it: a list of words, the first the program. */
const command = (value) => (Array.isArray(value) && value.length && value.every((word) => typeof word === 'string' && word) ? value : null);

export class MiniApps {
	/** @param {string} folder the repository's apps/ */
	constructor(folder) {
		this.folder = folder;
	}

	/** Every app, by name; one whose app.json cannot be read is listed with what is wrong (`problem`). */
	async list() {
		let names;
		try {
			names = await readdir(this.folder, { withFileTypes: true });
		} catch {
			return [];
		}
		const apps = [];
		for (const entry of names) {
			if (!entry.isDirectory() || !ID.test(entry.name)) continue;
			apps.push(await this.#read(entry.name));
		}
		return apps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
	}

	/** @returns {Promise<MiniApp | null>} */
	async get(id) {
		if (!ID.test(String(id))) return null;
		const found = (await stat(join(this.folder, id)).catch(() => null))?.isDirectory();
		return found ? this.#read(id) : null;
	}

	async #read(id) {
		return (await this.#manifest(id)).app;
	}

	/** An app's app.json, with its app.local.json over it: the app as listed, and how it is run when it is a project. */
	async #manifest(id) {
		const plain = { id, name: id, icon: '◆', description: '', width: 380, height: 480, permissions: [], kind: 'page', blocks: [], commands: [] };
		let manifest;
		try {
			manifest = JSON.parse(await readFile(join(this.folder, id, 'app.json'), 'utf8'));
		} catch (error) {
			return { app: { ...plain, problem: t('app.json 读不了：{error}', { error: error instanceof Error ? error.message : String(error) }) }, dev: null };
		}
		let local = {};
		try {
			local = JSON.parse(await readFile(join(this.folder, id, 'app.local.json'), 'utf8'));
		} catch (error) {
			if (error?.code !== 'ENOENT') return { app: { ...plain, problem: t('app.local.json 读不了：{error}', { error: error instanceof Error ? error.message : String(error) }) }, dev: null };
		}
		const text = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
		const size = (value, fallback) => (Number.isFinite(value) ? Math.max(200, Math.min(1600, Math.round(value))) : fallback);
		const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.filter((name) => name in APP_PERMISSIONS) : [];
		const app = { id, name: text(manifest.name, id), icon: text(manifest.icon, '◆'), description: text(manifest.description, ''), width: size(manifest.width, plain.width), height: size(manifest.height, plain.height), permissions, kind: 'page', blocks: blocksOf(manifest.blocks, id), commands: commandsOf(manifest.commands) };
		const written = manifest.dev && typeof manifest.dev === 'object' ? manifest.dev : null;
		if (!written) return { app, dev: null };
		app.kind = 'project';
		// A path of this machine in what is committed: said, not run.
		if (typeof written.cwd === 'string' && isAbsolute(written.cwd)) return { app: { ...app, problem: t('app.json 里写了本机路径（dev.cwd）：写进不提交的 app.local.json') }, dev: null };
		const dev = { ...written, ...(local.dev && typeof local.dev === 'object' ? local.dev : {}) };
		const run = command(dev.command);
		if (!run) return { app: { ...app, problem: t('dev.command 要是一串词，比如 ["npm", "run", "dev", "--", "--port", "{port}", "--base", "{base}"]') }, dev: null };
		const folder = join(this.folder, id);
		const cwd = typeof dev.cwd === 'string' && dev.cwd.trim() ? resolve(folder, dev.cwd) : folder;
		return { app, dev: { cwd, command: run, backend: command(dev.backend) } };
	}

	/** Where an app's code is: its project's folder (`dev.cwd`), or its own; null for none. */
	async root(id) {
		if (!ID.test(String(id))) return null;
		const { app, dev } = await this.#manifest(id);
		if (app.problem && !dev) return (await this.get(id)) ? join(this.folder, id) : null;
		return dev?.cwd ?? join(this.folder, id);
	}

	/**
	 * A new app named `name`, from a template: its folder (a name of its own, from the name's letters or the time), the
	 * template's files with its name put in. Its manifest, as listed.
	 * @param {{ name: string, template: keyof typeof APP_TEMPLATES }} asked
	 */
	async create({ name, template }) {
		const plain = String(name ?? '').replace(/[<>{}&"'`\\]/gu, '').trim().slice(0, 40);
		if (!plain) throw Object.assign(new Error(t('要给小程序起个名字')), { statusCode: 400 });
		if (!Object.hasOwn(APP_TEMPLATES, template)) throw Object.assign(new Error(t('没有这个模板：{template}', { template })), { statusCode: 400 });
		const words = plain.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 32);
		let id = /^[a-z]/u.test(words) && words.length > 1 ? words : `app-${Date.now().toString(36)}`;
		for (let n = 2; await stat(join(this.folder, id)).catch(() => null); n += 1) id = `${id.replace(/-\d+$/u, '')}-${n}`;
		const target = join(this.folder, id);
		await mkdir(this.folder, { recursive: true });
		await cp(join(TEMPLATES, template), target, { recursive: true });
		// Its name where the template says {{name}}.
		const walk = async (folder) => {
			for (const entry of await readdir(folder, { withFileTypes: true })) {
				const path = join(folder, entry.name);
				if (entry.isDirectory()) await walk(path);
				else if (/\.(json|html|tsx?|md)$/u.test(entry.name)) await writeFile(path, (await readFile(path, 'utf8')).replaceAll('{{name}}', plain));
			}
		};
		await walk(target);
		return { ...(await this.#read(id)), folder: relative(resolve(this.folder, '..'), target) };
	}

	/**
	 * How a project app is run, or null for an app that is a page (or none, or one that cannot be read).
	 * @returns {Promise<AppDev | null>}
	 */
	async dev(id) {
		if (!ID.test(String(id))) return null;
		const { app, dev } = await this.#manifest(id);
		return app.problem ? null : dev;
	}

	/**
	 * A file of an app, for its frame: its pages (`app.html` for `''`) with the notes' style and the bridge put first in
	 * their head, the others as they are. Null when there is none.
	 * @returns {Promise<{ type: string, body: string | Buffer } | null>}
	 */
	async file(id, path) {
		if (!ID.test(String(id))) return null;
		const name = path || 'app.html';
		let file;
		try {
			file = resolveInside(join(this.folder, id), name);
		} catch {
			return null;
		}
		const body = await readFile(file).catch(() => null);
		if (!body) return null;
		const type = TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';
		// Its pages (app.html and any other of its folder) with `studio`; its other files as they are.
		return extname(name).toLowerCase() === '.html' ? { type, body: appDocument(body.toString('utf8')) } : { type, body };
	}
}

/** What `studio.fetch` asks, fetched by the Studio: anywhere, this machine and its network too (an app's own server). */
export function proxyFetch(asked) {
	return publicFetch(asked, { allowed: () => true });
}

const STYLE = `
:root { ${colorDeclarations(siteColors('light'))} color-scheme: light; }
:root[data-theme='dark'] { ${colorDeclarations(siteColors('dark'))} color-scheme: dark; }
html, body { margin: 0; background: var(--surface); }
body { color: var(--ink); font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif; overflow-wrap: anywhere; }
canvas, svg, img, video { max-width: 100%; }
input, button, select, textarea { font: inherit; color: inherit; accent-color: var(--ink); }
input, select, textarea { padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
button { padding: 3px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); cursor: pointer; }
button:hover { background: var(--soft); }
:focus-visible { outline: 2px solid var(--muted); outline-offset: 2px; }
`;

// The notes' colors only, for a project's own page (its style is its own).
const COLORS = `
:root { ${colorDeclarations(siteColors('light'))} }
:root[data-theme='dark'] { ${colorDeclarations(siteColors('dark'))} }
`;

// Runs in the app's frame first: what goes wrong in it is told to the Studio (its window shows it, for an AI to mend).
const ERRORS = `
(() => {
	const KIND = ${JSON.stringify(APP_MESSAGE)};
	const words = (value) => {
		// WebKit's stack has only where it was, not what.
		if (value instanceof Error) return value.stack?.includes(value.message) ? value.stack : String(value) + (value.stack ? '\\n' + value.stack : '');
		if (typeof value === 'string') return value;
		try { return JSON.stringify(value); } catch { return String(value); }
	};
	const say = (message) => {
		try { parent.postMessage({ kind: KIND, type: 'error', message: String(message).slice(0, 4000) }, '*'); } catch {}
	};
	addEventListener('error', (event) => {
		const target = event.target;
		if (target && target !== window && (target.src || target.href)) say(${JSON.stringify(t('加载失败：'))} + (target.src || target.href));
		else if (target === window) say(event.error ? words(event.error) : event.message + (event.filename ? ' (' + event.filename + ':' + event.lineno + ')' : ''));
	}, true);
	addEventListener('unhandledrejection', (event) => say(words(event.reason)));
	const original = console.error.bind(console);
	console.error = (...args) => {
		say(args.map(words).join(' '));
		original(...args);
	};
})();
`;

// Runs in the app's frame: `studio`, each call a message to the Studio, answered.
const BRIDGE = `
(() => {
	const KIND = ${JSON.stringify(APP_MESSAGE)};
	const root = document.documentElement;
	const listeners = [];
	const notesListeners = [];
	let asked = 0;
	const answers = new Map();
	// The line to the Studio, given once this page is ready; calls made before wait for it.
	let port = null;
	const waiting = [];
	const call = (method, ...args) => new Promise((resolve, reject) => {
		asked += 1;
		answers.set(asked, { resolve, reject });
		const message = { type: 'call', id: asked, method, args };
		if (port) port.postMessage(message);
		else waiting.push(message);
	});
	const heard = (data) => {
		if (!data) return;
		if (data.type === 'answer') {
			const answer = answers.get(data.id);
			answers.delete(data.id);
			if (answer) 'error' in data ? answer.reject(new Error(data.error)) : answer.resolve(data.result);
		} else if (data.type === 'theme' && data.theme !== studio.theme) {
			studio.theme = root.dataset.theme = data.theme;
			for (const listener of listeners) listener(studio.theme);
		} else if (data.type === 'notes-changed') {
			for (const listener of notesListeners) listener();
		}
	};
	const studio = {
		theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
		onTheme(listener) { listeners.push(listener); },
		color(name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); },
		article: () => call('article'),
		insert: (markdown) => call('insert', String(markdown)),
		files: { list: () => call('files.list'), read: (path) => call('files.read', String(path)), write: (path, text) => call('files.write', String(path), String(text)) },
		fetch: (url, init = {}) => call('fetch', String(url), init),
		run: (argv, options = {}) => call('run', argv, options),
		toast: (text) => call('toast', String(text)),
		appFile: (path) => call('appFile', String(path)),
		storage: { get: (key) => call('storage.get', String(key)), set: (key, value) => call('storage.set', String(key), value) },
		// Opened at the first block holding \`find\` (a line of code, a picture's path), when given.
		openPage: (slug, options = {}) => call('openPage', String(slug), options),
		// What is scattered in all the notes, gathered by the Studio: their code, their pictures; \`onChange\` when a note
		// or its files changed (asked again then).
		notes: {
			code: () => call('notes.code'),
			images: () => call('notes.images'),
			onChange(listener) { notesListeners.push(listener); },
		},
		// The git repositories on this machine the Studio shows (its own in repos/, and those added).
		repos: {
			list: () => call('repos.list'),
			found: () => call('repos.found'),
			add: (path) => call('repos.add', String(path)),
			create: (name, description = '') => call('repos.create', String(name), String(description)),
			remove: (id) => call('repos.remove', String(id)),
			tree: (id, dir = '') => call('repos.tree', String(id), String(dir)),
			file: (id, path) => call('repos.file', String(id), String(path)),
		},
		// In a block of an article: its state (the fence's body) and options (its info string), changed by \`set\`; its
		// picture for the blog (SVG text, or a PNG's data: address). Null in a window.
		block: {
			get: () => call('block.get'),
			set: (state) => call('block.set', String(state)),
			picture: (data, type = 'image/svg+xml') => call('block.picture', String(data), String(type)),
		},
	};
	root.dataset.theme = studio.theme;
	window.studio = studio;
	addEventListener('message', (event) => {
		const data = event.data;
		if (port || event.source !== parent || !data || data.kind !== KIND || data.type !== 'port' || !event.ports[0]) return;
		port = event.ports[0];
		port.onmessage = (message) => heard(message.data);
		heard({ type: 'theme', theme: data.theme });
		for (const message of waiting.splice(0)) port.postMessage(message);
	});
	parent.postMessage({ kind: KIND, type: 'ready' }, '*');
})();
`;

/** What goes first in the head of an app's page: for a page app the notes' style too, for a project its colors only. */
function appHead(project) {
	const style = project ? COLORS : STYLE;
	return `${project ? '' : '<meta charset="utf-8"><meta name="viewport" content="width=device-width">'}<style>${style}</style><script>${ERRORS}</script><script>${BRIDGE}</script>`;
}

/** An app's page with the notes' style and `studio` first in its head; a project's page (`project`) keeps its own style. */
export function appDocument(source, { project = false } = {}) {
	const head = appHead(project);
	const text = String(source ?? '');
	if (/<head[\s>]/iu.test(text)) return text.replace(/<head(\s[^>]*)?>/iu, (tag) => tag + head);
	if (/<html[\s>]/iu.test(text)) return text.replace(/<html(\s[^>]*)?>/iu, (tag) => `${tag}<head>${head}</head>`);
	return `<!doctype html><html><head>${head}</head><body>${text}</body></html>`;
}
