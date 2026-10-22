import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** The model asked when none is set, for each kind of service. */
export const DEFAULT_MODELS = { anthropic: 'claude-opus-5-5', openai: '' };
const PROVIDERS = Object.keys(DEFAULT_MODELS);

/**
 * @typedef {object} AiConfig
 * @property {'anthropic' | 'openai'} provider Claude's own API, or any service that speaks OpenAI's (通义千问、DeepSeek、智谱、OpenRouter…)
 * @property {string} model
 * @property {string} baseUrl the service's address; empty for Anthropic's own
 * @property {string} apiKey empty: for Anthropic, the key in the environment (ANTHROPIC_API_KEY, or `ant auth login`); for the others, OPENAI_API_KEY
 * @property {string} workspaceId Anthropic only: the workspace (wrkspc_…) asked in, for a key of the whole organization;
 *   empty: ANTHROPIC_WORKSPACE_ID, or none (a key of one workspace needs none)
 */

/**
 * Which large model the Studio asks (识别图片 and what comes after it): `ai` in the Studio's settings,
 * kept out of git with the rest of them. The key stays on this machine, in that file or the
 * environment; the page is told only whether there is one.
 */
export class AiSettings {
	/** @param {string} settingsFile the Studio's settings (.studio-settings.json) */
	constructor(settingsFile, { env = process.env } = {}) {
		this.settingsFile = settingsFile;
		this.env = env;
	}

	async #read() {
		try {
			return JSON.parse(await readFile(this.settingsFile, 'utf8'));
		} catch {
			return {};
		}
	}

	/** @returns {Promise<AiConfig>} */
	async config() {
		const saved = (await this.#read()).ai ?? {};
		const provider = PROVIDERS.includes(saved.provider) ? saved.provider : 'anthropic';
		const text = (value) => (typeof value === 'string' ? value.trim() : '');
		return { provider, model: text(saved.model) || DEFAULT_MODELS[provider], baseUrl: text(saved.baseUrl), apiKey: text(saved.apiKey), workspaceId: text(saved.workspaceId) };
	}

	/** What the page may see: the settings without the key, and whether a key is there (saved or in the environment). */
	async shown() {
		const { apiKey, ...config } = await this.config();
		const fromEnvironment = config.provider === 'anthropic' ? this.env.ANTHROPIC_API_KEY || this.env.ANTHROPIC_AUTH_TOKEN : this.env.OPENAI_API_KEY;
		return { ...config, hasKey: Boolean(apiKey || fromEnvironment), keySaved: Boolean(apiKey), defaults: DEFAULT_MODELS };
	}

	/**
	 * Changes what is given; `apiKey: ''` forgets the saved key, and leaving it out keeps it.
	 * @param {Partial<AiConfig>} change
	 */
	async set(change) {
		const fail = (message) => Object.assign(new Error(message), { statusCode: 400 });
		if (!change || typeof change !== 'object') throw fail('要给出设置');
		if (change.provider !== undefined && !PROVIDERS.includes(change.provider)) throw fail(`provider 只能是 ${PROVIDERS.join(' 或 ')}`);
		for (const key of ['model', 'baseUrl', 'apiKey', 'workspaceId']) {
			if (change[key] !== undefined && typeof change[key] !== 'string') throw fail(`${key} 要是文字`);
		}
		if (change.baseUrl && !/^https?:\/\/\S+$/u.test(change.baseUrl.trim())) throw fail('接口地址要以 http:// 或 https:// 开头');
		if (change.workspaceId && /\s/u.test(change.workspaceId.trim())) throw fail('工作区 ID 里不能有空格（像 wrkspc_01AbC… 这样）');
		const settings = await this.#read();
		const ai = { ...settings.ai };
		for (const key of ['provider', 'model', 'baseUrl', 'apiKey', 'workspaceId']) {
			if (change[key] === undefined) continue;
			const value = change[key].trim();
			if (value) ai[key] = value;
			else delete ai[key];
		}
		await mkdir(dirname(this.settingsFile), { recursive: true });
		await writeFile(this.settingsFile, `${JSON.stringify({ ...settings, ai }, null, '\t')}\n`);
		// A key in it: for the author's eyes only.
		if (ai.apiKey) await chmod(this.settingsFile, 0o600);
		return this.shown();
	}
}
