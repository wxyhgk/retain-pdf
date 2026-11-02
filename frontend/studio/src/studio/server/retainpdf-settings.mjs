import { t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/** Where RetainPDF's pages are when nothing else is set: its desktop app and its development stack both serve them here. */
export const DEFAULT_RETAINPDF_URL = 'http://127.0.0.1:40001/';

/**
 * 翻译 (the left column): RetainPDF's own pages, shown in the middle. `retainpdfUrl` in the Studio's settings says where
 * they are; not set, the default above. Only http(s) addresses: the page is put in a frame as it is.
 *
 * The books, read by the AIs (retainpdf-library.mjs): RetainPDF's API, at `retainpdfApiUrl` (not set: where its pages
 * are, as its desktop app serves both; its development stack has it on a port of its own), with its key
 * (`retainpdfApiKey`, its X-API-Key). The key is kept here and used by the Studio's server alone: it is never shown back,
 * only whether there is one.
 */
export class RetainpdfSettings {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile) {
		this.settingsFile = settingsFile;
	}

	/** The addresses used, whether the page's is the default, whether the API's is set, whether there is a key. */
	async shown() {
		const saved = await readSettings(this.settingsFile);
		const url = typeof saved.retainpdfUrl === 'string' && saved.retainpdfUrl ? saved.retainpdfUrl : DEFAULT_RETAINPDF_URL;
		const apiUrl = typeof saved.retainpdfApiUrl === 'string' ? saved.retainpdfApiUrl : '';
		return { url, default: DEFAULT_RETAINPDF_URL, isDefault: url === DEFAULT_RETAINPDF_URL, apiUrl, api: apiUrl || url, keySet: Boolean(saved.retainpdfApiKey) };
	}

	/** Where its API is and its key, for the Studio's server to ask it (never sent to a page). */
	async connection() {
		const saved = await readSettings(this.settingsFile);
		const { api } = await this.shown();
		return { api, key: typeof saved.retainpdfApiKey === 'string' ? saved.retainpdfApiKey : '' };
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
