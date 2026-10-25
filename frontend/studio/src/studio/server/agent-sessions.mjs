import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { delimiter, relative } from 'node:path';
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
 *
 * Given a store (chat-store.mjs), each conversation is kept in `chats/` as it goes, and is there after the Studio
 * restarts: shown as it was (state `saved`, no adapter running), and gone on with when it is next spoken to, the
 * agent's own session loaded again (ACP `session/resume` or `session/load`), so that it remembers what was said.
 */

/** What the adapter wrote to stderr, kept to say why it failed. */
const STDERR_KEPT = 4000;
/** Conversations kept in memory once over (closed, failed, or read back from chats/); the oldest go. */
const KEPT_OVER = 20;
/** How long after a change a conversation is written to chats/ (another change in that time, later). */
const SAVE_AFTER = 400;
/** States a conversation is gone on with from: its agent's session loaded again, in a new adapter. */
const ASLEEP = new Set(['saved', 'closed', 'failed']);

export class AgentSessions {
	/** @type {Map<string, AgentSession>} */
	#sessions = new Map();
	/** Those of the Studio's own (inline-ai.mjs): not the panel's conversations, ended with them. */
	#unlisted = new Set();
	/** All closed (the server going away): one that comes up after is closed at once. */
	#closed = false;
	#path = null;
	/** Conversations changed and not yet written: each one's timer. */
	#saving = new Map();

	/**
	 * @param {{ binFolder: string, shell?: string, env?: NodeJS.ProcessEnv, store?: import('./chat-store.mjs').ChatStore | null }} options
	 * `binFolder`: the project's node_modules/.bin, where the adapters are, put first on their PATH; `store`: where
	 * the conversations are kept (none: forgotten when the server stops)
	 */
	constructor({ binFolder, shell = process.env.SHELL || '/bin/zsh', env = process.env, store = null }) {
		this.binFolder = binFolder;
		this.shell = shell;
		this.env = env;
		this.store = store;
	}

	/**
	 * Starts a conversation with `agent` (its ACP command) in `cwd`; resolves once its adapter has a session.
	 * `models`: the service it was started for (panel-models.mjs), whose models are shown: Claude Code's tiers by the
	 * names of the models they stand for (`main`, `fast`), or pi's models of one service (`provider`), the first of
	 * them chosen if another was.
	 * @param {{ agent: { id: string, name: string, acp: string }, cwd: string, slug?: string | null, env?: Record<string, string>, models?: { name: string, main?: string, fast?: string, provider?: string } | null }} options
	 */
	async start({ agent, cwd, slug = null, env = {}, models = null, listed = true }) {
		// As the agent sees it (no link in it: /private/var… on a Mac), so the paths it names are shown under it.
		const session = new AgentSession({ agent, cwd: await realpath(cwd), slug, models, id: listed ? this.store?.newId() : undefined });
		if (listed) {
			this.#sessions.set(session.id, session);
			this.#forgetOld();
			this.#keep(session);
			if (this.store) session.page = this.store.page(session.id);
		} else {
			this.#unlisted.add(session);
			session.onClose = () => this.#unlisted.delete(session);
		}
		await this.#open(session, agent, env, false);
		if (models?.provider) await session.useService(models.provider);
		return session;
	}

	/**
	 * Goes on with a conversation over (read back from chats/, closed, or its agent gone): `agent` started again, its
	 * session of before loaded; resolves once it can be spoken to. One going on is as it is.
	 * @param {AgentSession} session
	 * @param {{ agent: { id: string, name: string, acp: string }, env?: Record<string, string>, models?: object | null }} options
	 */
	async wake(session, { agent, env = {}, models = null }) {
		if (!ASLEEP.has(session.state)) return session;
		session.models = models;
		await this.#open(session, agent, env, true);
		if (models?.provider) await session.useService(models.provider);
		return session;
	}

	async #open(session, agent, env, again) {
		const path = `${this.binFolder}${delimiter}${env.PATH ?? (await this.#loginPath())}`;
		await session.open(commandWords(agent.acp), { ...this.env, ...env, PATH: path }, { again });
		if (this.#closed) {
			session.close();
			throw Object.assign(new Error('Studio 正在停下'), { statusCode: 503 });
		}
	}

	/** A conversation going on (or over, still in memory). */
	get(id) {
		const session = this.#sessions.get(id);
		if (!session) throw Object.assign(new Error('没有这个对话'), { statusCode: 404 });
		return session;
	}

	/** A conversation going on, or one kept in chats/, read back (state `saved`). */
	async find(id) {
		const known = this.#sessions.get(id);
		if (known || !this.store) return known ?? this.get(id);
		const record = await this.store.read(id);
		// Read twice at once: the first one read.
		if (this.#sessions.has(id)) return this.#sessions.get(id);
		const session = AgentSession.kept(record, this.store.page(id));
		this.#sessions.set(id, session);
		this.#forgetOld();
		this.#keep(session);
		return session;
	}

	/** Those going on, then those kept in chats/ (the latest first); none begun and not spoken to that is over. */
	async list() {
		const live = [...this.#sessions.values()].filter((session) => spokenTo(session) || !ASLEEP.has(session.state)).reverse();
		const kept = this.store ? (await this.store.list()).filter((record) => !this.#sessions.has(record.id)).map(AgentSession.summaryOf) : [];
		return [...live.map((session) => session.summary()), ...kept];
	}

	close(id) {
		this.get(id).close();
	}

	/** A conversation gone: stopped, and its folder of chats/ removed. */
	async remove(id) {
		const session = this.#sessions.get(id);
		if (session) {
			clearTimeout(this.#saving.get(session));
			this.#saving.delete(session);
			session.close();
			this.#sessions.delete(id);
		}
		await this.store?.remove(id);
	}

	closeAll() {
		this.#closed = true;
		for (const session of [...this.#sessions.values(), ...this.#unlisted]) session.close();
		// What changed last, written before the server goes.
		// A turn going on as the server stops: what there is of it put on the page.
		for (const session of this.#sessions.values()) {
			if (this.store && session.unwritten().length) {
				this.#page(session);
				this.#saving.set(session, null);
			}
		}
		for (const [session, timer] of this.#saving) {
			clearTimeout(timer);
			try {
				this.store?.save(session.record(), { sync: true });
			} catch {
				// Kept as it was last written.
			}
		}
		this.#saving.clear();
	}

	/** A conversation begun to be a page (opened in the editor): its page and record there at once, before it is spoken to. */
	async makePage(session) {
		if (!this.store) throw Object.assign(new Error('对话没有地方存'), { statusCode: 500 });
		await this.store.append(session.record(), []);
		await this.store.save(session.record());
		session.madePage = true;
	}

	/**
	 * Each change to `session` written to chats/ a moment later (once it has been spoken to); each turn, once over,
	 * put at the end of its page.
	 */
	#keep(session) {
		if (!this.store) return;
		session.subscribe((event) => {
			if (event.type === 'all' || !spokenTo(session) || this.#closed) return;
			// After this event has reached every follower: the page written tells them after it, not before.
			if (session.state !== 'running' && session.state !== 'starting') setImmediate(() => !this.#closed && this.#page(session));
			clearTimeout(this.#saving.get(session));
			this.#saving.set(session, setTimeout(() => {
				this.#saving.delete(session);
				this.store.save(session.record()).catch(() => {});
			}, SAVE_AFTER));
		});
	}

	/**
	 * What was said since the page was last added to, added at its end (at once, so that it is there once and only
	 * once whatever comes next); followers told once it is there.
	 */
	#page(session) {
		const turn = session.unwritten();
		if (!turn.length) return;
		try {
			this.store.append(session.record(), turn, { sync: true });
			session.pageWrote(turn.at(-1).id);
		} catch (error) {
			console.warn(`[studio] 没能把对话写进 ${session.id}/index.md：${error instanceof Error ? error.message : error}`);
		}
	}

	#forgetOld() {
		const over = [...this.#sessions.values()].filter((session) => ASLEEP.has(session.state) && !this.#saving.has(session));
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
	/** 'starting' | 'idle' | 'running' | 'closed' | 'failed' | 'saved' (read back from chats/, no adapter) */
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
	/** Words the agent sends unasked when a session begins, left out of the conversation. */
	#prelude = null;
	/** What was said before, told again by an adapter as its session is loaded: not said anew. */
	#replaying = false;
	/** Gone on with in a new session of the agent's (the one before could not be loaded): it is told where what was said is. */
	#forgot = false;
	#forget = () => {};

	constructor({ agent, cwd, slug, models = null, id = randomUUID() }) {
		this.id = id;
		this.agent = { id: agent.id, name: agent.name };
		this.cwd = cwd;
		this.slug = slug;
		this.models = models;
		this.created = new Date().toISOString();
		this.updated = this.created;
		/** Where it is kept as a page (chats/…/index.md), if it is. */
		this.page = null;
		/** The last item put on that page (null: none yet). */
		this.pageThrough = null;
		/** Begun as a page (AgentSessions.makePage), before anything was said. */
		this.madePage = false;
	}

	/** A conversation of chats/, as it was left: shown, not going on until it is woken (AgentSessions.wake). */
	static kept(record, page) {
		const session = new AgentSession({ agent: record.agent, cwd: record.cwd, slug: record.slug ?? null, id: record.id });
		session.state = 'saved';
		session.title = record.title ?? '';
		session.created = record.created;
		session.updated = record.updated ?? record.created;
		session.configOptions = record.configOptions ?? [];
		session.items = record.items ?? [];
		for (const item of session.items) session.#byId.set(item.id, item);
		session.#acpId = record.acpSessionId ?? null;
		session.page = page;
		session.madePage = true;
		// Kept before pages were added to turn by turn: all of it was written on it.
		session.pageThrough = record.pageThrough === undefined ? session.items.at(-1)?.id ?? null : record.pageThrough;
		return session;
	}

	/** What the list says of a conversation of chats/ not read back. */
	static summaryOf(record) {
		return { id: record.id, agent: record.agent, slug: record.slug ?? null, cwd: record.cwd, title: record.title ?? '', state: 'saved', error: '', created: record.created, updated: record.updated ?? record.created, configOptions: record.configOptions ?? [], modes: null, commands: [], usage: null, service: record.service ?? null, pageThrough: record.pageThrough === undefined ? record.items?.at(-1)?.id ?? null : record.pageThrough, onPage: true };
	}

	summary() {
		return { id: this.id, agent: this.agent, slug: this.slug, cwd: this.cwd, title: this.#title(), state: this.state, error: this.error, created: this.created, updated: this.updated, configOptions: this.#shownOptions(), modes: this.modes, commands: this.commands, usage: this.usage, service: this.models?.name ?? null, pageThrough: this.pageThrough, onPage: this.madePage || this.pageThrough !== null };
	}

	/** The items since the last put on its page. */
	unwritten() {
		const from = this.pageThrough ? this.items.findIndex((item) => item.id === this.pageThrough) + 1 : 0;
		return this.items.slice(from);
	}

	/** Its page has what was said up to the item `id`: its followers told (a page open in the editor reads it again). */
	pageWrote(id) {
		this.pageThrough = id;
		this.#tell({ type: 'session', session: this.summary() });
	}

	/** The title its agent gave it, or (Codex gives none) the start of what the author said first. */
	#title() {
		if (this.title) return this.title;
		const first = this.items.find((item) => item.kind === 'user')?.text.trim().split('\n')[0] ?? '';
		return first.length > 40 ? `${first.slice(0, 40)}…` : first;
	}

	/** It as kept in chats/ (chat-store.mjs): leave still asked, refused, as it will be once it is read back. */
	record() {
		this.updated = new Date().toISOString();
		const items = this.items.map((item) => (item.kind === 'permission' && !item.chosen ? { ...item, chosen: 'cancelled' } : item));
		return { id: this.id, agent: this.agent, acpSessionId: this.#acpId, cwd: this.cwd, slug: this.slug, title: this.#title(), created: this.created, updated: this.updated, service: this.models?.name ?? null, configOptions: this.configOptions, items, pageThrough: this.pageThrough };
	}

	/**
	 * Its options as the page shows them: on another service, the models are that service's (Claude Code's tiers are
	 * all it was told of: the main model for the default, opus and sonnet, the fast one for haiku), not Claude's.
	 */
	#shownOptions() {
		if (!this.models) return this.configOptions;
		const { main, fast, provider } = this.models;
		return this.configOptions.map((option) => {
			if (option.category !== 'model' || option.type !== 'select') return option;
			if (provider) return { ...option, options: modelChoices(option).filter((choice) => choice.value.startsWith(`${provider}/`)) };
			const options = [{ value: 'default', name: main }, ...(fast && fast !== main ? [{ value: 'haiku', name: `${fast}（快）` }] : [])];
			return { ...option, options, currentValue: option.currentValue === 'haiku' && options.length > 1 ? 'haiku' : 'default' };
		});
	}

	/** Follows the conversation: told it whole at once, then each change. Returns how to stop. */
	subscribe(listener) {
		listener({ type: 'all', session: this.summary(), items: this.items });
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/**
	 * Starts its adapter and a session of the agent's; `again`: the session it had loaded instead (a new one if that
	 * cannot be, the agent then told where what was said is).
	 */
	async open(argv, env, { again = false } = {}) {
		if (!argv.length) throw Object.assign(new Error(`${this.agent.name} 没有 ACP 命令`), { statusCode: 400 });
		if (again) {
			this.error = '';
			this.#stderr = '';
			this.#setState('starting');
		}
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
		// An adapter of before (gone on with in another) ends unheeded.
		void exited.then((error) => this.#child === child && this.#ended(error));
		const app = client({ name: 'studio' })
			.onNotification('session/update', ({ params }) => this.#update(params.update))
			.onRequest('session/request_permission', ({ params, signal }) => this.#askLeave(params, signal));
		this.#connection = app.connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout)));
		try {
			const agent = this.#connection.agent;
			const opening = (async () => {
				const begun = await agent.request('initialize', { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
				const before = again ? await this.#loadAgain(agent, begun.agentCapabilities ?? {}) : null;
				if (before) return before;
				if (again && this.items.length) this.#forgot = true;
				return agent.request('session/new', { cwd: this.cwd, mcpServers: [] });
			})();
			// An adapter that exits before it answers (not installed, not logged in) says so on stderr.
			const made = await Promise.race([opening, exited.then((error) => Promise.reject(error ?? new Error('提前退出了')))]);
			this.#acpId = made.sessionId ?? this.#acpId;
			// What pi-acp says of pi when a session begins (its version, skills, extensions): not an answer.
			this.#prelude = made._meta?.piAcp?.startupInfo ?? null;
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

	/**
	 * Its agent's session of before, loaded again (resumed, as Codex can, or loaded, what was said told again and left
	 * out); null when there was none or it is not there any more.
	 */
	async #loadAgain(agent, capabilities) {
		if (!this.#acpId) return null;
		const asked = { sessionId: this.#acpId, cwd: this.cwd, mcpServers: [] };
		try {
			if (capabilities.sessionCapabilities?.resume) return { sessionId: this.#acpId, ...(await agent.request('session/resume', asked)) };
			if (!capabilities.loadSession) return null;
			this.#replaying = true;
			return { sessionId: this.#acpId, ...(await agent.request('session/load', asked)) };
		} catch {
			return null;
		} finally {
			this.#replaying = false;
		}
	}

	/** A model of the service `provider` (pi's `provider/model`), if the one chosen is another's. */
	async useService(provider) {
		const option = this.configOptions.find((entry) => entry.category === 'model' && entry.type === 'select');
		if (!option || String(option.currentValue).startsWith(`${provider}/`)) return;
		const first = modelChoices(option).find((choice) => choice.value.startsWith(`${provider}/`));
		if (first) await this.configure(option.id, first.value).catch(() => {});
	}

	/**
	 * Tells the agent `text`, with what the Studio adds of where the author is (`context`: the article open, the lines
	 * selected in it, the articles named with @, each by its file); resolves when it has begun, the turn going on by
	 * itself. The conversation shows what the author said, and the context as what it names.
	 * @param {string} text
	 * @param {PromptContext} [context]
	 */
	prompt(text, context = {}) {
		if (this.state !== 'idle') throw Object.assign(new Error(this.state === 'running' ? '它还在做上一件事：等它做完，或者先停下' : '这个对话已经结束了'), { statusCode: 409 });
		if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('要说点什么'), { statusCode: 400 });
		const named = {
			article: context.article?.title ?? null,
			selection: context.selection ? lineRange(context.selection) : null,
			mentions: (context.mentions ?? []).map((mention) => mention.title),
		};
		// Running before what was said is added: a turn is put on the page once it is over, not as it begins.
		this.#setState('running');
		this.#add({ kind: 'user', id: randomUUID(), text, context: named });
		const told = withContext(text, { ...context, ...(this.#forgot && this.page ? { history: relative(this.cwd, this.page) } : {}) });
		this.#forgot = false;
		const turn = this.#connection.agent.request('session/prompt', { sessionId: this.#acpId, prompt: [{ type: 'text', text: told }] });
		void turn.then(
			(done) => {
				if (done.stopReason !== 'end_turn') this.#add({ kind: 'stop', id: randomUUID(), reason: done.stopReason });
				// A turn over with nothing said or done: its service refused it (pi-acp says no more than that).
				else if (this.items.at(-1)?.kind === 'user') this.#add({ kind: 'error', id: randomUUID(), message: `${this.agent.name} 没有回答：可能是 API key 不对、模型用不了，或者连不上网络` });
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

	/** Told when it is closed (unlisted ones are let go then). */
	onClose = () => {};

	close() {
		this.onClose();
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
		// What was said before, as a session is loaded: kept already.
		if (this.#replaying && !['config_option_update', 'current_mode_update', 'available_commands_update'].includes(update.sessionUpdate)) return;
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
				if (typeof update.title === 'string') this.title = withoutContext(update.title, this.items.find((item) => item.kind === 'user')?.text ?? '');
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
		if (kind === 'message' && this.#prelude && text === this.#prelude) {
			this.#prelude = null;
			return;
		}
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

/** Whether the author has said something in it (one never spoken to is not kept, nor listed once over). */
const spokenTo = (session) => session.items.some((item) => item.kind === 'user');

/** A select option's choices, its groups flattened. */
function modelChoices(option) {
	return (option.options ?? []).flatMap((entry) => (Array.isArray(entry.options) ? entry.options : [entry]));
}

/**
 * @typedef {object} PromptContext where the author is, as the Studio tells the agent (paths from its folder)
 * @property {{ title: string, path: string, brief?: string | null }} [article] the article open (its ai/brief.md, or null for none)
 * @property {{ start: number, end: number, text: string }} [selection] the lines of it selected
 * @property {Array<{ title: string, path: string, brief?: string | null }>} [mentions] the articles named with @
 * @property {string} [history] where what was said before is kept (chats/…/index.md), for an agent that cannot remember it
 */

const lineRange = ({ start, end }) => (start === end ? `第 ${start} 行` : `第 ${start}–${end} 行`);

/** Whether an article has its ai/brief.md (blog/AGENTS.md: read it first), said, so that one not there is not tried for. */
function briefOf({ brief }) {
	if (brief === undefined) return '';
	return brief ? `；它的写作要求在 ${brief}，先读` : '（没有 ai/brief.md，不用找）';
}

/** What the author said, then what the Studio adds of where they are, marked as the Studio's. */
export function withContext(text, { article, selection, mentions = [], history } = {}) {
	const lines = [];
	if (history) lines.push(`这是接着之前的对话说的，但你那边接不上之前的会话了：之前说过的话记在 ${history}，需要时去读`);
	if (article) lines.push(`当前打开的文章：《${article.title}》，文件 ${article.path}${briefOf(article)}`);
	if (article && selection) {
		const fence = '`'.repeat(Math.max(3, ...[...selection.text.matchAll(/`+/gu)].map((run) => run[0].length + 1)));
		lines.push(`选中的是这篇的${lineRange(selection)}：`, `${fence}markdown`, selection.text, fence);
	}
	for (const mention of mentions) lines.push(`用 @ 提到的文章：《${mention.title}》，文件 ${mention.path}${briefOf(mention)}`);
	if (!lines.length) return text;
	return `${text}\n\n<studio-context>\n（Studio 自动附上的，说明用户现在在看什么；不是用户写的话）\n${lines.join('\n')}\n</studio-context>`;
}

/**
 * A title some agents make of the first thing told (cut short, perhaps): what the author said of it, not what the
 * Studio added after it (withContext).
 */
function withoutContext(title, said) {
	const at = said ? title.indexOf(said.trim()) : -1;
	if (at >= 0 && /^\s*</u.test(title.slice(at + said.trim().length))) return title.slice(0, at + said.trim().length).trim();
	return title.split('<studio-context>')[0].trim();
}
