import { t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/** Where RetainPDF's pages are when nothing else is set: its desktop app and its development stack both serve them here. */
export const DEFAULT_RETAINPDF_URL = 'http://127.0.0.1:40001/';

/**
 * Where RetainPDF's pages look for its API when their config does not say (or says it in code, as its development
 * stack's `${window.location.protocol}//…:41000`): the page's own address over https, else this port of its host
 * (frontend/packages/api/src/internal/runtime.ts in RetainPDF, `apiBase()`).
 */
export const RETAINPDF_API_PORT = 41000;

/** How long what RetainPDF's pages say of its API is used before they are asked again. */
const FOUND_FOR_MS = 30_000;

/**
 * 翻译 (the left column): RetainPDF's own pages, shown in the middle. `retainpdfUrl` in the Studio's settings says where
 * they are; not set, the default above. Only http(s) addresses: the page is put in a frame as it is.
 *
 * The books, read by the AIs and 书's ＋ (retainpdf-library.mjs): RetainPDF's API and its key (its X-API-Key). Nothing
 * to fill in: they are what RetainPDF's pages are told (`findApi`), as its reader shown in 翻译 is: the address
 * (`apiBase`) and key (`xApiKey`) of its runtime config, which its development stack fills in from the backend's own
 * key, its desktop app writes into its pages, and its Docker leaves empty (the API behind the same address, the key
 * added on the way). Set in the settings, `retainpdfApiUrl` and `retainpdfApiKey` are used instead. A key, found or
 * set, is kept here and used by the Studio's server alone: never shown back, only whether there is one.
 */
export class RetainpdfSettings {
	/**
	 * @param {string} settingsFile the Studio's settings (.studio-settings.json)
	 * @param {{ fetch?: typeof fetch, now?: () => number }} [options]
	 */
	constructor(settingsFile, { fetch: fetching = globalThis.fetch, now = Date.now } = {}) {
		this.settingsFile = settingsFile;
		this.fetch = fetching;
		this.now = now;
		/** @type {{ page: string, at: number, api: string, key: string } | null} */
		this.found = null;
	}

	/**
	 * The addresses used, whether the page's is the default, whether the API's is set, whether a key is set; what was
	 * found from RetainPDF's pages (the API's address, whether there is a key).
	 */
	async shown() {
		const saved = await readSettings(this.settingsFile);
		const url = typeof saved.retainpdfUrl === 'string' && saved.retainpdfUrl ? saved.retainpdfUrl : DEFAULT_RETAINPDF_URL;
		const apiUrl = typeof saved.retainpdfApiUrl === 'string' ? saved.retainpdfApiUrl : '';
		const found = await this.findApi(url);
		return {
			url,
			default: DEFAULT_RETAINPDF_URL,
			isDefault: url === DEFAULT_RETAINPDF_URL,
			apiUrl,
			api: apiUrl || found.api || url,
			keySet: Boolean(saved.retainpdfApiKey),
			found: { api: found.api || null, key: Boolean(found.key) },
		};
	}

	/** Where its API is and its key, for the Studio's server to ask it (never sent to a page): as set, else as found. */
	async connection() {
		const saved = await readSettings(this.settingsFile);
		const { url, api } = await this.shown();
		const key = typeof saved.retainpdfApiKey === 'string' && saved.retainpdfApiKey ? saved.retainpdfApiKey : (await this.findApi(url)).key;
		return { api, key };
	}

	/** What was found let go: asked again next time (its API said no, or did not answer: RetainPDF started since?). */
	forgetFound() {
		this.found = null;
	}

	/**
	 * What RetainPDF's pages at `page` are told of its API, in the order its pages load it: `runtime-config.js` and
	 * `runtime-config.local.js` (its development stack's, the key put in by its server), then the page itself (its
	 * desktop app writes the config at its end); the last said wins. Nothing found (not running, an older one, nothing said): empty. Asked again
	 * after FOUND_FOR_MS.
	 * @param {string} page
	 * @returns {Promise<{ api: string, key: string }>}
	 */
	async findApi(page) {
		if (this.found?.page === page && this.now() - this.found.at < FOUND_FOR_MS) return this.found;
		const said = [];
		for (const path of ['runtime-config.js', 'runtime-config.local.js', '']) {
			try {
				const answer = await this.fetch(new URL(path, page), { signal: AbortSignal.timeout(3000) });
				if (answer.ok) said.push(await answer.text());
			} catch {
				// Not there: what the others say.
			}
		}
		const config = runtimeConfig(said.join('\n'));
		let api = '';
		try {
			if (config.apiBase) api = new URL(config.apiBase, page).href;
			else if (said.length) {
				// Its pages answered without saying where: where they look then.
				const at = new URL(page);
				api = at.protocol === 'https:' ? `${at.origin}/` : `http://${at.hostname}:${RETAINPDF_API_PORT}/`;
			}
		} catch {
			api = '';
		}
		this.found = { page, at: this.now(), api, key: config.xApiKey };
		return this.found;
	}

	/**
	 * Sets what is given (a string alone: the page's address, as before): `url` empty, or the default, is the default
	 * again; `apiUrl` empty is where the pages are; `apiKey` empty takes the key away, not given keeps it.
	 * @param {string | { url?: unknown, apiUrl?: unknown, apiKey?: unknown }} given
	 */
	async set(given) {
		const asked = typeof given === 'string' || given === undefined || given === null ? { url: given } : given;
		const url = 'url' in asked ? address(asked.url) : undefined;
		const apiUrl = 'apiUrl' in asked ? address(asked.apiUrl) : undefined;
		const apiKey = typeof asked.apiKey === 'string' ? asked.apiKey.trim() : undefined;
		await updateSettings(this.settingsFile, (settings) => {
			const next = { ...settings };
			if (url !== undefined) {
				delete next.retainpdfUrl;
				if (url && url !== DEFAULT_RETAINPDF_URL) next.retainpdfUrl = url;
			}
			if (apiUrl !== undefined) {
				delete next.retainpdfApiUrl;
				if (apiUrl) next.retainpdfApiUrl = apiUrl;
			}
			if (apiKey !== undefined) {
				delete next.retainpdfApiKey;
				if (apiKey) next.retainpdfApiKey = apiKey;
			}
			return next;
		});
		return this.shown();
	}
}

/**
 * The API's address and key in RetainPDF's runtime config (window.__FRONT_RUNTIME_CONFIG__) as written: `apiBase: "…"`
 * in an object (or JSON's `"apiBase":"…"`), or `c.xApiKey = "…"` set after; the last one that says something, for each.
 * Read, never run.
 * @param {string} text
 */
export function runtimeConfig(text) {
	const last = (name) => {
		const pattern = new RegExp(`(?:\\b${name}["']?\\s*:|\\.${name}\\s*=)\\s*("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*')`, 'gu');
		let value = '';
		for (const match of text.matchAll(pattern)) {
			const quoted = match[1];
			let said;
			try {
				said = quoted.startsWith('"') ? JSON.parse(quoted) : quoted.slice(1, -1).replace(/\\(.)/gu, '$1');
			} catch {
				continue;
			}
			if (typeof said === 'string' && said.trim()) value = said.trim();
		}
		return value;
	};
	return { apiBase: last('apiBase'), xApiKey: last('xApiKey') };
}

/** An http(s) address as it is kept (empty for none); anything else an error to say. */
function address(value) {
	const given = typeof value === 'string' ? value.trim() : '';
	if (!given) return '';
	let parsed;
	try {
		parsed = new URL(given);
	} catch {
		throw Object.assign(new Error(t('不是一个网址：{url}', { url: given })), { statusCode: 400 });
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw Object.assign(new Error(t('RetainPDF 的地址要以 http:// 或 https:// 开头')), { statusCode: 400 });
	return parsed.href;
}
