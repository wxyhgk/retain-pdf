import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

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
 * Each runs in a floating window of the Studio, in a frame with no origin of
 * its own (it cannot reach the Studio), and does what it may through `studio`
 * (APP_BRIDGE): what its `permissions` name, the Studio checking each call.
 */

export const APP_PERMISSIONS = Object.freeze({
	article: '读当前文章', // i18n-ignore: not shown
	insert: '往光标处插入内容', // i18n-ignore: not shown
	files: '读写当前文章的文件', // i18n-ignore: not shown
	net: '联网', // i18n-ignore: not shown
	run: '在后台运行命令', // i18n-ignore: not shown
});

const ID = /^[a-z0-9][a-z0-9-]{0,47}$/u;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };

/** Messages between an app and the Studio carry this. */
export const APP_MESSAGE = 'studio-app';

/**
 * @typedef {{ id: string, name: string, icon: string, description: string, width: number, height: number, permissions: string[], problem?: string }} MiniApp
 */

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
		const plain = { id, name: id, icon: '◆', description: '', width: 380, height: 480, permissions: [] };
		let manifest;
		try {
			manifest = JSON.parse(await readFile(join(this.folder, id, 'app.json'), 'utf8'));
		} catch (error) {
			return { ...plain, problem: t('app.json 读不了：{error}', { error: error instanceof Error ? error.message : String(error) }) };
		}
		const text = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
		const size = (value, fallback) => (Number.isFinite(value) ? Math.max(200, Math.min(1600, Math.round(value))) : fallback);
		const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.filter((name) => name in APP_PERMISSIONS) : [];
		return { id, name: text(manifest.name, id), icon: text(manifest.icon, '◆'), description: text(manifest.description, ''), width: size(manifest.width, plain.width), height: size(manifest.height, plain.height), permissions };
	}

	/**
	 * A file of an app, for its frame: `app.html` (`''`) with the notes' style and the bridge put first in its head,
	 * the others as they are. Null when there is none.
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
		return name === 'app.html' ? { type, body: appDocument(body.toString('utf8')) } : { type, body };
	}
}

/** What `studio.fetch` asks, fetched by the Studio: to the internet only (public-fetch.mjs). */
export function proxyFetch(asked) {
	return publicFetch(asked);
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

// Runs in the app's frame: `studio`, each call a message to the Studio, answered.
const BRIDGE = `
(() => {
	const KIND = ${JSON.stringify(APP_MESSAGE)};
	const root = document.documentElement;
	const listeners = [];
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
		openPage: (slug) => call('openPage', String(slug)),
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

/** An app's page with the notes' style and `studio` first in its head. */
export function appDocument(source) {
	const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${STYLE}</style><script>${BRIDGE}</script>`;
	const text = String(source ?? '');
	if (/<head[\s>]/iu.test(text)) return text.replace(/<head(\s[^>]*)?>/iu, (tag) => tag + head);
	if (/<html[\s>]/iu.test(text)) return text.replace(/<html(\s[^>]*)?>/iu, (tag) => `${tag}<head>${head}</head>`);
	return `<!doctype html><html><head>${head}</head><body>${text}</body></html>`;
}
