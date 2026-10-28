import { sendFile } from '../api.mjs';

/**
 * 代码仓库 (src/studio/server/repos/repositories.mjs): the list, those on this machine to add, one added, made, taken
 * off; a folder of one (with its README), a file, a file as it is (a picture). For the 小程序 (`studio.repos.*`).
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function repoRoutes(api, { repositories }) {
	api.get('/repos', async () => ({ repositories: await repositories.list() }));
	api.get('/repos/found', async () => ({ found: await repositories.discover() }));
	api.post('/repos', async ({ json }) => {
		const asked = (await json()) ?? {};
		return asked.path ? repositories.add(asked.path) : repositories.create(asked);
	});
	api.delete('/repos/:id', async ({ params }) => ({ removed: await repositories.remove(params.id) }));
	api.get('/repos/:id/tree', async ({ params, query }) => repositories.tree(params.id, query.get('dir') ?? ''));
	api.get('/repos/:id/file', async ({ params, query }) => repositories.file(params.id, query.get('path') ?? ''));
	api.get('/repos/:id/raw/*path', async ({ params, response }) => sendFile(response, await repositories.raw(params.id, params.path)), { streams: true });
}
