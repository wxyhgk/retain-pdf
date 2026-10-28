import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { keepLastGood } from '../system/last-good.mjs';

/**
 * The Studio's own settings (not the AI's, not the plugins'): the language it speaks. And whether it has started: the
 * page says so once its article is shown, which Studio.app waits for (a Studio that does not get there was broken by an
 * edit: it offers the last good version), and the code's commit is kept as that version (last-good.mjs).
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function settingRoutes(api, { localeSettings, projectRoot }) {
	api.get('/settings/locale', () => localeSettings.shown());
	api.put('/settings/locale', async ({ json }) => localeSettings.set((await json())?.locale));
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
		await mkdir(join(projectRoot, '.astro'), { recursive: true });
		await appendFile(join(projectRoot, '.astro/studio-notes.log'), `==== ${new Date().toISOString()}\n${what.slice(0, 8000)}\n`);
		return { kept: true };
	});
}
