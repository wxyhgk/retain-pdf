import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { InlineAi } from '../ai/inline-ai.mjs';
import { accountsLoggedIn, PiModels } from '../ai/panel-models.mjs';
import { refuse, reply, sendEvents, sendFile } from '../api.mjs';
import { t } from '@blog/i18n/index.mjs';

/** The pictures an AI's answer may show from this machine, by extension. */
const PICTURES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

/**
 * The AI panel's conversations (agent-sessions.mjs): the agents it can talk to (those with an ACP adapter) and the
 * conversations going on; one begun, in the open article's folder or the repository; what it is told, stopped,
 * the leave it asks answered, its options (model, mode, effort) set; followed as events; closed.
 * @param {import('../api.mjs').StudioApi} api
 * @param {import('./index.mjs').Studio} studio
 */
export function conversationRoutes(api, { blogRoot, conversations, agentSettings, panelModels, articles, drive, programEnv, articleFolder }) {
	const agents = async () => (await agentSettings.config()).list.filter((agent) => agent.acp);
	/** Claude Code and pi talk to the services chosen in the panel (panel-models.mjs); Codex to its own. */
	const isClaude = (agent) => /(^|\/)claude-agent-acp(\s|$)/u.test(agent.acp);
	const isPi = (agent) => /(^|\/)pi-acp(\s|$)/u.test(agent.acp);
	const piModels = new PiModels(panelModels.settingsFile, conversations.binFolder);
	const serviceOf = async (agent) => {
		if (isClaude(agent)) return { env: await panelModels.env(), models: await panelModels.models() };
		if (isPi(agent)) return { env: await piModels.env(), models: await piModels.service() };
		return { env: {}, models: null };
	};

	api.get('/conversations', async () => ({
		agents: (await agents()).map(({ id, name }) => ({ id, name })),
		default: (await agentSettings.config()).default,
		conversations: await conversations.list(),
	}));
	// A conversation goes on in blog/ whatever article is open (blog/AGENTS.md read there): each thing said is told
	// which one is, with the lines selected and the articles named with @ (contextOf).
	api.post('/conversations', async ({ json }) => {
		const { agent: wanted, page } = await json();
		const agent = (await agents()).find((candidate) => candidate.id === wanted);
		if (!agent) throw refuse(404, t('没有能在面板里用的 AI「{id}」', { id: wanted }));
		const service = await serviceOf(agent);
		const begun = { agent, cwd: blogRoot, env: { ...programEnv(null, await drive.root()), ...service.env }, models: service.models };
		const session = await conversations.start(begun);
		if (page === true) await conversations.makePage(session);
		// The next one begun with this AI made ready meanwhile (its agent takes seconds to start).
		conversations.prepare(begun);
		return reply(201, session.summary());
	});
	/** A conversation to speak to: one over (kept in chats/, its agent gone) gone on with, its agent started again. */
	const awake = async (id) => {
		const session = await conversations.find(id);
		if (!['saved', 'closed', 'failed'].includes(session.state)) return session;
		const agent = (await agents()).find((candidate) => candidate.id === session.agent.id);
		if (!agent) throw refuse(404, t('「{name}」不能在面板里用了：新开一个对话', { name: session.agent.name }));
		const service = await serviceOf(agent);
		return conversations.wake(session, { agent, env: { ...programEnv(null, await drive.root()), ...service.env }, models: service.models });
	};
	/**
	 * The page's account of where the author is, made the agent's: each article by its file from blog/, as it is there,
	 * and its ai/brief.md if it has one (blog/AGENTS.md: read it first), so the agent need not try for one not there.
	 */
	const contextOf = async (asked) => {
		if (!asked || typeof asked !== 'object') return {};
		const known = new Map((await articles.list()).map((entry) => [entry.slug, entry]));
		const article = async (slug) => {
			const found = typeof slug === 'string' ? known.get(slug) : null;
			if (!found) return null;
			const brief = join(articleFolder(slug), 'ai', 'brief.md');
			const hasBrief = await access(brief).then(() => true, () => false);
			return { title: found.title || slug, path: relative(blogRoot, join(articleFolder(slug), 'index.md')), brief: hasBrief ? relative(blogRoot, brief) : null };
		};
		const open = await article(asked.article);
		const selection = open && asked.selection && Number.isInteger(asked.selection.start) && Number.isInteger(asked.selection.end) && typeof asked.selection.text === 'string'
			? { start: asked.selection.start, end: asked.selection.end, text: asked.selection.text.slice(0, 20_000) }
			: null;
		const mentions = (await Promise.all((Array.isArray(asked.mentions) ? asked.mentions : []).map(article))).filter(Boolean).filter((entry) => entry.path !== open?.path);
		return { ...(open ? { article: open } : {}), ...(selection ? { selection } : {}), ...(mentions.length ? { mentions } : {}) };
	};
	api.get('/conversations/:id/events', async ({ params, request, response }) => {
		// One kept in chats/ is read back, shown as it was left.
		const session = await conversations.find(params.id);
		sendEvents(request, response, (send) => session.subscribe(send));
	}, { streams: true });
	api.post('/conversations/:id/prompt', async ({ params, json }) => {
		const { text, context, steer } = await json();
		const session = await awake(params.id);
		// Said while it works (pi in this process): taken once its step is done.
		if (steer === true && session.state === 'running') session.steer(text);
		else session.prompt(text, await contextOf(context));
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
		if (typeof configId !== 'string' || (typeof value !== 'string' && typeof value !== 'boolean')) throw refuse(400, t('要给出选项和它的值'));
		return (await awake(params.id)).configure(configId, value);
	});
	// A conversation of the AI tab opened as a page (问答为主): its page made if it has none yet.
	api.post('/conversations/:id/page', async ({ params }) => {
		const session = await conversations.find(params.id);
		// Listed once something is said in it: one not spoken to is not made a page of.
		if (!session.madePage && session.pageThrough === null && session.items.some((item) => item.kind === 'user')) await conversations.makePage(session);
		return session.summary();
	});
	// A picture an AI's answer shows from this machine (a plot it drew in ai/work/…): its path as written, absolute
	// or from blog/ (where the agents work).
	api.get('/conversations/picture', async ({ query, request, response }) => {
		const written = (query.get('path') ?? '').replace(/^file:\/\//u, '');
		const path = isAbsolute(written) ? written : resolve(blogRoot, written);
		const contentType = PICTURES[extname(path).toLowerCase()];
		if (!contentType) throw refuse(415, t('只显示图片（png、jpg、gif、webp、svg）'));
		const info = await stat(path).catch(() => null);
		if (!info?.isFile()) throw refuse(404, t('没有这张图：{path}', { path: written }));
		void request;
		await sendFile(response, { body: createReadStream(path), contentType, size: info.size, range: null });
	}, { streams: true });
	// A conversation gone: its folder of chats/ too.
	api.post('/conversations/:id/delete', async ({ params }) => {
		await conversations.remove(params.id);
		return { id: params.id };
	});
	// Which service Claude Code talks to, its key and models; whether the accounts are logged in; the service tried.
	api.get('/panel-models', () => panelModels.shown());
	api.put('/panel-models', async ({ json }) => panelModels.set(await json()));
	api.post('/panel-models/check', () => panelModels.check());
	api.get('/panel-models/accounts', () => accountsLoggedIn(conversations.binFolder));
	// pi's: the service and its key; tried with a word, its models listed.
	api.get('/panel-models/pi', () => piModels.shown());
	api.put('/panel-models/pi', async ({ json }) => piModels.set(await json()));
	api.post('/panel-models/pi/check', () => piModels.check());

	// The AI in the editor (inline-ai.mjs): a session of the AI chosen made ready; one thing asked; stopped.
	const inline = new InlineAi({
		sessions: conversations,
		cwd: blogRoot,
		start: async (agentId) => {
			const agent = (await agents()).find((candidate) => candidate.id === agentId);
			if (!agent) throw refuse(404, t('没有能用的 AI「{id}」', { id: agentId }));
			const service = await serviceOf(agent);
			return { agent, env: { ...programEnv(null, await drive.root()), ...service.env }, models: service.models };
		},
	});
	api.post('/inline/warm', async ({ json }) => {
		const { agent } = await json();
		void inline.warm(String(agent ?? '')).catch(() => {});
		return { agent };
	});
	api.post('/inline', async ({ json }) => {
		const asked = await json();
		const text = (value) => (typeof value === 'string' ? value : '');
		if (asked.mode !== 'rewrite' && asked.mode !== 'write') throw refuse(400, t('mode 只能是 rewrite 或 write'));
		if (!text(asked.instruction).trim()) throw refuse(400, t('要说明让 AI 做什么'));
		const { article } = await contextOf({ article: asked.slug });
		if (!article) throw refuse(404, t('没有这篇文章'));
		const options = asked.options && typeof asked.options === 'object' ? Object.fromEntries(Object.entries(asked.options).filter(([, value]) => typeof value === 'string')) : {};
		return inline.ask({ id: text(asked.id), agent: text(asked.agent), options, mode: asked.mode, instruction: text(asked.instruction), article, selected: text(asked.selected), before: text(asked.before), after: text(asked.after) });
	});
	api.post('/inline/:id/cancel', ({ params }) => {
		inline.cancel(params.id);
		return { id: params.id };
	});

	api.post('/conversations/:id/close', ({ params }) => {
		conversations.close(params.id);
		return { id: params.id };
	});
}
