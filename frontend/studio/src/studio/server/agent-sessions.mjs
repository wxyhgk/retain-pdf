import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { delimiter } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { client, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

import { commandWords, endWithServer, loginShell } from './tasks.mjs';

/**
 * The AI panel's conversations: a coding agent (Claude Code, Codex) that reads, runs and writes by itself, spoken to
 * through the Agent Client Protocol (ACP) by its adapter (`claude-agent-acp`, `codex-acp`), one adapter process per
 * conversation, in the article's folder. What the agent does comes as typed updates (its words, its thinking, each
 * tool it calls and how that went, its plan, what it asks leave for); they are kept here as a transcript of items,
 * which a page following the conversation is sent whole and then item by item:
 *
 * - `{ kind: 'user', id, text }`: what the author said;
 * - `{ kind: 'message' | 'thought', id, text }`: the agent's words, its thinking (grown by `append` events);
 * - `{ kind: 'tool', id, title, toolKind, status, content, locations, rawInput, output, exitCode }`: a tool call, sent
 *   whole each time it changes (`output`: what a command printed, when the adapter streams it);
 * - `{ kind: 'plan', id, entries }`: its plan, the latest one;
 * - `{ kind: 'permission', id, title, toolCallId, options, chosen }`: leave asked, and what the author chose;
 * - `{ kind: 'notice', id, severity, title, description }`, `{ kind: 'stop', id, reason }`, `{ kind: 'error', id, message }`.
 *
 * Events to a follower: `all` (the session and its items), `item` (one new or changed), `append` (text added to a
 * message or thought) and `session` (its state, title, options, modes, usage changed).
 */

/** What the adapter wrote to stderr, kept to say why it failed. */
const STDERR_KEPT = 4000;
/** Conversations kept once over (closed or failed); the oldest go. */
const KEPT_OVER = 20;

export class AgentSessions {
	/** @type {Map<string, AgentSession>} */
	#sessions = new Map();
	#path = null;

	/**
	 * @param {{ binFolder: string, shell?: string, env?: NodeJS.ProcessEnv }} options `binFolder`: the project's
	 * node_modules/.bin, where the adapters are, put first on their PATH
	 */
	constructor({ binFolder, shell = process.env.SHELL || '/bin/zsh', env = process.env }) {
		this.binFolder = binFolder;
		this.shell = shell;
		this.env = env;
	}

	/**
	 * Starts a conversation with `agent` (its ACP command) in `cwd`; resolves once its adapter has a session.
	 * @param {{ agent: { id: string, name: string, acp: string }, cwd: string, slug?: string | null, env?: Record<string, string> }} options
	 */
	async start({ agent, cwd, slug = null, env = {} }) {
		// As the agent sees it (no link in it: /private/var… on a Mac), so the paths it names are shown under it.
		const session = new AgentSession({ agent, cwd: await realpath(cwd), slug });
		this.#sessions.set(session.id, session);
		this.#forgetOld();
		const path = `${this.binFolder}${delimiter}${env.PATH ?? (await this.#loginPath())}`;
		await session.open(commandWords(agent.acp), { ...this.env, ...env, PATH: path });
		return session;
	}

	get(id) {
		const session = this.#sessions.get(id);
		if (!session) throw Object.assign(new Error('没有这个对话（Studio 重启后要新开一个）'), { statusCode: 404 });
		return session;
	}

	list() {
		return [...this.#sessions.values()].map((session) => session.summary()).reverse();
	}

	close(id) {
		this.get(id).close();
	}

	closeAll() {
		for (const session of this.#sessions.values()) session.close();
	}

	#forgetOld() {
		const over = [...this.#sessions.values()].filter((session) => session.state === 'closed' || session.state === 'failed');
		for (const session of over.slice(0, Math.max(0, over.length - KEPT_OVER))) this.#sessions.delete(session.id);
	}

	/**
	 * The PATH a login shell has (the author's terminal's, longer than the server's when the Mac app started it), asked
	 * once. Asked between marks, so what a shell's startup prints is not taken for it.
	 */
	async #loginPath() {
		this.#path ??= new Promise((resolve) => {
			execFile(loginShell(this.shell), ['-lc', 'printf "\\n__studio_path__%s\\n" "$PATH"'], { env: this.env, timeout: 5000 }, (_error, stdout) => {
				const line = String(stdout ?? '').split('\n').find((text) => text.startsWith('__studio_path__'));
				resolve(line ? line.slice('__studio_path__'.length) : this.env.PATH ?? '');
			});
		});
		return this.#path;
	}
}

/** One conversation: its adapter, its ACP session, its transcript, who follows it. */
class AgentSession {
	id = randomUUID();
	/** 'starting' | 'idle' | 'running' | 'closed' | 'failed' */
	state = 'starting';
	title = '';
	error = '';
	/** @type {Array<Record<string, any>>} */
	items = [];
	/** @type {Map<string, Record<string, any>>} */
	#byId = new Map();
	/** @type {Set<(event: Record<string, any>) => void>} */
	#listeners = new Set();
	/** Leave asked and not yet answered: the permission item's id → how to answer. */
	#asked = new Map();
	configOptions = [];
	modes = null;
	commands = [];
	usage = null;
	#child = null;
	#connection = null;
	#acpId = null;
	#stderr = '';
	#forget = () => {};

	constructor({ agent, cwd, slug }) {
		this.agent = { id: agent.id, name: agent.name };
		this.cwd = cwd;
		this.slug = slug;
		this.created = new Date().toISOString();
	}

	summary() {
		return { id: this.id, agent: this.agent, slug: this.slug, cwd: this.cwd, title: this.title, state: this.state, error: this.error, created: this.created, configOptions: this.configOptions, modes: this.modes, commands: this.commands, usage: this.usage };
	}

	/** Follows the conversation: told it whole at once, then each change. Returns how to stop. */
	subscribe(listener) {
		listener({ type: 'all', session: this.summary(), items: this.items });
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	async open(argv, env) {
		if (!argv.length) throw Object.assign(new Error(`${this.agent.name} 没有 ACP 命令`), { statusCode: 400 });
		const child = spawn(argv[0], argv.slice(1), { cwd: this.cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
		this.#child = child;
		if (child.pid) this.#forget = endWithServer(child.pid);
		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (text) => {
			this.#stderr = (this.#stderr + text).slice(-STDERR_KEPT);
		});
		for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', () => {});
		const exited = new Promise((resolve) => {
			child.on('error', (error) => resolve(error));
			child.on('close', (code, signal) => resolve(code === 0 || signal === 'SIGTERM' ? null : new Error(`退出码 ${code ?? signal}`)));
		});
		void exited.then((error) => this.#ended(error));
		const app = client({ name: 'studio' })
			.onNotification('session/update', ({ params }) => this.#update(params.update))
			.onRequest('session/request_permission', ({ params, signal }) => this.#askLeave(params, signal));
		this.#connection = app.connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout)));
		try {
			const agent = this.#connection.agent;
			const opening = (async () => {
				await agent.request('initialize', { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
				return agent.request('session/new', { cwd: this.cwd, mcpServers: [] });
			})();
			// An adapter that exits before it answers (not installed, not logged in) says so on stderr.
			const made = await Promise.race([opening, exited.then((error) => Promise.reject(error ?? new Error('提前退出了')))]);
			this.#acpId = made.sessionId;
			this.configOptions = made.configOptions ?? [];
			this.modes = made.modes ?? null;
			this.#setState('idle');
		} catch (error) {
			this.error = this.#why(error);
			this.close();
			this.#setState('failed');
			throw Object.assign(new Error(`${this.agent.name} 没能启动：${this.error}`), { statusCode: 502 });
		}
	}

	/** Tells the agent `text`; resolves when it has begun, the turn going on by itself. */
	prompt(text) {
		if (this.state !== 'idle') throw Object.assign(new Error(this.state === 'running' ? '它还在做上一件事：等它做完，或者先停下' : '这个对话已经结束了'), { statusCode: 409 });
		if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('要说点什么'), { statusCode: 400 });
		this.#add({ kind: 'user', id: randomUUID(), text });
		this.#setState('running');
		const turn = this.#connection.agent.request('session/prompt', { sessionId: this.#acpId, prompt: [{ type: 'text', text }] });
		void turn.then(
			(done) => {
				if (done.stopReason !== 'end_turn') this.#add({ kind: 'stop', id: randomUUID(), reason: done.stopReason });
				if (this.state === 'running') this.#setState('idle');
			},
			(error) => {
				if (this.state === 'closed' || this.state === 'failed') return;
				this.#add({ kind: 'error', id: randomUUID(), message: this.#why(error) });
				this.#setState('idle');
			},
		);
	}

	/** Stops what it is doing: what it asked leave for is refused. */
	cancel() {
		if (this.state !== 'running') return;
		for (const answer of this.#asked.values()) answer(null);
		void this.#connection.agent.notify('session/cancel', { sessionId: this.#acpId }).catch(() => {});
	}

	/** The author's answer to leave asked (`optionId`), or no (`null`). */
	answer(permission, optionId) {
		const answer = this.#asked.get(permission);
		if (!answer) throw Object.assign(new Error('这个请求已经回答过了'), { statusCode: 409 });
		answer(optionId);
	}

	/** One of its options (model, mode, effort…) set to `value`. */
	async configure(configId, value) {
		if (this.state !== 'idle' && this.state !== 'running') throw Object.assign(new Error('这个对话已经结束了'), { statusCode: 409 });
		const done = await this.#connection.agent.request('session/set_config_option', { sessionId: this.#acpId, configId, value });
		this.configOptions = done.configOptions ?? this.configOptions;
		const mode = this.configOptions.find((option) => option.category === 'mode');
		if (mode && this.modes) this.modes = { ...this.modes, currentModeId: mode.currentValue };
		this.#tell({ type: 'session', session: this.summary() });
		return this.summary();
	}

	close() {
		for (const answer of this.#asked.values()) answer(null);
		this.#connection?.close();
		if (this.#child?.pid && this.#child.exitCode === null) {
			try {
				process.kill(-this.#child.pid, 'SIGTERM');
			} catch {
				// Over already.
			}
		}
		if (this.state !== 'failed') this.#setState('closed');
	}

	#ended(error) {
		this.#forget();
		for (const answer of this.#asked.values()) answer(null);
		if (this.state === 'closed' || this.state === 'failed') return;
		this.error = this.#why(error ?? new Error('它结束了'));
		this.#add({ kind: 'error', id: randomUUID(), message: `${this.agent.name} 停了：${this.error}` });
		this.#setState('failed');
	}

	/** Why it failed: the error, with the last line the adapter wrote that says something. */
	#why(error) {
		const said = this.#stderr.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('[session/')).at(-1);
		const message = error instanceof Error ? error.message : String(error);
		return said && !message.includes(said) ? `${message}（${said.slice(0, 300)}）` : message;
	}

	#update(update) {
		switch (update.sessionUpdate) {
			case 'agent_message_chunk':
			case 'agent_thought_chunk':
				return this.#words(update.sessionUpdate === 'agent_message_chunk' ? 'message' : 'thought', update);
			case 'tool_call':
			case 'tool_call_update':
				return this.#tool(update);
			case 'plan':
				return this.#put({ kind: 'plan', id: 'plan', entries: update.entries ?? [] }, true);
			case 'notice':
				return this.#add({ kind: 'notice', id: randomUUID(), severity: update.severity, title: update.title, description: update.description ?? '' });
			case 'session_info_update':
				if (typeof update.title === 'string') this.title = update.title;
				break;
			case 'config_option_update':
				this.configOptions = update.configOptions ?? this.configOptions;
				break;
			case 'current_mode_update':
				if (this.modes) this.modes = { ...this.modes, currentModeId: update.currentModeId };
				break;
			case 'available_commands_update':
				this.commands = (update.availableCommands ?? []).map(({ name, description }) => ({ name, description }));
				break;
			case 'usage_update':
				this.usage = { used: update.used, size: update.size, cost: update.cost ?? this.usage?.cost ?? null };
				break;
			default:
				return;
		}
		this.#tell({ type: 'session', session: this.summary() });
	}

	/** Its words or thinking: added to the last item if that is the same (the same message), else a new one. */
	#words(kind, update) {
		const text = update.content?.type === 'text' ? update.content.text : '';
		if (!text) return;
		const last = this.items.at(-1);
		if (last?.kind === kind && (!update.messageId || last.messageId === update.messageId)) {
			last.text += text;
			this.#tell({ type: 'append', id: last.id, text });
			return;
		}
		this.#add({ kind, id: randomUUID(), messageId: update.messageId ?? null, text });
	}

	/** A tool call, made or changed: its fields as they now are; what a command prints added to its output. */
	#tool(update) {
		const known = this.#byId.get(update.toolCallId);
		const item = known ? { ...known } : { kind: 'tool', id: update.toolCallId, title: '', toolKind: 'other', status: 'pending', content: [], locations: [], rawInput: null, output: '', exitCode: null };
		for (const [field, key] of [['title', 'title'], ['toolKind', 'kind'], ['status', 'status'], ['content', 'content'], ['locations', 'locations'], ['rawInput', 'rawInput'], ['rawOutput', 'rawOutput']]) {
			if (update[key] !== undefined && update[key] !== null) item[field] = update[key];
		}
		// Codex streams what a command prints beside the update, the client having no terminal of its own.
		const printed = update._meta?.terminal_output_delta?.data;
		if (typeof printed === 'string') item.output += printed;
		const exit = update._meta?.terminal_exit;
		if (exit) item.exitCode = exit.exit_code ?? null;
		this.#put(item, Boolean(known));
	}

	/** Leave asked: an item the author answers in the page; refused if the turn is stopped or the page asks too late. */
	#askLeave(params, signal) {
		const id = randomUUID();
		const call = params.toolCall ?? {};
		if (call.toolCallId) this.#tool({ ...call, status: call.status ?? 'pending' });
		const item = { kind: 'permission', id, toolCallId: call.toolCallId ?? null, title: call.title ?? '', options: params.options ?? [], chosen: null };
		const answered = new Promise((resolve) => {
			const answer = (optionId) => {
				if (!this.#asked.has(id)) return;
				this.#asked.delete(id);
				const chosen = params.options?.find((option) => option.optionId === optionId);
				this.#put({ ...item, chosen: chosen ? chosen.optionId : 'cancelled' }, true);
				resolve(chosen ? { outcome: { outcome: 'selected', optionId: chosen.optionId } } : { outcome: { outcome: 'cancelled' } });
			};
			this.#asked.set(id, answer);
			signal?.addEventListener('abort', () => answer(null), { once: true });
		});
		// Shown once it can be answered: a follower may answer at once.
		this.#add(item);
		return answered;
	}

	#add(item) {
		this.items.push(item);
		this.#byId.set(item.id, item);
		this.#tell({ type: 'item', item });
	}

	/** `item` in place of the one with its id (`known`), or added. */
	#put(item, known) {
		const at = known ? this.items.findIndex((entry) => entry.id === item.id) : -1;
		if (at < 0) return this.#add(item);
		this.items[at] = item;
		this.#byId.set(item.id, item);
		this.#tell({ type: 'item', item });
	}

	#setState(state) {
		this.state = state;
		this.#tell({ type: 'session', session: this.summary() });
	}

	#tell(event) {
		for (const listener of this.#listeners) {
			try {
				listener(event);
			} catch {
				// A page gone: its stream is closed by the route.
			}
		}
	}
}
