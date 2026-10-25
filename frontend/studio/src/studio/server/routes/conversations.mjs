import { refuse, reply, sendEvents } from '../api.mjs';

/**
 * The AI panel's conversations (agent-sessions.mjs): the agents it can talk to (those with an ACP adapter) and the
 * conversations going on; one begun, in the open article's folder or the repository; what it is told, stopped,
 * the leave it asks answered, its options (model, mode, effort) set; followed as events; closed.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function conversationRoutes(api, { projectRoot, conversations, agentSettings, manager, drive, programEnv, articleFolder }) {
	const agents = async () => (await agentSettings.config()).list.filter((agent) => agent.acp);

	api.get('/conversations', async () => ({
		agents: (await agents()).map(({ id, name }) => ({ id, name })),
		default: (await agentSettings.config()).default,
		conversations: conversations.list(),
	}));
	api.post('/conversations', async ({ json }) => {
		const { agent: wanted, slug } = await json();
		const agent = (await agents()).find((candidate) => candidate.id === wanted);
		if (!agent) throw refuse(404, `没有能在面板里用的 AI「${wanted}」`);
		const article = typeof slug === 'string' && slug ? slug : null;
		if (article) await manager.locate(article, '');
		const session = await conversations.start({ agent, cwd: article ? articleFolder(article) : projectRoot, slug: article, env: programEnv(article, await drive.root()) });
		return reply(201, session.summary());
	});
	api.get('/conversations/:id/events', ({ params, request, response }) => {
		const session = conversations.get(params.id);
		sendEvents(request, response, (send) => session.subscribe(send));
	}, { streams: true });
	api.post('/conversations/:id/prompt', async ({ params, json }) => {
		conversations.get(params.id).prompt((await json()).text);
		return reply(202, { id: params.id });
	});
	api.post('/conversations/:id/cancel', ({ params }) => {
		conversations.get(params.id).cancel();
		return { id: params.id };
	});
	api.post('/conversations/:id/permissions/:permission', async ({ params, json }) => {
		const { option } = await json();
		conversations.get(params.id).answer(params.permission, typeof option === 'string' ? option : null);
		return { id: params.id };
	});
	api.post('/conversations/:id/options', async ({ params, json }) => {
		const { configId, value } = await json();
		if (typeof configId !== 'string' || (typeof value !== 'string' && typeof value !== 'boolean')) throw refuse(400, '要给出选项和它的值');
		return conversations.get(params.id).configure(configId, value);
	});
	api.post('/conversations/:id/close', ({ params }) => {
		conversations.close(params.id);
		return { id: params.id };
	});
}
