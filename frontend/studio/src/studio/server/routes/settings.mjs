import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { keepLastGood } from '../system/last-good.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The Studio's own settings (not the AI's, not the plugins'): the language it speaks, where RetainPDF is. And whether it has started: the
 * page says so once its article is shown, which Studio.app waits for (a Studio that does not get there was broken by an
 * edit: it offers the last good version), and the code's commit is kept as that version (last-good.mjs).
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function settingRoutes(api, { localeSettings, retainpdfSettings, retainpdfLibrary, retainpdfReading, projectRoot, remote }) {
	// 其他设备访问 (remote/remote-access.mjs): seen and changed on this machine only, never from a device let in by it.
	const here = (request) => {
		if (request.headers['x-studio-remote']) throw Object.assign(new Error(t('其他设备访问只能在这台 Mac 上设置')), { statusCode: 403 });
	};
	api.get('/remote', async ({ request }) => {
		here(request);
		return remote.shown();
	});
	api.put('/remote', async ({ request, json }) => {
		here(request);
		return remote.setEnabled((await json())?.enabled === true);
	});
	api.post('/remote/pairing', async ({ request }) => {
		here(request);
		return remote.pairingCode();
	});
	api.delete('/remote/devices/:id', async ({ request, params }) => {
		here(request);
		return remote.removeDevice(params.id);
	});
	api.get('/settings/locale', () => localeSettings.shown());
	api.put('/settings/locale', async ({ json }) => localeSettings.set((await json())?.locale));
	api.get('/settings/retainpdf', () => retainpdfSettings.shown());
	// Its pages' address, its API's and its key (never shown back: keySet says whether there is one).
	api.put('/settings/retainpdf', async ({ json }) => {
		const { url, apiUrl, apiKey } = (await json()) ?? {};
		return retainpdfSettings.set({ url, ...(apiUrl !== undefined ? { apiUrl } : {}), ...(apiKey !== undefined ? { apiKey } : {}) });
	});
	// Whether its API answers with that key (the books the AIs read: retainpdf-library.mjs).
	api.get('/settings/retainpdf/check', () => retainpdfLibrary.check());
	// RetainPDF's books, the latest read first: 书's ＋, a book to open beside a note (book-tabs.ts).
	api.get('/retainpdf/books', ({ query }) => retainpdfLibrary.listBooks({ query: query.get('q') || undefined, limit: 30 }));
	// ⌘K: the words in RetainPDF's books (their source and translation), a few hits.
	api.get('/retainpdf/search', ({ query }) => retainpdfLibrary.searchBooks({ query: query.get('q') ?? '', limit: 8 }));
	// What is read in 翻译 (retainpdf-reading.mjs): said by the page, told the AIs.
	api.get('/retainpdf/reading', () => ({ reading: retainpdfReading.get() }));
	api.put('/retainpdf/reading', async ({ json }) => ({ reading: retainpdfReading.set(await json()) }));
	let started = null;
	api.post('/started', async () => {
		started ??= new Date().toISOString();
		// A Studio opened from the last good version (STUDIO_RESCUE) keeps nothing: its code is that version.
		const kept = process.env.STUDIO_RESCUE === '1' ? { commit: null, why: 'rescue' } : await keepLastGood(projectRoot);
		return { started, kept };
	});
	api.get('/started', () => ({ started }));
	// What the page saw going wrong that it cannot tell itself (overflow-watch.ts): kept for whoever looks into it.
	api.post('/notes', async ({ json }) => {
		const { what } = (await json()) ?? {};
		if (typeof what !== 'string' || !what) return { kept: false };
		await mkdir(join(projectRoot, '.studio-cache'), { recursive: true });
		await appendFile(join(projectRoot, '.studio-cache', 'studio-notes.log'), `==== ${new Date().toISOString()}\n${what.slice(0, 8000)}\n`);
		return { kept: true };
	});
}
