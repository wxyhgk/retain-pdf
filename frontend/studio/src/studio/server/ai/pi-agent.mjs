import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { agent as acpAgent, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';
import { createAgentSession, createBashToolDefinition, DefaultResourceLoader, getAgentDir, ModelRuntime, SessionManager } from '@earendil-works/pi-coding-agent';

import { OPERATIONS } from '../../ops/operations.mjs';
import { createStudioOps } from '../../ops/studio-ops.mjs';
import { PI_PROVIDERS } from './panel-models.mjs';
import { t } from '@blog/i18n/index.mjs';

/**
 * pi run in the Studio's own process, as an ACP agent: what pi-acp does with a pi of its own for each conversation
 * (two processes, about 100 MB each), done here with pi's SDK, so a conversation with pi starts no process at all
 * (its shell commands still do, as they run). The Studio speaks to it as to any adapter (agent-sessions.mjs), over a
 * pair of streams in memory.
 *
 * pi's sessions are kept where pi keeps them (~/.pi/agent/sessions, or PI_CODING_AGENT_DIR's), so a conversation
 * goes on with one begun by pi-acp or pi itself. The key of the service chosen (panel-models.mjs: DEEPSEEK_API_KEY…)
 * is given to pi as its own, for these conversations; the shell commands it runs get the environment the Studio gives
 * its AIs (`studio` on PATH, the drive).
 *
 * In the Studio's process, pi gets more than an adapter can give it:
 * - the Studio's operations (ops/operations.mjs: read, search, make, move, publish pages…) as tools of its own, done
 *   here, not through the `studio` command; and show_picture, a picture put in the conversation for the author;
 * - where the author is (the article open, the lines selected: `_meta.studioContext` of a prompt) in its system
 *   prompt for that run, not in what the author said (so it is not carried on, turn after turn);
 * - words of the author's while it works (`_studio/steer`), taken once its step is done;
 * - how much of its context is used, after each turn.
 */

/** The reasoning levels, as the options show them. */
const thinkingNames = () => ({ off: t('不思考'), minimal: t('最少'), low: t('少'), medium: t('中'), high: t('多'), xhigh: t('很多'), max: t('最多') });
/** What each of pi's tools does, as ACP says it; the Studio's operations too. */
const KINDS = {
	read: 'read', ls: 'read', write: 'edit', edit: 'edit', bash: 'execute', grep: 'search', find: 'search',
	list_pages: 'read', page_tree: 'read', read_page: 'read', list_trash: 'read', list_history: 'read', read_history: 'read', git_status: 'read', check_page: 'read', show_picture: 'read',
	search_pages: 'search', backlinks: 'search', search_drive: 'search',
	create_page: 'edit', update_page: 'edit', move_page: 'edit', rename_page: 'edit', split_page: 'edit', merge_page: 'edit', restore_page: 'edit',
};
/** The Studio's operations, as the panel names them. */
const operationNames = () => ({
	list_pages: t('列出页面'), page_tree: t('看页面树'), read_page: t('读页面'), search_pages: t('搜页面'), backlinks: t('看反向链接'), create_page: t('新建页面'),
	update_page: t('改页面'), move_page: t('移动页面'), rename_page: t('改页面的文件夹名'), split_page: t('拆出子页面'), merge_page: t('并入上级页面'), delete_page: t('删页面'),
	list_trash: t('看回收站'), restore_page: t('恢复页面'), check_page: t('检查页面'), publish_page: t('发布页面'), unpublish_page: t('取消发布'), commit_page: t('提交页面'),
	git_status: t('看 git 状态'), list_history: t('看历史版本'), read_history: t('读历史版本'), search_drive: t('搜资料库'), show_picture: t('给作者看图'),
});
/** What an operation's result says, at most so long (the rest left out, said so). */
const RESULT_KEPT = 60_000;

/** The Studio's operations as pi's tools, on the project `cwd` (blog/) is in; and show_picture. */
function studioTools(cwd) {
	const root = basename(cwd) === 'blog' ? dirname(cwd) : cwd;
	let ops = null;
	const names = operationNames();
	const operations = OPERATIONS.map((operation) => ({
		name: operation.name,
		label: names[operation.name] ?? operation.name,
		description: `${operation.description}（Studio 的操作，直接用这个工具，不用通过 studio 命令）`, // i18n-ignore: for the AI
		parameters: operation.input,
		async execute(_id, params) {
			ops ??= createStudioOps({ root });
			const result = await operation.run(ops, params ?? {});
			const text = typeof result === 'string' ? result : JSON.stringify(result ?? null, null, 2);
			return { content: [{ type: 'text', text: text.length > RESULT_KEPT ? `${text.slice(0, RESULT_KEPT)}\n…（太长，后面的省略了）` : text }], details: undefined }; // i18n-ignore: for the AI
		},
	}));
	const picture = {
		name: 'show_picture',
		label: names.show_picture,
		description: '把本机的一张图片（png、jpg、gif、webp、svg）显示在和作者的对话里。画了图、要作者看的时候用它；用 read 读图只有你自己看得到，作者看不到。', // i18n-ignore: for the AI
		parameters: { type: 'object', properties: { path: { type: 'string', description: '图片的路径：绝对路径，或相对当前目录' }, caption: { type: 'string', description: '图的说明，一句话' } }, required: ['path'] }, // i18n-ignore: for the AI
		async execute(_id, params) {
			const path = isAbsolute(params.path) ? params.path : resolve(cwd, params.path);
			if (!(await stat(path).catch(() => null))?.isFile()) throw new Error(t('没有这张图：{path}', { path }));
			return { content: [{ type: 'text', text: '已经显示给作者了。' }], details: { path, caption: params.caption ?? '' } }; // i18n-ignore: for the AI
		},
	};
	return [...operations, picture];
}

/** pi in this process: the stream to speak to it over, and how to stop it (its sessions let go). */
export function piInProcess(env) {
	const toAgent = new TransformStream();
	const toClient = new TransformStream();
	const stop = servePi(ndJsonStream(toClient.writable, toAgent.readable), env);
	return { stream: ndJsonStream(toAgent.writable, toClient.readable), stop };
}

/** Serves pi's sessions as ACP on `stream`; returns how to stop. */
function servePi(stream, env) {
	const agentDir = env.PI_CODING_AGENT_DIR || undefined;
	const sessionDir = agentDir ? join(agentDir, 'sessions') : undefined;
	/** @type {Promise<ModelRuntime> | null} */
	let runtime = null;
	const models = () => {
		runtime ??= (async () => {
			const made = await ModelRuntime.create(agentDir ? { authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json') } : {});
			for (const provider of PI_PROVIDERS) {
				if (provider.env && env[provider.env]) await made.setRuntimeApiKey(provider.id, env[provider.env]);
			}
			return made;
		})();
		return runtime;
	};
	/** @type {Map<string, { session: import('@earendil-works/pi-coding-agent').AgentSession, cwd: string, stop: () => void, cancelled: boolean }>} */
	const sessions = new Map();

	/**
	 * A session of pi's (new, or one kept) with the Studio's shell and operations, where the author is in its system
	 * prompt; followed: what it does sent as ACP updates.
	 */
	async function open(cwd, manager, client) {
		const modelRuntime = await models();
		// The shell tool as pi's own, its commands given the Studio's environment.
		const bash = createBashToolDefinition(cwd, { spawnHook: (context) => ({ ...context, env: { ...context.env, ...env } }) });
		/** Where the author is, for the next run (its prompt's `_meta.studioContext`). */
		const where = { context: '' };
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			// pi's own folder, as pi would take it, unless another is named.
			agentDir: agentDir ?? getAgentDir(),
			extensionFactories: [
				(pi) => {
					pi.on('before_agent_start', (event) => {
						if (!where.context) return;
						const options = event.systemPromptOptions;
						options.appendSystemPrompt = [options.appendSystemPrompt, where.context].filter(Boolean).join('\n\n');
					});
				},
			],
		});
		const made = await resourceLoader
			.reload()
			.then(() => createAgentSession({ cwd, agentDir, modelRuntime, resourceLoader, sessionManager: manager, customTools: [bash, ...studioTools(cwd)] }))
			.catch((error) => {
				throw said(error instanceof Error ? error.message : String(error));
			});
		const { session } = made;
		const entry = { session, cwd, where, cancelled: false, stop: () => {} };
		const send = (update) => void client.notify('session/update', { sessionId: session.sessionId, update }).catch(() => {});
		entry.stop = session.subscribe(translator(cwd, send, session));
		sessions.set(session.sessionId, entry);
		return entry;
	}

	/** Its options as ACP has them: the model (pi's `provider/id`), how much it thinks. */
	async function options(session) {
		const available = await (await models()).getAvailable().catch(() => []);
		const current = session.model ? `${session.model.provider}/${session.model.id}` : '';
		// Named as pi's catalog names them (Claude Haiku 4.5), else by its id.
		const choices = available.map((model) => ({ value: `${model.provider}/${model.id}`, name: model.name || `${model.provider}/${model.id}` }));
		if (current && !choices.some((choice) => choice.value === current)) choices.unshift({ value: current, name: current });
		const levels = session.getAvailableThinkingLevels();
		const thinking = thinkingNames();
		return [
			...(choices.length ? [{ type: 'select', id: 'model', category: 'model', name: 'Model', currentValue: current, options: choices }] : []),
			...(levels.length > 1 ? [{ type: 'select', id: 'thought_level', category: 'thought_level', name: 'Thinking', currentValue: session.thinkingLevel, options: levels.map((level) => ({ value: level, name: thinking[level] ?? level })) }] : []),
		];
	}

	const known = (sessionId) => {
		const entry = sessions.get(sessionId);
		if (!entry) throw said(t('没有这个 pi 会话：{sessionId}', { sessionId }));
		return entry;
	};

	/** A request's handler, what it throws said in words (as ACP's own error), not as 「Internal error」. */
	const told = (handler) => async (request) => {
		try {
			return await handler(request);
		} catch (error) {
			throw error instanceof RequestError ? error : said(error instanceof Error ? error.message : String(error));
		}
	};

	const app = acpAgent({ name: 'studio-pi' })
		.onRequest('initialize', () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true, promptCapabilities: { image: true } }, authMethods: [] }))
		.onRequest('session/new', told(async ({ params, client }) => {
			const { session } = await open(params.cwd, SessionManager.create(params.cwd, sessionDir), client);
			return { sessionId: session.sessionId, configOptions: await options(session) };
		}))
		// One kept, gone on with: what was said in it is pi's (not told again; the Studio keeps its own).
		.onRequest('session/load', told(async ({ params, client }) => {
			if (sessions.has(params.sessionId)) return { configOptions: await options(known(params.sessionId).session) };
			const kept = (await SessionManager.list(params.cwd, sessionDir)).find((info) => info.id === params.sessionId);
			if (!kept) throw said(t('pi 那边没有这个会话了：{sessionId}', { sessionId: params.sessionId }));
			const { session } = await open(params.cwd, SessionManager.open(kept.path, sessionDir), client);
			return { configOptions: await options(session) };
		}))
		.onRequest('session/prompt', told(async ({ params }) => {
			const entry = known(params.sessionId);
			entry.cancelled = false;
			entry.where.context = typeof params._meta?.studioContext === 'string' ? params._meta.studioContext : '';
			const text = params.prompt.map((block) => (block.type === 'text' ? block.text : '')).join('');
			const images = params.prompt.filter((block) => block.type === 'image').map((block) => ({ type: 'image', data: block.data, mimeType: block.mimeType }));
			try {
				await entry.session.prompt(text, images.length ? { images } : undefined);
			} catch (error) {
				if (!entry.cancelled) throw said(error instanceof Error ? error.message : String(error));
			}
			if (entry.cancelled) return { stopReason: 'cancelled' };
			// Its service refused it (a key not right, a model not to be had): said, as an adapter's error is.
			const last = entry.session.messages.at(-1);
			if (last?.role === 'assistant' && last.stopReason === 'error') throw said(last.errorMessage || t('pi 的模型没能回答'));
			return { stopReason: 'end_turn' };
		}))
		// The author's words while it works: taken once its step is done.
		.onRequest('_studio/steer', { parse: (params) => params }, told(async ({ params }) => {
			const entry = known(params.sessionId);
			if (entry.session.isStreaming) await entry.session.steer(String(params.text ?? ''));
			else throw said(t('pi 已经做完了：直接说就行'));
			return {};
		}))
		.onNotification('session/cancel', ({ params }) => {
			const entry = sessions.get(params.sessionId);
			if (!entry) return;
			entry.cancelled = true;
			void entry.session.abort().catch(() => {});
		})
		.onRequest('session/set_config_option', told(async ({ params }) => {
			const { session } = known(params.sessionId);
			if (params.configId === 'model') {
				const at = String(params.value).indexOf('/');
				const model = (await models()).getModel(String(params.value).slice(0, at), String(params.value).slice(at + 1));
				if (!model) throw said(t('pi 没有这个模型：{value}', { value: params.value }));
				await session.setModel(model);
			} else if (params.configId === 'thought_level') {
				session.setThinkingLevel(params.value);
			}
			return { configOptions: await options(session) };
		}));
	app.connect(stream);

	return () => {
		for (const entry of sessions.values()) {
			entry.stop();
			entry.session.dispose();
		}
		sessions.clear();
	};
}

/**
 * pi's events as ACP's updates (as pi-acp has them): its words and thinking as they come, each tool as it is called,
 * runs and ends (a command's output, a file's change as a diff), retries and compaction said.
 */
function translator(cwd, send, session) {
	/** Files as they were before a tool changed them, by the tool call. */
	const before = new Map();
	const where = (args) => {
		const path = typeof args?.path === 'string' ? args.path : typeof args?.file_path === 'string' ? args.file_path : null;
		return path ? [{ path: isAbsolute(path) ? path : resolve(cwd, path) }] : undefined;
	};
	return (event) => {
		switch (event.type) {
			case 'message_update': {
				const change = event.assistantMessageEvent;
				if (change?.type === 'text_delta') send({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: change.delta } });
				else if (change?.type === 'thinking_delta') send({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: change.delta } });
				return;
			}
			case 'tool_execution_start': {
				const { toolCallId, toolName, args } = event;
				const locations = where(args);
				if ((toolName === 'edit' || toolName === 'write') && locations) {
					let old = null;
					try {
						old = readFileSync(locations[0].path, 'utf8');
					} catch {
						// A new file.
					}
					before.set(toolCallId, { path: locations[0].path, old });
				}
				const named = operationNames()[toolName];
				const title = toolName === 'bash' && typeof args?.command === 'string' ? args.command : named ? [named, args?.slug ?? args?.query ?? args?.title ?? ''].filter(Boolean).join(' ') : toolName;
				send({ sessionUpdate: 'tool_call', toolCallId, title, kind: KINDS[toolName] ?? 'other', status: 'in_progress', locations, rawInput: args });
				return;
			}
			case 'tool_execution_update': {
				const text = resultText(event.partialResult);
				if (text && !before.has(event.toolCallId)) send({ sessionUpdate: 'tool_call_update', toolCallId: event.toolCallId, status: 'in_progress', content: [{ type: 'content', content: { type: 'text', text } }] });
				return;
			}
			case 'tool_execution_end': {
				const { toolCallId, result, isError } = event;
				const changed = before.get(toolCallId);
				before.delete(toolCallId);
				let content;
				if (changed && !isError) {
					try {
						const now = readFileSync(changed.path, 'utf8');
						if (now !== changed.old) content = [{ type: 'diff', path: changed.path, oldText: changed.old, newText: now }];
					} catch {
						// Gone again.
					}
				}
				const text = resultText(result);
				if (!content && text) content = [{ type: 'content', content: { type: 'text', text } }];
				send({ sessionUpdate: 'tool_call_update', toolCallId, status: isError ? 'failed' : 'completed', ...(content ? { content } : {}) });
				// A picture shown to the author: in its words, where the panel draws it.
				if (event.toolName === 'show_picture' && !isError && result?.details?.path) {
					send({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `\n\n![${String(result.details.caption ?? '').replace(/[[\]]/gu, '')}](${result.details.path})\n\n` } });
				}
				return;
			}
			// How much of its context is used, after each turn.
			case 'turn_end': {
				const usage = session?.getContextUsage?.();
				if (usage?.tokens) send({ sessionUpdate: 'usage_update', used: usage.tokens, size: usage.contextWindow });
				return;
			}
			case 'auto_retry_start':
				send({ sessionUpdate: 'notice', severity: 'info', title: t('pi 在重试'), description: event.errorMessage ?? '' });
				return;
			case 'auto_compaction_start':
				send({ sessionUpdate: 'notice', severity: 'info', title: t('上下文快满了，pi 在压缩之前的内容'), description: '' });
				return;
			default:
		}
	};
}

/** An error the Studio is told the words of (ACP's own, as a thrown Error reaches it only as 「Internal error」). */
const said = (message) => new RequestError(-32603, message);

/** What a tool gave back, as text: its words, or a command's output. */
function resultText(result) {
	if (!result) return '';
	const words = Array.isArray(result.content) ? result.content.map((part) => (part?.type === 'text' ? part.text : '')).join('') : '';
	if (words) return words;
	const details = result.details ?? {};
	return [details.stdout ?? details.output ?? '', details.stderr ?? ''].filter(Boolean).join('\n');
}
