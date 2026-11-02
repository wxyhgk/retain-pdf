import { listPlugins } from '@blog/kernel/node.mjs';
import { readAnswer } from '@blog/kernel/routes.mjs';
import { refuse, reply } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * The project's plugins (插件): each, the environments it is in, whether it
 * is on, how its server side is doing; one turned on or off. And their API
 * (plugins/*\/server.mjs), under /api/studio/plugins/, after the same checks.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function pluginRoutes(api, { projectRoot, plugins, pluginSettings }) {
	const shown = async (disabled) => {
		const kernel = await plugins;
		return {
			plugins: listPlugins(projectRoot).map((plugin) => ({
				...plugin,
				enabled: !disabled.includes(plugin.id),
				server: plugin.entries.includes('server.mjs') ? kernel.status(plugin.id) : null,
			})),
		};
	};
	api.get('/plugins', async () => shown(await pluginSettings.disabled()));
	api.put('/plugins', async ({ json }) => {
		const { id, enabled } = await json();
		if (!listPlugins(projectRoot).some((plugin) => plugin.id === id)) throw refuse(404, t('没有叫 {id} 的插件', { id }));
		const disabled = await pluginSettings.setEnabled(id, enabled);
		await (await plugins).setDisabled(disabled);
		return shown(disabled);
	});

	for (const method of ['GET', 'POST', 'PUT']) {
		api.route(method, '/plugins/*rest', async ({ path, query, request, json }) => {
			const found = (await plugins).routes.match(method, path.slice('/plugins'.length));
			if (!found) throw refuse(404, t('Studio API 不存在'));
			const answer = readAnswer(await found.handler({ params: found.params, query, json, request }));
			return reply(answer.status, answer.value);
		});
	}
}
