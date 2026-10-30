import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { basename, delimiter, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { client, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

import { commandWords, endWithServer, loginShell } from '../tasks/tasks.mjs';
import { saidWhole } from './chat-store.mjs';
import { t } from '@blog/i18n/index.mjs';

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
/** The pictures the author may give with what they say, by extension. */
const PICTURE_TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
/**
 * An adapter left running takes 100–300 MB (Codex's two processes): those of conversations not spoken in for this
 * long are stopped, and of the others no more than so many are kept; each is woken (its session loaded again, about
 * 1.5 s) when spoken to next.
 */
const IDLE_SLEEP = 10 * 60_000;
const AWAKE_MAX = 3;
const TIDY_EVERY = 60_000;
/** How long one told to stop may take to, before it is stopped by force (AgentSession #forceStop). */
const STOP_WAIT = 10_000;

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
	 * A conversation made ready before it is asked for (an agent takes 2–5 s to start): the next begun with the same
	 * agent, place and service takes it, and another is made ready. One at most.
	 * @type {{ key: string, session: AgentSession, ready: Promise<boolean> } | null}
	 */
	#spare = null;
	#tidying = null;

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
		this.#tidying = setInterval(() => this.#tidy(), TIDY_EVERY);
		this.#tidying.unref?.();
	}

	/**
	 * Starts a conversation with `agent` (its ACP command) in `cwd`; resolves once its adapter has a session.
	 * `models`: the service it was started for (panel-models.mjs), whose models are shown: Claude Code's tiers by the
	 * names of the models they stand for (`main`, `fast`), or pi's models of one service (`provider`), the first of
	 * them chosen if another was.
	 * @param {{ agent: { id: string, name: string, acp: string }, cwd: string, slug?: string | null, env?: Record<string, string>, models?: { name: string, main?: string, fast?: string, provider?: string } | null }} options
	 */
	async start({ agent, cwd, slug = null, env = {}, models = null, listed = true }) {
		// The one made ready for these, if it is.
		const spare = listed ? await this.#takeSpare(spareKey(agent, cwd, env, models)) : null;
		if (spare) {
			this.#list(spare);
			this.#tidy();
			return spare;
		}
		// As the agent sees it (no link in it: /private/var… on a Mac), so the paths it names are shown under it.
		const session = new AgentSession({ agent, cwd: await realpath(cwd), slug, models, id: listed ? this.store?.newId() : undefined });
		if (listed) {
			this.#list(session);
		} else {
			this.#unlisted.add(session);
			session.onClose = () => this.#unlisted.delete(session);
		}
		await this.#open(session, agent, env, false);
		if (models?.provider) await session.useService(models.provider);
		if (listed) this.#tidy();
		return session;
	}

	/**
	 * A conversation made ready with `agent` (its adapter started, a session of its own), for the next begun with the
	 * same; one made ready for others before is let go.
	 */
	prepare({ agent, cwd, env = {}, models = null }) {
		const key = spareKey(agent, cwd, env, models);
		if (this.#closed || this.#spare?.key === key) return;
		this.#dropSpare();
		const session = new AgentSession({ agent, cwd, slug: null, models, id: this.store?.newId() });
		const ready = (async () => {
			session.cwd = await realpath(cwd);
			await this.#open(session, agent, env, false);
			if (models?.provider) await session.useService(models.provider);
			return true;
		})().catch(() => false);
		this.#spare = { key, session, ready };
	}

	/** The conversation made ready for `key`, once it is, taken (null: none, or it failed). */
	async #takeSpare(key) {
		const spare = this.#spare;
		if (!spare || spare.key !== key) return null;
		this.#spare = null;
		if ((await spare.ready) && spare.session.state === 'idle') return spare.session;
		spare.session.close();
		return null;
	}

	#dropSpare() {
		const spare = this.#spare;
		this.#spare = null;
		if (spare) void spare.ready.then(() => spare.session.close());
	}

	/** A conversation among those listed, kept in chats/ once spoken to. */
	#list(session) {
		this.#sessions.set(session.id, session);
		this.#forgetOld();
		this.#keep(session);
		if (this.store) session.page = this.store.page(session.id);
	}

	/**
	 * The adapters left running, few: a conversation not spoken in for IDLE_SLEEP has its stopped, and of the others idle
	 * the latest AWAKE_MAX are kept running. Stopped, it is as it was (state `saved`), woken when spoken to.
	 */
	#tidy() {
		const now = Date.now();
		const idle = [...this.#sessions.values()].filter((session) => session.state === 'idle').sort((a, b) => b.activeAt - a.activeAt);
		idle.forEach((session, at) => {
			if (at >= AWAKE_MAX || now - session.activeAt > IDLE_SLEEP) session.sleep();
		});
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
		this.#tidy();
		return session;
	}

	async #open(session, agent, env, again) {
		const path = `${this.binFolder}${delimiter}${env.PATH ?? (await this.#loginPath())}`;
		await session.open(commandWords(agent.acp), { ...this.env, ...env, PATH: path }, { again });
		if (this.#closed) {
			session.close();
			throw Object.assign(new Error(t('Studio 正在停下')), { statusCode: 503 });
		}
	}

	/** A conversation going on (or over, still in memory). */
	get(id) {
		const session = this.#sessions.get(id);
		if (!session) throw Object.assign(new Error(t('没有这个对话')), { statusCode: 404 });
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

	/**
	 * Those going on, then those kept in chats/ (the latest first); none begun and not spoken to that is over. Once the
	 * author has dragged them (`order.json`), in that order, those new since (not in it) first.
	 */
	async list() {
		const live = [...this.#sessions.values()].filter((session) => spokenTo(session) || !ASLEEP.has(session.state)).reverse();
		// Kept ones never spoken to (begun as pages, left empty) are not listed.
		const kept = this.store ? (await this.store.list()).filter((record) => !this.#sessions.has(record.id) && record.items?.some((item) => item.kind === 'user')).map(AgentSession.summaryOf) : [];
		const all = [...live.map((session) => session.summary()), ...kept];
		const rank = new Map(((await this.store?.order()) ?? []).map((id, index) => [id, index]));
		if (!rank.size) return all;
		const placed = (entry) => rank.get(entry.id) ?? -1;
		return all
			.map((entry, index) => ({ entry, index }))
			.sort((a, b) => placed(a.entry) - placed(b.entry) || a.index - b.index)
			.map(({ entry }) => entry);
	}

	/** A conversation named by the author: kept so (the agent's own title no longer put over it), its page's title too. */
	async rename(id, title) {
		const name = String(title ?? '').trim();
		if (!name) throw Object.assign(new Error(t('名字不能为空')), { statusCode: 400 });
		const session = this.#sessions.get(id);
		if (session) {
			session.title = name;
			session.named = true;
			if (this.store && spokenTo(session)) {
				// Named, not spoken in: when it was last spoken in stays as it was.
				const updated = session.updated;
				const record = session.record();
				session.updated = record.updated = updated;
				await this.store.save(record);
			}
		} else if (this.store) {
			const record = await this.store.read(id);
			await this.store.save({ ...record, title: name, named: true });
		}
		await this.store?.retitle(id, name);
		return { id, title: name };
	}

	/** The conversations in the order the author dragged them into. */
	async reorder(ids) {
		if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw Object.assign(new Error(t('顺序不对')), { statusCode: 400 });
		await this.store?.setOrder(ids);
		return { ids };
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
		clearInterval(this.#tidying);
		this.#dropSpare();
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
		if (!this.store) throw Object.assign(new Error(t('对话没有地方存')), { statusCode: 500 });
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
			console.warn(`[studio] 没能把对话写进 ${session.id}/index.md：${error instanceof Error ? error.message : error}`); // i18n-ignore: developer log
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
	/** Named by the author (renamed): the agent's own title is no longer put over it. */
	named = false;
	error = '';
	/** @type {Array<Record<string, any>>} */
	items = [];
	/** @type {Map<string, Record<string, any>>} */
	#byId = new Map();
	/** @type {Set<(event: Record<string, any>) => void>} */
	#listeners = new Set();
	/** Leave asked, or a question, not yet answered: the item's id → how to answer. */
	#asked = new Map();
	/** Its turns, counted: one ended by force is not ended again when its answer comes after all. */
	#turns = 0;
	/** Whether its adapter takes words while it works over ACP's steering extension (Claude Code's, Codex's). */
	#steering = false;
	/** Whether its agent takes pictures in what it is told. */
	/** Whether its agent takes pictures: null till it has said (as it starts), so a picture given meanwhile is not refused. */
	#seesPictures = null;
	configOptions = [];
	modes = null;
	commands = [];
	usage = null;
	#child = null;
	/** pi served in this process instead of a child (pi-agent.mjs): how to stop it. */
	#here = null;
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
		/** How long it may take to stop when told to, before it is stopped by force. */
		this.stopWait = STOP_WAIT;
	}

	/** A conversation of chats/, as it was left: shown, not going on until it is woken (AgentSessions.wake). */
	static kept(record, page) {
		const session = new AgentSession({ agent: record.agent, cwd: record.cwd, slug: record.slug ?? null, id: record.id });
		session.state = 'saved';
		session.title = record.title ?? '';
		session.named = record.named === true;
		session.created = record.created;
		session.updated = record.updated ?? record.created;
		session.configOptions = record.configOptions ?? [];
		// What was going when it was left (the Studio closed or gone mid-turn) is not going now.
		session.items = (record.items ?? []).map((item) => {
			const kept = cutOff(item) ?? item;
			// Kept before diffs were cut to the change: cut now (written so when it is saved next).
			return kept.kind === 'tool' && Array.isArray(kept.content) ? { ...kept, content: kept.content.map(trimmedDiff) } : kept;
		});
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
		return { id: this.id, agent: this.agent, slug: this.slug, cwd: this.cwd, title: this.#title(), state: this.state, error: this.error, created: this.created, updated: this.updated, configOptions: this.#shownOptions(), modes: this.modes, commands: this.commands, usage: this.usage, service: this.models?.name ?? null, serviceId: this.models?.id ?? null, pageThrough: this.pageThrough, onPage: this.madePage || spokenTo(this), canSteer: this.#here !== null || this.#steering, seesPictures: this.#seesPictures };
	}

	/**
	 * Gone on with by another agent (asleep: AgentSessions.wake starts it): a session of its own, told where what was
	 * said before is.
	 */
	handTo(agent) {
		if (!ASLEEP.has(this.state)) throw Object.assign(new Error(t('它还在做事：等它做完再换')), { statusCode: 409 });
		this.agent = { id: agent.id, name: agent.name };
		this.#acpId = null;
		this.configOptions = [];
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
		return { id: this.id, agent: this.agent, acpSessionId: this.#acpId, cwd: this.cwd, slug: this.slug, title: this.#title(), ...(this.named ? { named: true } : {}), created: this.created, updated: this.updated, service: this.models?.name ?? null, configOptions: this.configOptions, items, pageThrough: this.pageThrough };
	}

	/**
	 * Its options as the page shows them: on another service, the models are that service's (Claude Code's tiers are
	 * all it was told of: the main model for the default, opus and sonnet, the fast one for haiku), not Claude's.
	 */
	#shownOptions() {
		if (!this.models || (!this.models.main && !this.models.provider)) return this.configOptions;
		const { main, fast, provider, providers = [provider] } = this.models;
		return this.configOptions.map((option) => {
			if (option.category !== 'model' || option.type !== 'select') return option;
			if (provider) return { ...option, options: modelChoices(option).filter((choice) => providers.some((id) => choice.value.startsWith(`${id}/`))) };
			const options = [{ value: 'default', name: main }, ...(fast && fast !== main ? [{ value: 'haiku', name: t('{fast}（快）', { fast }) }] : [])];
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
		if (!argv.length) throw Object.assign(new Error(t('{name} 没有 ACP 命令', { name: this.agent.name })), { statusCode: 400 });
		if (again) {
			this.error = '';
			this.#stderr = '';
			this.#setState('starting');
		}
		const app = client({ name: 'studio' })
			.onNotification('session/update', ({ params }) => this.#update(params.update))
			.onRequest('session/request_permission', ({ params, signal }) => this.#askLeave(params, signal))
			.onRequest('elicitation/create', ({ params, signal }) => this.#askForm(params, signal));
		/** Resolves when its adapter ends (with why, if it failed); pi in this process never does. */
		let exited;
		if (servedHere(argv)) {
			// The project's pi-acp: pi in this process instead (pi-agent.mjs), no process started; its SDK loaded when first asked for.
			const { piInProcess } = await import('./pi-agent.mjs');
			const pi = piInProcess(env);
			this.#child = null;
			this.#here = pi.stop;
			exited = new Promise(() => {});
			this.#connection = app.connect(pi.stream);
		} else {
			const child = spawn(argv[0], argv.slice(1), { cwd: this.cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
			this.#child = child;
			if (child.pid) this.#forget = endWithServer(child.pid);
			child.stderr.setEncoding('utf8');
			child.stderr.on('data', (text) => {
				this.#stderr = (this.#stderr + text).slice(-STDERR_KEPT);
			});
			for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', () => {});
			exited = new Promise((resolve) => {
				child.on('error', (error) => resolve(error));
				child.on('close', (code, signal) => resolve(code === 0 || signal === 'SIGTERM' ? null : new Error(t('退出码 {code}', { code: code ?? signal }))));
			});
			// An adapter of before (gone on with in another) ends unheeded.
			void exited.then((error) => this.#child === child && this.#ended(error));
			this.#connection = app.connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout)));
		}
		try {
			const agent = this.#connection.agent;
			const opening = (async () => {
				// Questions it asks (Claude Code's AskUserQuestion) as forms in the conversation; notices, and its context
				// compacted, as lines of their own.
				const begun = await agent.request('initialize', { protocolVersion: PROTOCOL_VERSION, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false, elicitation: { form: {} }, session: { notices: {}, compaction: {} } } });
				this.#steering = begun._meta?.steering?.supported === true;
				this.#seesPictures = begun.agentCapabilities?.promptCapabilities?.image === true;
				const before = again ? await this.#loadAgain(agent, begun.agentCapabilities ?? {}) : null;
				if (before) return before;
				if (again && this.items.length) this.#forgot = true;
				return agent.request('session/new', { cwd: this.cwd, mcpServers: [] });
			})();
			// An adapter that exits before it answers (not installed, not logged in) says so on stderr.
			const made = await Promise.race([opening, exited.then((error) => Promise.reject(error ?? new Error(t('提前退出了'))))]);
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
			throw Object.assign(new Error(t('{name} 没能启动：{error}', { name: this.agent.name, error: this.error })), { statusCode: 502 });
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
	 * @param {{ pictures?: string[], files?: string[], quotes?: string[], pastes?: string[] }} [with_] pictures sent with it
	 *   (keepPicture's paths), files given with it (keepFile's), what was quoted of the conversation (Markdown), put
	 *   before it, and what was pasted at length, after it
	 */
	prompt(text, context = {}, { pictures = [], files = [], quotes = [], pastes = [] } = {}) {
		if (this.state !== 'idle') throw Object.assign(new Error(this.state === 'running' ? t('它还在做上一件事：等它做完，或者先停下') : t('这个对话已经结束了')), { statusCode: 409 });
		if (typeof text !== 'string' || (!text.trim() && !pastes.some((paste) => typeof paste === 'string' && paste.trim()))) throw Object.assign(new Error(t('要说点什么')), { statusCode: 400 });
		const named = {
			article: context.article?.title ?? null,
			selection: context.selection ? lineRange(context.selection) : null,
			mentions: (context.mentions ?? []).map((mention) => mention.title),
			// Which articles they are, for the panel to open them.
			articleSlug: context.article?.slug ?? null,
			mentionSlugs: (context.mentions ?? []).map((mention) => mention.slug ?? ''),
			...(context.widgets?.length ? { widgets: context.widgets.map((widget) => widget.title) } : {}),
		};
		let shown = this.#picturesOf(pictures);
		// The agent runs on this machine and reads files: what it is given is a file it is told of, a picture too when it
		// takes none (it can still work on it, with a program).
		const attached = this.#filesOf(files);
		if (shown.length && this.#seesPictures === false) {
			attached.push(...shown.map((picture) => picture.path));
			shown = [];
		}
		const quoted = quotes.filter((quote) => typeof quote === 'string' && quote.trim()).map((quote) => quote.trim());
		const pasted = pastes.filter((paste) => typeof paste === 'string' && paste.trim());
		const said = saidWhole({ text, quotes: quoted, pastes: pasted });
		// A slash command (/compact) as it is: what the Studio adds after it would be taken for its arguments.
		const command = /^\/\S/u.test(text) && !quoted.length && !pasted.length;
		// Running before what was said is added: a turn is put on the page once it is over, not as it begins.
		this.#setState('running');
		this.#add({ kind: 'user', id: randomUUID(), text, context: command ? { article: null, selection: null, mentions: [] } : named, ...(quoted.length ? { quotes: quoted } : {}), ...(pasted.length ? { pastes: pasted } : {}), ...(shown.length ? { pictures: shown.map((picture) => picture.path) } : {}), ...(attached.length ? { files: attached } : {}) });
		const where = command ? {} : { ...context, ...(attached.length ? { files: attached } : {}), ...(this.#forgot && this.page ? { history: relative(this.cwd, this.page) } : {}) };
		if (!command) this.#forgot = false;
		const images = shown.map(({ data, mimeType }) => ({ type: 'image', data, mimeType }));
		// pi in this process takes where the author is (the article open) into its system prompt for this run; what goes
		// with what is said (the lines selected, the articles named, the files given) goes with it, as for the others:
		// its system prompt is changed only where it differs, so the same lines selected again would be told it once.
		const turn = this.#here
			? this.#connection.agent.request('session/prompt', { sessionId: this.#acpId, prompt: [{ type: 'text', text: withContext(said, where, 'message') }, ...images], _meta: { studioContext: contextBlock(where, 'standing') } })
			: this.#connection.agent.request('session/prompt', { sessionId: this.#acpId, prompt: [{ type: 'text', text: withContext(said, where) }, ...images] });
		const turnNumber = ++this.#turns;
		void turn.then(
			(done) => {
				// Stopped by force meanwhile (#forceStop): over already.
				if (this.#turns !== turnNumber) return;
				this.#settle();
				const turn = this.items.slice(this.items.findLastIndex((item) => item.kind === 'user') + 1);
				if (done.stopReason !== 'end_turn') this.#add({ kind: 'stop', id: randomUUID(), reason: done.stopReason });
				// A turn over with nothing said or done: its service refused it (pi-acp says no more than that).
				else if (!turn.length) this.#add({ kind: 'error', id: randomUUID(), message: t('{name} 没有回答：可能是 API key 不对、模型用不了，或者连不上网络', { name: this.agent.name }) });
				// Over after thinking or running tools, nothing said: some models end so (all their output thinking).
				else if (!turn.some((item) => item.kind === 'message' && item.text.trim())) {
					this.#add({ kind: 'notice', id: randomUUID(), severity: 'warning', title: t('{name} 停下了，但没有说结论', { name: this.agent.name }), description: t('模型有时想完或做完就结束了这一轮。'), resume: true });
				}
				if (this.state === 'running') this.#setState('idle');
			},
			(error) => {
				if (this.#turns !== turnNumber || this.state === 'closed' || this.state === 'failed') return;
				this.#settle();
				this.#add({ kind: 'error', id: randomUUID(), message: this.#why(error) });
				this.#setState('idle');
			},
		);
	}

	/** The pictures kept for it (keepPicture), read to be sent: those not of its folder left out. */
	#picturesOf(paths) {
		const folder = this.page ? join(dirname(this.page), 'ai', 'pictures') : null;
		if (!folder || !Array.isArray(paths)) return [];
		return paths
			.filter((path) => typeof path === 'string' && dirname(path) === folder)
			.map((path) => ({ path, data: readFileSync(path).toString('base64'), mimeType: PICTURE_TYPES[path.split('.').pop()] ?? 'image/png' }));
	}

	/** The files kept for it (keepFile), as they are given: those not of its folder left out. */
	#filesOf(paths) {
		const folder = this.page ? join(dirname(this.page), 'ai', 'files') : null;
		if (!folder || !Array.isArray(paths)) return [];
		return paths.filter((path) => typeof path === 'string' && dirname(dirname(path)) === folder);
	}

	/**
	 * A file the author gives with what they say (a PDF, a table, an output), kept in its folder (ai/files/<id>/, its own
	 * name kept, for the agent to know it by): its path, to send it by.
	 */
	keepFile(name, bytes) {
		const plain = basename(String(name ?? '')).replace(/[\u0000-\u001f/\\:]/gu, '_').trim();
		if (!plain || plain === '.' || plain === '..') throw Object.assign(new Error(t('要给出文件名')), { statusCode: 400 });
		if (!this.page) throw Object.assign(new Error(t('这个对话没有地方放文件')), { statusCode: 409 });
		const path = join(dirname(this.page), 'ai', 'files', randomUUID().slice(0, 8), plain);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, bytes);
		return path;
	}

	/** A picture the author gives with what they say, kept in its folder (ai/pictures/): its path, to send it by. */
	keepPicture(bytes, mimeType) {
		const extension = Object.entries(PICTURE_TYPES).find(([, type]) => type === mimeType)?.[0];
		if (!extension) throw Object.assign(new Error(t('只收图片（png、jpg、gif、webp）')), { statusCode: 415 });
		if (!this.page) throw Object.assign(new Error(t('这个对话没有地方放图片')), { statusCode: 409 });
		const path = join(dirname(this.page), 'ai', 'pictures', `${randomUUID()}.${extension}`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, bytes);
		return path;
	}

	/**
	 * Words of the author's while it works (`canSteer`): shown as said, taken by it as soon as it can (pi once its step
	 * is done; Claude Code and Codex over ACP's steering extension), the turn going on.
	 */
	steer(text) {
		if (this.state !== 'running' || !(this.#here || this.#steering)) throw Object.assign(new Error(t('现在不能插话：等它做完，或者先停下')), { statusCode: 409 });
		if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error(t('要说点什么')), { statusCode: 400 });
		this.#add({ kind: 'user', id: randomUUID(), text, context: { article: null, selection: null, mentions: [] }, steer: true });
		const missed = (error) => this.#add({ kind: 'error', id: randomUUID(), message: t('插话没送到：{error}', { error: this.#why(error) }) });
		if (this.#here) {
			void this.#connection.agent.request('_studio/steer', { sessionId: this.#acpId, text }).catch(missed);
			return;
		}
		// Its turn over meanwhile: said to be sent again (as something said, not words in between).
		void this.#connection.agent
			.request('_session/steering', { sessionId: this.#acpId, prompt: [{ type: 'text', text }], _meta: { steering: { idleBehavior: 'promptRequired' } } })
			.then((done) => {
				if (done?.outcome === 'promptRequired') missed(new Error(t('它刚好做完了这一轮：再发一次')));
				else if (done?.outcome === 'failed') missed(new Error(done.reason ?? t('它没收下')));
			}, missed);
	}

	/**
	 * A question it asks (ACP's form elicitation: Claude Code's AskUserQuestion), shown as a form in the conversation;
	 * resolves with the answer (accept with what was chosen, decline: skipped) or cancel when stopped. One that asks
	 * to open an address is declined.
	 */
	#askForm(params, signal) {
		if (params.mode === 'url' || !params.requestedSchema) return Promise.resolve({ action: 'decline' });
		const id = randomUUID();
		const item = { kind: 'question', id, toolCallId: params.toolCallId ?? null, message: params.message ?? '', schema: params.requestedSchema, answer: null };
		const answered = new Promise((resolve) => {
			const answer = (response) => {
				if (!this.#asked.has(id)) return;
				this.#asked.delete(id);
				const given = response?.action === 'accept' ? { action: 'accept', content: response.content ?? {} } : response?.action === 'decline' ? { action: 'decline' } : { action: 'cancel' };
				this.#put({ ...item, answer: given }, true);
				resolve(given);
			};
			this.#asked.set(id, answer);
			signal?.addEventListener('abort', () => answer(null), { once: true });
		});
		this.#add(item);
		return answered;
	}

	/** The author's answer to a question it asked (`#askForm`). */
	reply(question, response) {
		const answer = this.#asked.get(question);
		if (!answer || this.#byId.get(question)?.kind !== 'question') throw Object.assign(new Error(t('这个问题已经回答过了')), { statusCode: 409 });
		answer(response && typeof response === 'object' ? response : null);
	}

	/**
	 * Stops what it is doing: what it asked leave for is refused. One that does not stop (an adapter stuck, a service
	 * not answering) is stopped by force a while later (#forceStop).
	 */
	cancel() {
		if (this.state !== 'running') return;
		for (const answer of this.#asked.values()) answer(null);
		void this.#connection.agent.notify('session/cancel', { sessionId: this.#acpId }).catch(() => {});
		const turn = this.#turns;
		const timer = setTimeout(() => {
			if (this.state === 'running' && this.#turns === turn) this.#forceStop();
		}, this.stopWait);
		timer.unref?.();
	}

	/** Its agent let go, still working: what was going cut off, said so; woken again when spoken to, as one asleep. */
	#forceStop() {
		this.#turns += 1;
		this.#settle();
		this.#add({ kind: 'notice', id: randomUUID(), severity: 'warning', title: t('{name} 停不下来，已经强制停下', { name: this.agent.name }), description: t('再说话时会重新接上这个对话。') });
		this.#setState('idle');
		this.sleep('SIGKILL');
	}

	/** What was going when its turn ended: cut off (status `interrupted`), not left turning. */
	#settle() {
		for (const item of [...this.items]) {
			const cut = cutOff(item);
			if (cut) this.#put(cut, true);
		}
	}

	/** The author's answer to leave asked (`optionId`), or no (`null`). */
	answer(permission, optionId) {
		const answer = this.#asked.get(permission);
		if (!answer) throw Object.assign(new Error(t('这个请求已经回答过了')), { statusCode: 409 });
		answer(optionId);
	}

	/** One of its options (model, mode, effort…) set to `value`. */
	async configure(configId, value) {
		if (this.state !== 'idle' && this.state !== 'running') throw Object.assign(new Error(t('这个对话已经结束了')), { statusCode: 409 });
		const done = await this.#connection.agent.request('session/set_config_option', { sessionId: this.#acpId, configId, value });
		this.configOptions = done.configOptions ?? this.configOptions;
		const mode = this.configOptions.find((option) => option.category === 'mode');
		if (mode && this.modes) this.modes = { ...this.modes, currentModeId: mode.currentValue };
		this.#tell({ type: 'session', session: this.summary() });
		return this.summary();
	}

	/** When something last happened in it (said, done, changed): the latest are left running (AgentSessions #tidy). */
	activeAt = Date.now();

	/**
	 * Its agent stopped for now, idle (an adapter takes memory): kept as it is (state `saved`), woken when spoken to
	 * (AgentSessions.wake), its session loaded again.
	 */
	sleep(signal = 'SIGTERM') {
		if (this.state !== 'idle') return;
		const child = this.#child;
		// Its end not taken for a failure.
		this.#child = null;
		this.#connection?.close();
		this.#letHereGo();
		this.#forget();
		if (child?.pid && child.exitCode === null) {
			try {
				process.kill(-child.pid, signal);
			} catch {
				// Over already.
			}
		}
		this.#setState('saved');
	}

	/** pi in this process (servedHere), its sessions let go. */
	#letHereGo() {
		const stop = this.#here;
		this.#here = null;
		stop?.();
	}

	/** Told when it is closed (unlisted ones are let go then). */
	onClose = () => {};

	close() {
		this.onClose();
		for (const answer of this.#asked.values()) answer(null);
		this.#connection?.close();
		this.#letHereGo();
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
		this.#settle();
		this.error = this.#why(error ?? new Error(t('它结束了')));
		this.#add({ kind: 'error', id: randomUUID(), message: t('{name} 停了：{error}', { name: this.agent.name, error: this.error }) });
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
				// A picture it sends (some agents attach one): kept, and in its words as Markdown, shown there.
				if (update.content?.type === 'image') return this.#picture(update);
				return this.#words('message', update);
			case 'agent_thought_chunk':
				return this.#words('thought', update);
			case 'tool_call':
			case 'tool_call_update':
				return this.#tool(update);
			case 'plan':
				return this.#put({ kind: 'plan', id: 'plan', entries: update.entries ?? [] }, true);
			case 'notice':
				return this.#add({ kind: 'notice', id: randomUUID(), severity: update.severity, title: update.title, description: update.description ?? '' });
			// Its context compacted (what was said before made a summary): a line, the summary under it.
			case 'compaction_update': {
				const id = `compaction-${update.compactionId}`;
				const before = this.#byId.get(id);
				return this.#put({ kind: 'compaction', id, status: update.status ?? 'in_progress', error: update.error ?? '', summary: before?.summary ?? '' }, Boolean(before));
			}
			case 'compaction_summary_chunk': {
				const id = `compaction-${update.compactionId}`;
				const before = this.#byId.get(id) ?? { kind: 'compaction', id, status: 'in_progress', error: '', summary: '' };
				return this.#put({ ...before, summary: before.summary + (update.content?.text ?? '') }, this.#byId.has(id));
			}
			case 'session_info_update':
				if (typeof update.title === 'string' && !this.named) this.title = withoutContext(update.title, this.items.find((item) => item.kind === 'user')?.text ?? '');
				break;
			case 'config_option_update':
				this.configOptions = update.configOptions ?? this.configOptions;
				break;
			case 'current_mode_update':
				if (this.modes) this.modes = { ...this.modes, currentModeId: update.currentModeId };
				break;
			case 'available_commands_update':
				this.commands = (update.availableCommands ?? []).map(({ name, description, input }) => ({ name, description, hint: input?.hint ?? '' }));
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

	/**
	 * A picture the agent sent, kept in its conversation's folder (chats/<id>/ai/pictures/), or where it says it is (a
	 * file:// uri); its words take it as Markdown, which the panel shows. One of a conversation not kept is left out.
	 */
	#picture(update) {
		const { data, mimeType, uri } = update.content;
		let path = typeof uri === 'string' && uri.startsWith('file://') ? fileURLToPath(uri) : null;
		if (!path && typeof data === 'string' && this.page) {
			const extension = { 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mimeType] ?? 'png';
			path = join(dirname(this.page), 'ai', 'pictures', `${randomUUID()}.${extension}`);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, Buffer.from(data, 'base64'));
		}
		if (path) this.#words('message', { ...update, content: { type: 'text', text: `\n\n![](${path})\n\n` } });
	}

	/** A tool call, made or changed: its fields as they now are; what a command prints added to its output. */
	#tool(update) {
		const known = this.#byId.get(update.toolCallId);
		const item = known ? { ...known } : { kind: 'tool', id: update.toolCallId, title: '', toolKind: 'other', status: 'pending', content: [], locations: [], rawInput: null, output: '', exitCode: null };
		for (const [field, key] of [['title', 'title'], ['toolKind', 'kind'], ['status', 'status'], ['content', 'content'], ['locations', 'locations'], ['rawInput', 'rawInput'], ['rawOutput', 'rawOutput']]) {
			if (update[key] !== undefined && update[key] !== null) item[field] = update[key];
		}
		// A change kept as the change, not the whole file twice (a long article's every edit was its text, before and after).
		if (Array.isArray(update.content)) item.content = item.content.map(trimmedDiff);
		// Codex streams what a command prints beside the update, the client having no terminal of its own.
		const printed = update._meta?.terminal_output_delta?.data;
		if (typeof printed === 'string') item.output += printed;
		const exit = update._meta?.terminal_exit;
		if (exit) item.exitCode = exit.exit_code ?? null;
		// Subagents it runs (pi-agent.mjs subagentsOf), each as it is now: shown apart, not folded in with the steps.
		const subagents = update._meta?.studio?.subagents;
		if (Array.isArray(subagents)) item.subagents = subagents;
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
		this.activeAt = Date.now();
		for (const listener of this.#listeners) {
			try {
				listener(event);
			} catch {
				// A page gone: its stream is closed by the route.
			}
		}
	}
}

/**
 * Whether an adapter is served in this process rather than started: the project's pi-acp, named as the presets name it
 * (pi-agent.mjs). One named by its path (another's, a test's stand-in) is started as it is.
 */
const servedHere = (argv) => argv.length === 1 && argv[0] === 'pi-acp';

/** What a conversation made ready is for: the same agent, place, and service. */
const spareKey = (agent, cwd, env, models) => JSON.stringify([agent.id, agent.acp, cwd, env, models]);

/** Whether the author has said something in it (one never spoken to is not kept, nor listed once over). */
const spokenTo = (session) => session.items.some((item) => item.kind === 'user');

/** A select option's choices, its groups flattened. */
function modelChoices(option) {
	return (option.options ?? []).flatMap((entry) => (Array.isArray(entry.options) ? entry.options : [entry]));
}

/**
 * @typedef {object} PromptContext where the author is, as the Studio tells the agent (paths from its folder)
 * @property {{ slug?: string, title: string, path: string, brief?: string | null }} [article] the article open (its ai/brief.md, or null for none)
 * @property {{ start: number, end: number, text: string }} [selection] the lines of it selected
 * @property {Array<{ slug?: string, title: string, path: string, brief?: string | null }>} [mentions] the articles named with @
 * @property {string} [history] where what was said before is kept (chats/…/index.md), for an agent that cannot remember it
 * @property {Array<{ title: string, state: string }>} [widgets] what the widgets in the answers told of themselves since
 *   (note.tell): each its title, and its value as JSON
 */

const lineRange = ({ start, end }) => (start === end ? t('第 {start} 行', { start }) : t('第 {start}–{end} 行', { start, end }));
const promptLineRange = ({ start, end }) => (start === end ? `第 ${start} 行` : `第 ${start}–${end} 行`); // i18n-ignore: for the AI

/** Whether an article has its ai/brief.md (blog/AGENTS.md: read it first), said, so that one not there is not tried for. */
function briefOf({ brief }) {
	if (brief === undefined) return '';
	return brief ? `；它的写作要求在 ${brief}，先读` : '（没有 ai/brief.md，不用找）'; // i18n-ignore: for the AI
}

/** Lines kept around a change in a diff kept, and of the change itself at most (the panel shows the change). */
const DIFF_AROUND = 3;
const DIFF_LINES = 400;

/**
 * A file's change (ACP's diff: its text before and after) as kept: the lines changed and a few around them, not the
 * whole file twice; a change longer than DIFF_LINES, its start and how many more. Anything else as it is.
 */
export function trimmedDiff(content) {
	if (content?.type !== 'diff' || typeof content.newText !== 'string') return content;
	const old = typeof content.oldText === 'string' ? content.oldText.split('\n') : null;
	const next = content.newText.split('\n');
	const before = old ?? [];
	let head = 0;
	while (head < before.length && head < next.length && before[head] === next[head]) head += 1;
	let tail = 0;
	while (tail < before.length - head && tail < next.length - head && before[before.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
	const from = Math.max(0, head - DIFF_AROUND);
	const part = (lines) => {
		const kept = lines.slice(from, Math.min(lines.length, lines.length - tail + DIFF_AROUND));
		return kept.length > DIFF_LINES + 2 * DIFF_AROUND ? [...kept.slice(0, DIFF_LINES), t('…（还有 {count} 行）', { count: kept.length - DIFF_LINES })] : kept;
	};
	const cutNew = part(next);
	if (from === 0 && cutNew.length === next.length && (!old || part(old).length === old.length)) return content;
	return { ...content, oldText: old ? part(old).join('\n') : content.oldText, newText: cutNew.join('\n'), ...(from ? { line: from + 1 } : {}) };
}

/**
 * An item still going when its turn is over (stopped, failed, the Studio gone): cut off (`interrupted`; a subagent
 * still going too), not left turning; null for one that is not.
 */
function cutOff(item) {
	if (item.kind === 'tool' && (item.status === 'pending' || item.status === 'in_progress')) {
		const subagents = item.subagents?.map((agent) => (agent.status === 'running' || agent.status === 'waiting' ? { ...agent, status: 'interrupted', doing: '' } : agent));
		return { ...item, status: 'interrupted', ...(subagents ? { subagents } : {}) };
	}
	if (item.kind === 'compaction' && item.status === 'in_progress') return { ...item, status: 'cancelled' };
	return null;
}

/** What the author said, then what the Studio adds of where they are (`part` of it), marked as the Studio's. */
export function withContext(text, context = {}, part = 'all') {
	const block = contextBlock(context, part);
	return block ? `${text}\n\n${block}` : text;
}

/**
 * Where the author is, as the Studio tells the agent (withContext puts it after what was said; pi in this process
 * takes it into its system prompt instead): empty when there is nothing to tell.
 */
export function contextBlock({ article, selection, mentions = [], files = [], history, widgets = [] } = {}, part = 'all') {
	// `standing`: where the author is (for a system prompt); `message`: what goes with this one thing said.
	const standing = part !== 'message';
	const message = part !== 'standing';
	const lines = [];
	if (standing && history) lines.push(`这是接着之前的对话说的，但你那边接不上之前的会话了：之前说过的话记在 ${history}，需要时去读`); // i18n-ignore: for the AI
	if (standing && article) lines.push(`当前打开的文章：《${article.title}》，文件 ${article.path}${briefOf(article)}`); // i18n-ignore: for the AI
	// pi has the article in its system prompt too, but told there once: after a long run a model lost it (10-30), so a
	// line of it goes with each thing said.
	if (message && !standing && article) lines.push(`当前打开的文章：《${article.title}》，文件 ${article.path}`); // i18n-ignore: for the AI
	if (message && article && selection) {
		const fence = '`'.repeat(Math.max(3, ...[...selection.text.matchAll(/`+/gu)].map((run) => run[0].length + 1)));
		lines.push(`这句话选中的是《${article.title}》（${article.path}）的${promptLineRange(selection)}：`, `${fence}markdown`, selection.text, fence); // i18n-ignore: for the AI
		if (selection.cut) lines.push(`选中的太长，上面只有开头 ${selection.text.length} 个字；其余的在文件的这几行里，要用就去读`); // i18n-ignore: for the AI
	}
	if (message) for (const mention of mentions) lines.push(`用 @ 提到的文章：《${mention.title}》，文件 ${mention.path}${briefOf(mention)}`); // i18n-ignore: for the AI
	if (message && files.length) lines.push('随这句话附上的文件（在本机，用读文件的工具或命令去读）：', ...files.map((file) => `- ${file}`)); // i18n-ignore: for the AI
	if (message && widgets.length) {
		lines.push('对话里的交互模块（你写的 ```widget）现在的状态，是用户在模块里操作后模块用 note.tell 交给你的：'); // i18n-ignore: for the AI
		for (const widget of widgets) lines.push(`- 「${widget.title || '交互模块'}」：${widget.state}`); // i18n-ignore: for the AI
	}
	if ((standing && article) || (message && mentions.length)) lines.push('回答里说到这些或别的文章时，写出标题并用《》括起来：Studio 会把它变成能点开的链接'); // i18n-ignore: for the AI
	if (!lines.length) return '';
	return `<studio-context>\n（Studio 自动附上的，说明用户现在在看什么；不是用户写的话）\n${lines.join('\n')}\n</studio-context>`; // i18n-ignore: for the AI
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
