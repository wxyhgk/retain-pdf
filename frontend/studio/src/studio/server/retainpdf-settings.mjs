import { t } from '@blog/i18n/index.mjs';
import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/** Where RetainPDF's pages are when nothing else is set: its desktop app and its development stack both serve them here. */
export const DEFAULT_RETAINPDF_URL = 'http://127.0.0.1:40001/';

/**
 * 翻译 (the left column): RetainPDF's own pages, shown in the middle. `retainpdfUrl` in the Studio's settings says where
 * they are; not set, the default above. Only http(s) addresses: the page is put in a frame as it is.
 */
export class RetainpdfSettings {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile) {
		this.settingsFile = settingsFile;
	}

	/** The address used, and whether it is the default. */
	async shown() {
		const saved = (await readSettings(this.settingsFile)).retainpdfUrl;
		const url = typeof saved === 'string' && saved ? saved : DEFAULT_RETAINPDF_URL;
		return { url, default: DEFAULT_RETAINPDF_URL, isDefault: url === DEFAULT_RETAINPDF_URL };
	}

	/** Set to `url`; empty, or the default, is the default again (nothing kept). */
	async set(url) {
		const given = typeof url === 'string' ? url.trim() : '';
		let address = '';
		if (given) {
			let parsed;
			try {
				parsed = new URL(given);
			} catch {
				throw Object.assign(new Error(t('不是一个网址：{url}', { url: given })), { statusCode: 400 });
			}
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw Object.assign(new Error(t('RetainPDF 的地址要以 http:// 或 https:// 开头')), { statusCode: 400 });
			address = parsed.href;
		}
		await updateSettings(this.settingsFile, (settings) => {
			const { retainpdfUrl: _, ...rest } = settings;
			return address && address !== DEFAULT_RETAINPDF_URL ? { ...rest, retainpdfUrl: address } : rest;
		});
		return this.shown();
	}
}
