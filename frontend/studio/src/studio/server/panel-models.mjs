import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { readSettings, updateSettings } from '@blog/kernel/settings-file.mjs';

/**
 * Which models the AI panel's Claude Code talks to: the author's Claude account (its own login), or any service
 * that speaks Anthropic's API (Anthropic's own with a key, DeepSeek, Kimi, 智谱, 通义千问, MiniMax, another
 * address), its key and its models. Kept as `panelModels` in the Studio's settings (out of git, readable by the
 * author alone); the page sees whether a key is there, never the key.
 *
 * A service is given to Claude Code the way their guides say, by its environment: the address, the key, and the
 * models it uses for its tiers (`main` for opus and sonnet, `fast` for haiku and its helpers). Their model names
 * change often: each preset's are only first suggestions, changed in the panel and tried there (`check`).
 */

/** @typedef {'bearer' | 'x-api-key'} KeyStyle how the key is sent: ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY */
/** @typedef {{ id: string, name: string, baseUrl: string, keyStyle: KeyStyle, main: string, fast: string, keyUrl: string }} Provider */

/** @type {Provider[]} */
export const PROVIDERS = Object.freeze([
	{ id: 'claude-account', name: 'Claude 账号（订阅）', baseUrl: '', keyStyle: 'x-api-key', main: '', fast: '', keyUrl: '' },
	{ id: 'anthropic', name: 'Anthropic API key', baseUrl: 'https://api.anthropic.com', keyStyle: 'x-api-key', main: '', fast: '', keyUrl: 'https://platform.claude.com/settings/keys' },
	{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/anthropic', keyStyle: 'x-api-key', main: 'deepseek-v4-pro', fast: 'deepseek-flash', keyUrl: 'https://platform.deepseek.com/api_keys' },
	{ id: 'kimi', name: 'Kimi（月之暗面）', baseUrl: 'https://api.moonshot.cn/anthropic', keyStyle: 'bearer', main: 'kimi-k3', fast: 'kimi-k3', keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
	{ id: 'glm', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/anthropic', keyStyle: 'bearer', main: 'glm-5.1', fast: 'glm-4.5-air', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
	{ id: 'qwen', name: '通义千问（阿里云百炼）', baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic', keyStyle: 'bearer', main: 'qwen3.5-plus', fast: 'qwen3.5-plus', keyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key' },
	{ id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimaxi.com/anthropic', keyStyle: 'bearer', main: 'MiniMax-M3', fast: 'MiniMax-M3', keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key' },
	{ id: 'custom', name: '其他（兼容 Anthropic 接口）', baseUrl: '', keyStyle: 'bearer', main: '', fast: '', keyUrl: '' },
]);

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
		if (!provider) throw fail('没有这个模型来源');
		for (const key of ['baseUrl', 'apiKey', 'main', 'fast']) {
			if (change[key] !== undefined && typeof change[key] !== 'string') throw fail(`${key} 要是文字`);
		}
		if (change.baseUrl !== undefined && change.baseUrl.trim() && !ADDRESS.test(change.baseUrl.trim())) throw fail('接口地址要以 http:// 或 https:// 开头');
		const before = this.#choice(await this.#saved(), provider.id);
		if (provider.id !== 'claude-account' && !(change.baseUrl !== undefined ? change.baseUrl.trim() || provider.baseUrl : before.baseUrl)) throw fail('要填接口地址');
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
		if (!apiKey) throw fail(`还没有填 ${provider.name} 的 API key：在 AI 面板的 ⚙ 里填`, 409);
		const key = provider.keyStyle === 'bearer' ? { ANTHROPIC_AUTH_TOKEN: apiKey, ANTHROPIC_API_KEY: '' } : { ANTHROPIC_API_KEY: apiKey, ANTHROPIC_AUTH_TOKEN: '' };
		const models = main
			? { ANTHROPIC_MODEL: main, ANTHROPIC_DEFAULT_OPUS_MODEL: main, ANTHROPIC_DEFAULT_SONNET_MODEL: main, ANTHROPIC_DEFAULT_HAIKU_MODEL: fast, CLAUDE_CODE_SUBAGENT_MODEL: fast }
			: {};
		return { ANTHROPIC_BASE_URL: baseUrl, ...key, ...models, API_TIMEOUT_MS: '600000', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
	}

	/** The models Claude Code is told to use, by tier (null: its own, the Claude account's or Anthropic's). */
	async models() {
		const { provider, main, fast } = await this.chosen();
		return provider.id === 'claude-account' || !main ? null : { name: provider.name, main, fast };
	}

	/**
	 * Tries the service chosen with a request of one word, as Claude Code would ask it: whether the address, the key
	 * and the main model work, and what the service says when they do not.
	 */
	async check() {
		const { provider, baseUrl, apiKey, main } = await this.chosen();
		if (provider.id === 'claude-account') throw fail('Claude 账号不用检查：登录以后就能用');
		if (!apiKey) throw fail('还没有填 API key');
		const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', ...(provider.keyStyle === 'bearer' ? { authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey }) };
		const model = main || 'claude-haiku-5-5';
		let response;
		try {
			response = await this.fetch(`${baseUrl.replace(/\/+$/u, '')}/v1/messages`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: '说「好」' }] }),
				signal: AbortSignal.timeout(30_000),
			});
		} catch (error) {
			throw fail(`连不上 ${baseUrl}：${error instanceof Error ? error.message : String(error)}`, 502);
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
			throw fail(`${provider.name} 回答 ${response.status}：${said}`, 502);
		}
		let answered = '';
		try {
			answered = (JSON.parse(body).content ?? []).map((block) => block.text ?? '').join('').trim();
		} catch {
			// A body that is not the Messages API's: the service is something else.
			throw fail(`${baseUrl} 的回答不是 Anthropic 接口的格式`, 502);
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
