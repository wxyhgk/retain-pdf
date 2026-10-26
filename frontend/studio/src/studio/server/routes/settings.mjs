/**
 * The Studio's own settings (not the AI's, not the plugins'): the language it speaks.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function settingRoutes(api, { localeSettings }) {
	api.get('/settings/locale', () => localeSettings.shown());
	api.put('/settings/locale', async ({ json }) => localeSettings.set((await json())?.locale));
}
