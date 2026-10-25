import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { agent as acpAgent, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';
import { createAgentSession, createBashToolDefinition, ModelRuntime, SessionManager } from '@earendil-works/pi-coding-agent';

import { PI_PROVIDERS } from './panel-models.mjs';

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
 */

/** The reasoning levels, as the options show them. */
const THINKING = { off: '不思考', minimal: '最少', low: '少', medium: '中', high: '多', xhigh: '很多', max: '最多' };
/** What each of pi's tools does, as ACP says it. */
const KINDS = { read: 'read', ls: 'read', write: 'edit', edit: 'edit', bash: 'execute', grep: 'search', find: 'search' };

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

	/** A session of pi's (new, or one kept) with Studio's shell, followed: what it does sent as ACP updates. */
	async function open(cwd, manager, client) {
		const modelRuntime = await models();
		// The shell tool as pi's own, its commands given the Studio's environment.
		const bash = createBashToolDefinition(cwd, { spawnHook: (context) => ({ ...context, env: { ...context.env, ...env } }) });
		const { session } = await createAgentSession({ cwd, agentDir, modelRuntime, sessionManager: manager, customTools: [bash] }).catch((error) => {
			throw said(error instanceof Error ? error.message : String(error));
		});
		const entry = { session, cwd, cancelled: false, stop: () => {} };
		const translate = translator(cwd, (update) => void client.notify('session/update', { sessionId: session.sessionId, update }).catch(() => {}));
		entry.stop = session.subscribe(translate);
		sessions.set(session.sessionId, entry);
		return entry;
	}

	/** Its options as ACP has them: the model (pi's `provider/id`), how much it thinks. */
	async function options(session) {
		const available = await (await models()).getAvailable().catch(() => []);
		const current = session.model ? `${session.model.provider}/${session.model.id}` : '';
		const choices = available.map((model) => ({ value: `${model.provider}/${model.id}`, name: `${model.provider}/${model.id}` }));
		if (current && !choices.some((choice) => choice.value === current)) choices.unshift({ value: current, name: current });
		const levels = session.getAvailableThinkingLevels();
		return [
			...(choices.length ? [{ type: 'select', id: 'model', category: 'model', name: 'Model', currentValue: current, options: choices }] : []),
			...(levels.length > 1 ? [{ type: 'select', id: 'thought_level', category: 'thought_level', name: 'Thinking', currentValue: session.thinkingLevel, options: levels.map((level) => ({ value: level, name: THINKING[level] ?? level })) }] : []),
		];
	}

	const known = (sessionId) => {
		const entry = sessions.get(sessionId);
		if (!entry) throw said(`没有这个 pi 会话：${sessionId}`);
		return entry;
	};

	const app = acpAgent({ name: 'studio-pi' })
		.onRequest('initialize', () => ({ protocolVersion: PROTOCOL_VERSION, agentCapabilities: { loadSession: true, promptCapabilities: { image: true } }, authMethods: [] }))
		.onRequest('session/new', async ({ params, client }) => {
			const { session } = await open(params.cwd, SessionManager.create(params.cwd, sessionDir), client);
			return { sessionId: session.sessionId, configOptions: await options(session) };
		})
		// One kept, gone on with: what was said in it is pi's (not told again; the Studio keeps its own).
		.onRequest('session/load', async ({ params, client }) => {
			if (sessions.has(params.sessionId)) return { configOptions: await options(known(params.sessionId).session) };
			const kept = (await SessionManager.list(params.cwd, sessionDir)).find((info) => info.id === params.sessionId);
			if (!kept) throw said(`pi 那边没有这个会话了：${params.sessionId}`);
			const { session } = await open(params.cwd, SessionManager.open(kept.path, sessionDir), client);
			return { configOptions: await options(session) };
		})
		.onRequest('session/prompt', async ({ params }) => {
			const entry = known(params.sessionId);
			entry.cancelled = false;
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
			if (last?.role === 'assistant' && last.stopReason === 'error') throw said(last.errorMessage || 'pi 的模型没能回答');
			return { stopReason: 'end_turn' };
		})
		.onNotification('session/cancel', ({ params }) => {
			const entry = sessions.get(params.sessionId);
			if (!entry) return;
			entry.cancelled = true;
			void entry.session.abort().catch(() => {});
		})
		.onRequest('session/set_config_option', async ({ params }) => {
			const { session } = known(params.sessionId);
			if (params.configId === 'model') {
				const at = String(params.value).indexOf('/');
				const model = (await models()).getModel(String(params.value).slice(0, at), String(params.value).slice(at + 1));
				if (!model) throw said(`pi 没有这个模型：${params.value}`);
				await session.setModel(model);
			} else if (params.configId === 'thought_level') {
				session.setThinkingLevel(params.value);
			}
			return { configOptions: await options(session) };
		});
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
function translator(cwd, send) {
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
				const title = toolName === 'bash' && typeof args?.command === 'string' ? args.command : toolName;
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
				return;
			}
			case 'auto_retry_start':
				send({ sessionUpdate: 'notice', severity: 'info', title: 'pi 在重试', description: event.errorMessage ?? '' });
				return;
			case 'auto_compaction_start':
				send({ sessionUpdate: 'notice', severity: 'info', title: '上下文快满了，pi 在压缩之前的内容', description: '' });
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
