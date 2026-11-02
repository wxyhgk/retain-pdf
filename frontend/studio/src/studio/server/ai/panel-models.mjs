import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';
import presets from './model-presets.json' with { type: 'json' };
import { t } from '@blog/i18n/index.mjs';

/**
 * Which models the AI panel's Claude Code talks to: the author's Claude account (its own login), or any service
 * that speaks Anthropic's API (Anthropic's own with a key, DeepSeek, Kimi, 智谱, 通义千问, MiniMax, another
 * address), its key and its models. Kept as `panelModels` in the Studio's settings (out of git, readable by the
 * author alone); the page sees whether a key is there, never the key.
 *
 * A service is given to Claude Code the way their guides say, by its environment: the address, the key, and the
 * models it uses for its tiers (`main` for opus and sonnet, `fast` for haiku and its helpers). Their model names
 * change often: each preset's (model-presets.json) are only first suggestions, changed in the panel and tried there (`check`).
 */

/** @typedef {'bearer' | 'x-api-key'} KeyStyle how the key is sent: ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY */
/** @typedef {{ id: string, name: string, baseUrl: string, keyStyle: KeyStyle, main: string, fast: string, keyUrl: string }} Provider */

/** @type {readonly Provider[]} The services and their first suggestions (model-presets.json, where their names are kept up to date). */
export const PROVIDERS = Object.freeze(presets.claudeCode);

const ADDRESS = /^https?:\/\/[^\s/]+(\/\S*)?$/u;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @typedef {object} PanelModelChoice the one chosen, as Claude Code is given it
 * @property {Provider} provider
 * @property {string} baseUrl
 * @property {string} apiKey
 * @property {string} main
 * @property {string} fast
 */

export class PanelModels {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile, { fetch: fetchImpl = globalThis.fetch } = {}) {
		this.settingsFile = settingsFile;
		this.fetch = fetchImpl;
	}

	async #saved() {
		const saved = (await readSettings(this.settingsFile)).panelModels;
		return saved && typeof saved === 'object' ? saved : {};
	}

	/** The service chosen, with its address, key and models as saved (or as its preset suggests). @returns {Promise<PanelModelChoice>} */
	async chosen() {
		const saved = await this.#saved();
		return this.#choice(saved, saved.provider);
	}

	#choice(saved, id) {
		const provider = PROVIDERS.find((entry) => entry.id === id) ?? PROVIDERS[0];
		const own = saved.services?.[provider.id] ?? {};
		return {
			provider,
			baseUrl: text(own.baseUrl) || provider.baseUrl,
			apiKey: text(own.apiKey),
			main: text(own.main) || provider.main,
			fast: text(own.fast) || text(own.main) || provider.fast,
		};
	}

	/** What the page may see: the services, which is chosen, each one's address and models, and whether it has a key. */
	async shown() {
		const saved = await this.#saved();
		const chosen = await this.chosen();
		return {
			chosen: chosen.provider.id,
			providers: PROVIDERS.map((provider) => {
				const { baseUrl, apiKey, main, fast } = this.#choice(saved, provider.id);
				return { ...provider, baseUrl, main, fast, hasKey: Boolean(apiKey), suggested: { baseUrl: provider.baseUrl, main: provider.main, fast: provider.fast } };
			}),
		};
	}

	/**
	 * Chooses a service and saves what is given of it: `apiKey: ''` forgets its key, left out keeps it.
	 * @param {{ provider: string, baseUrl?: string, apiKey?: string, main?: string, fast?: string }} change
	 */
	async set(change) {
		const provider = PROVIDERS.find((entry) => entry.id === change?.provider);
		if (!provider) throw fail(t('没有这个模型来源'));
		for (const key of ['baseUrl', 'apiKey', 'main', 'fast']) {
			if (change[key] !== undefined && typeof change[key] !== 'string') throw fail(t('{key} 要是文字', { key }));
		}
		if (change.baseUrl !== undefined && change.baseUrl.trim() && !ADDRESS.test(change.baseUrl.trim())) throw fail(t('接口地址要以 http:// 或 https:// 开头'));
		const before = this.#choice(await this.#saved(), provider.id);
		if (provider.id !== 'claude-account' && !(change.baseUrl !== undefined ? change.baseUrl.trim() || provider.baseUrl : before.baseUrl)) throw fail(t('要填接口地址'));
		await updateSettings(this.settingsFile, (settings) => {
			const saved = settings.panelModels && typeof settings.panelModels === 'object' ? settings.panelModels : {};
			const own = { ...(saved.services?.[provider.id] ?? {}) };
			for (const key of ['baseUrl', 'apiKey', 'main', 'fast']) {
				if (change[key] === undefined) continue;
				if (change[key].trim()) own[key] = change[key].trim();
				else delete own[key];
			}
			return { ...settings, panelModels: { ...saved, provider: provider.id, services: { ...(saved.services ?? {}), [provider.id]: own } } };
		});
		return this.shown();
	}

	/**
	 * The environment Claude Code is started with for the service chosen: none for the Claude account (its own
	 * login), else the address, the key (and not the other way of sending one, from the server's environment) and
	 * the models, with no traffic of Claude Code's own to Anthropic.
	 * @returns {Promise<Record<string, string>>}
	 */
	async env() {
		const { provider, baseUrl, apiKey, main, fast } = await this.chosen();
		if (provider.id === 'claude-account') return {};
		if (!apiKey) throw fail(t('还没有填 {name} 的 API key：在 AI 面板的 ⚙ 里填', { name: provider.name }), 409);
		const key = provider.keyStyle === 'bearer' ? { ANTHROPIC_AUTH_TOKEN: apiKey, ANTHROPIC_API_KEY: '' } : { ANTHROPIC_API_KEY: apiKey, ANTHROPIC_AUTH_TOKEN: '' };
		const models = main
			? { ANTHROPIC_MODEL: main, ANTHROPIC_DEFAULT_OPUS_MODEL: main, ANTHROPIC_DEFAULT_SONNET_MODEL: main, ANTHROPIC_DEFAULT_HAIKU_MODEL: fast, CLAUDE_CODE_SUBAGENT_MODEL: fast }
			: {};
		return { ANTHROPIC_BASE_URL: baseUrl, ...key, ...models, API_TIMEOUT_MS: '600000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
	}

	/**
	 * The service Claude Code is started for (`id`, `name`) and the models it is told to use, by tier (none: its own,
	 * Anthropic's); null for the Claude account.
	 */
	async models() {
		const { provider, main, fast } = await this.chosen();
		if (provider.id === 'claude-account') return null;
		return main ? { id: provider.id, name: provider.name, main, fast } : { id: provider.id, name: provider.name };
	}

	/** Whether the service `id` can be used now: the Claude account (its login is its own), or one with a key. */
	async usable(id) {
		if (id === 'claude-account') return true;
		return Boolean(this.#choice(await this.#saved(), id).apiKey);
	}

	/**
	 * Tries the service chosen with a request of one word, as Claude Code would ask it: whether the address, the key
	 * and the main model work, and what the service says when they do not.
	 */
	async check() {
		const { provider, baseUrl, apiKey, main } = await this.chosen();
		if (provider.id === 'claude-account') throw fail(t('Claude 账号不用检查：登录以后就能用'));
		if (!apiKey) throw fail(t('还没有填 API key'));
		const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', ...(provider.keyStyle === 'bearer' ? { authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey }) };
		const model = main || presets.checkModel;
		let response;
		try {
			response = await this.fetch(`${baseUrl.replace(/\/+$/u, '')}/v1/messages`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: '说「好」' }] }), // i18n-ignore: for the AI
				signal: AbortSignal.timeout(30_000),
			});
		} catch (error) {
			throw fail(t('连不上 {baseUrl}：{error}', { baseUrl, error: error instanceof Error ? error.message : String(error) }), 502);
		}
		const body = await response.text();
		if (!response.ok) {
			let said = body.slice(0, 300);
			try {
				const parsed = JSON.parse(body);
				said = parsed?.error?.message ?? parsed?.message ?? said;
			} catch {
				// As it came.
			}
			throw fail(t('{name} 回答 {status}：{message}', { name: provider.name, status: response.status, message: said }), 502);
		}
		let answered = '';
		try {
			answered = (JSON.parse(body).content ?? []).map((block) => block.text ?? '').join('').trim();
		} catch {
			// A body that is not the Messages API's: the service is something else.
			throw fail(t('{baseUrl} 的回答不是 Anthropic 接口的格式', { baseUrl }), 502);
		}
		return { ok: true, model, answered };
	}
}

/**
 * Whether the Claude Code and Codex the panel starts (the project's own, in `binFolder`) have an account logged in,
 * as their own commands say: `{ claude: { loggedIn, plan }, codex: { loggedIn, how } }`. Run with this server's
 * Node, so a Mac app's short PATH does not matter.
 * @param {string} binFolder the project's node_modules/.bin
 */
export async function accountsLoggedIn(binFolder) {
	const run = async (name, args) => {
		try {
			const program = await realpath(join(binFolder, name));
			return await new Promise((resolve) => {
				execFile(process.execPath, [program, ...args], { timeout: 20_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => resolve({ ok: !error, out: `${stdout}${stderr}` }));
			});
		} catch {
			return { ok: false, out: '', missing: true };
		}
	};
	const [claude, codex] = await Promise.all([run('claude-agent-acp', ['--cli', 'auth', 'status', '--json']), run('codex', ['login', 'status'])]);
	let claudeStatus = { loggedIn: false, plan: '', missing: Boolean(claude.missing) };
	try {
		const said = JSON.parse(claude.out.slice(claude.out.indexOf('{')));
		claudeStatus = { loggedIn: said.loggedIn === true, plan: typeof said.subscriptionType === 'string' ? said.subscriptionType : said.authMethod ?? '', missing: false };
	} catch {
		// Not logged in, or not there: as above.
	}
	const how = /ChatGPT/iu.test(codex.out) ? 'ChatGPT' : /API key/iu.test(codex.out) ? 'API key' : '';
	return { claude: claudeStatus, codex: { loggedIn: codex.ok && /logged in/iu.test(codex.out) && !/not logged in/iu.test(codex.out), how, missing: Boolean(codex.missing) } };
}

/**
 * pi's services (its own catalog of them and of their models, so nothing is typed but the key): which one the panel's
 * pi uses, by the environment variable pi reads its key from. `pi-own`: as pi is set up on this machine (~/.pi).
 */
export const PI_PROVIDERS = Object.freeze(presets.pi);

/**
 * pi in the AI panel (pi-acp): the service and its key, kept as `panelModels.pi` with the rest; what pi is started
 * with; its catalog of the service's models; a word asked to try it. pi is the project's own (node_modules/.bin).
 */
export class PiModels {
	/** @param {string} settingsFile @param {string} binFolder the project's node_modules/.bin */
	constructor(settingsFile, binFolder) {
		this.settingsFile = settingsFile;
		this.binFolder = binFolder;
	}

	async #saved() {
		const saved = (await readSettings(this.settingsFile)).panelModels?.pi;
		return saved && typeof saved === 'object' ? saved : {};
	}

	async chosen() {
		const saved = await this.#saved();
		const provider = PI_PROVIDERS.find((entry) => entry.id === saved.provider) ?? PI_PROVIDERS[0];
		return { provider, apiKey: text(saved.keys?.[provider.id]) };
	}

	async shown() {
		const saved = await this.#saved();
		const { provider } = await this.chosen();
		return { chosen: provider.id, providers: PI_PROVIDERS.map((entry) => ({ ...entry, hasKey: Boolean(text(saved.keys?.[entry.id])) })) };
	}

	/** Chooses a service; `apiKey: ''` forgets its key, left out keeps it. */
	async set(change) {
		const provider = PI_PROVIDERS.find((entry) => entry.id === change?.provider);
		if (!provider) throw fail(t('没有这个模型来源'));
		if (change.apiKey !== undefined && typeof change.apiKey !== 'string') throw fail(t('apiKey 要是文字'));
		await updateSettings(this.settingsFile, (settings) => {
			const panel = settings.panelModels && typeof settings.panelModels === 'object' ? settings.panelModels : {};
			const pi = panel.pi && typeof panel.pi === 'object' ? panel.pi : {};
			const keys = { ...(pi.keys ?? {}) };
			if (change.apiKey !== undefined) {
				if (change.apiKey.trim()) keys[provider.id] = change.apiKey.trim();
				else delete keys[provider.id];
			}
			return { ...settings, panelModels: { ...panel, pi: { provider: provider.id, keys } } };
		});
		return this.shown();
	}

	/** The services with a key saved, by their ids. */
	async #keyed() {
		const saved = await this.#saved();
		return PI_PROVIDERS.filter((entry) => entry.env && text(saved.keys?.[entry.id])).map((entry) => ({ ...entry, apiKey: text(saved.keys[entry.id]) }));
	}

	/**
	 * What pi is started with: the project's pi, no network at its start, each key saved where pi looks for it (so a
	 * model of any of those services can be chosen in a conversation, without starting pi again).
	 */
	async env() {
		const { provider, apiKey } = await this.chosen();
		const base = { PI_ACP_PI_COMMAND: join(this.binFolder, 'pi'), PI_OFFLINE: '1' };
		if (provider.env && !apiKey) throw fail(t('还没有填 pi 用的 {name} 的 API key：在 AI 面板的 ⚙ 里填', { name: provider.name }), 409);
		return { ...base, ...Object.fromEntries((await this.#keyed()).map((entry) => [entry.env, entry.apiKey])) };
	}

	/**
	 * The service pi is to use first (`provider`), and those whose models are shown (each with a key); null: pi's own
	 * setting, all its models shown.
	 */
	async service() {
		const { provider } = await this.chosen();
		return provider.env ? { id: provider.id, name: provider.name, provider: provider.id, providers: (await this.#keyed()).map((entry) => entry.id) } : null;
	}

	/** Runs the project's pi with the service's key: its output, or why it failed. */
	async #pi(args) {
		const env = { ...process.env, ...(await this.env()) };
		const program = await realpath(join(this.binFolder, 'pi'));
		return new Promise((resolve, reject) => {
			const child = execFile(process.execPath, [program, '--offline', ...args], { env, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (error) reject(fail(`${String(stderr || stdout || (error.killed ? t('一分钟没有回答') : error.message)).trim().split('\n').slice(-3).join(' ').slice(0, 400)}`, 502));
				else resolve(String(stdout));
			});
			// pi takes what comes on its input as part of what it is asked: nothing comes.
			child.stdin?.end();
		});
	}

	/** The service's models in pi's catalog (`provider/id`), the first the one it suggests. */
	async models() {
		const { provider } = await this.chosen();
		if (!provider.env) return [];
		const listed = await this.#pi(['--list-models', provider.id]);
		return listed.split('\n').slice(1).map((line) => line.trim().split(/\s+/u)).filter(([id]) => id === provider.id).map(([id, model]) => `${id}/${model}`);
	}

	/** The service asked a word with its first model: what it answered. */
	async check() {
		const { provider } = await this.chosen();
		if (!provider.env) throw fail(t('用 pi 自己的设置时不用在这里检查'));
		const models = await this.models();
		if (!models.length) throw fail(t('pi 的目录里没有 {name} 的模型', { name: provider.name }), 502);
		const answered = (await this.#pi(['-p', '--no-session', '--no-tools', '--no-extensions', '--no-skills', '--no-context-files', '--model', models[0], '说「好」，只说这一个字'])).trim(); // i18n-ignore: for the AI
		if (!answered) throw fail(t('{name} 没有回答：可能是 key 不对，或者连不上', { name: provider.name }), 502);
		return { ok: true, model: models[0], answered, models };
	}
}
