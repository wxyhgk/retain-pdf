import Anthropic from '@anthropic-ai/sdk';
import { t } from '@blog/i18n/index.mjs';

/** What the services read: the kinds of picture they take. */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const SYSTEM = [
	'You read pictures for a writing tool: formulas, text, tables, structures in an author’s notes.',
	'Answer with exactly what is asked for, in the form asked for, and nothing else:',
	'no greeting, no explanation, no Markdown code fence around the answer.',
	'If the picture holds nothing of the kind asked for, answer with an empty reply.',
].join(' ');

/** A failure the author can act on, said in the Studio's words. */
export class AiError extends Error {
	constructor(message, statusCode = 502) {
		super(message);
		this.name = 'AiError';
		this.statusCode = statusCode;
	}
}

/** The answer as written, without a code fence the model put around it anyway. */
export function answerText(text) {
	const trimmed = String(text ?? '').trim();
	const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/u);
	return (fenced ? fenced[1] : trimmed).trim();
}

/**
 * Asks the model set in 「设置 › AI › 识别图片」 about a picture.
 * @param {import('./ai-settings.mjs').AiConfig} config
 * @param {{ image: Buffer, mediaType: string, prompt: string }} question
 * @param {{ fetch?: typeof fetch, anthropic?: (options: object) => Anthropic }} [seams] for tests
 * @returns {Promise<string>}
 */
export async function askAboutImage(config, { image, mediaType, prompt }, seams = {}) {
	if (!IMAGE_TYPES.includes(mediaType)) throw new AiError(t('大模型只看 PNG、JPEG、GIF、WebP 图片'), 415);
	const data = image.toString('base64');
	const text = config.provider === 'openai' ? await askOpenAi(config, data, mediaType, prompt, seams.fetch ?? fetch) : await askClaude(config, data, mediaType, prompt, seams.anthropic);
	return answerText(text);
}

async function askClaude(config, data, mediaType, prompt, make = (options) => new Anthropic(options)) {
	// No key here: the SDK finds ANTHROPIC_API_KEY, or the profile of `ant auth login`.
	// A key of the whole organization says which workspace it is used in.
	const workspace = config.workspaceId || process.env.ANTHROPIC_WORKSPACE_ID;
	const client = make({
		...(config.apiKey ? { apiKey: config.apiKey } : {}),
		...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
		...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
		timeout: 120_000,
	});
	let response;
	try {
		response = await client.beta.messages.create({
			model: config.model,
			max_tokens: 16000,
			// Set, not left to the model's own: a formula read right matters more than a quick answer.
			output_config: { effort: 'medium' },
			// Declined by a safety check, it is asked again of a model the service picks.
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			system: SYSTEM,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image', source: { type: 'base64', media_type: mediaType, data } },
						{ type: 'text', text: prompt },
					],
				},
			],
		});
	} catch (error) {
		throw claudeError(error);
	}
	if (response.stop_reason === 'refusal') throw new AiError(t('大模型拒绝了这个请求'));
	return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
}

function claudeError(error) {
	if (error instanceof Anthropic.AuthenticationError) return new AiError(t('Anthropic 的 key 不对或没有给（在「设置 › AI › 识别图片」里填，或者设 ANTHROPIC_API_KEY）'), 401);
	if (error instanceof Anthropic.PermissionDeniedError) return new AiError(t('这个 key 没有用这个模型的权限'), 403);
	if (error instanceof Anthropic.NotFoundError) return new AiError(t('没有这个模型，看看「设置 › AI › 识别图片」里的模型名'), 404);
	if (error instanceof Anthropic.RateLimitError) return new AiError(t('请求太多了，过一会儿再试'), 429);
	if (error instanceof Anthropic.BadRequestError) {
		const said = error.error?.error?.message ?? error.message;
		if (/workspace/iu.test(said)) return new AiError(t('这个 key 属于整个组织，不属于某个工作区：在「设置 › AI › 识别图片」里填工作区 ID（wrkspc_…，Claude Console 的 Workspaces 页能看到），或者换一个在工作区里建的 key'), 400);
		return new AiError(t('请求被拒绝：{message}', { message: said }), 400);
	}
	if (error instanceof Anthropic.APIConnectionError) return new AiError(t('连不上 Anthropic 的服务（网络，或者「设置 › AI › 识别图片」里的接口地址）'));
	if (error instanceof Anthropic.APIError) return new AiError(t('Anthropic 的服务出错了（{status}）：{message}', { status: error.status ?? '?', message: error.message }));
	return error;
}

async function askOpenAi(config, data, mediaType, prompt, fetchImpl) {
	if (!config.baseUrl) throw new AiError(t('OpenAI 兼容接口要填接口地址（例如 https://dashscope.aliyuncs.com/compatible-mode/v1）'), 400);
	if (!config.model) throw new AiError(t('OpenAI 兼容接口要填模型名（例如 qwen-vl-max）'), 400);
	const key = config.apiKey || process.env.OPENAI_API_KEY;
	if (!key) throw new AiError(t('没有 key：在「设置 › AI › 识别图片」里填，或者设 OPENAI_API_KEY'), 401);
	let response;
	try {
		response = await fetchImpl(`${config.baseUrl.replace(/\/+$/u, '')}/chat/completions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model: config.model,
				messages: [
					{ role: 'system', content: SYSTEM },
					{
						role: 'user',
						content: [
							{ type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } },
							{ type: 'text', text: prompt },
						],
					},
				],
			}),
			signal: AbortSignal.timeout(120_000),
		});
	} catch (error) {
		throw new AiError(t('连不上 {baseUrl}：{error}', { baseUrl: config.baseUrl, error: error instanceof Error ? error.message : String(error) }));
	}
	const body = await response.text();
	if (!response.ok) {
		const said = (() => {
			try {
				return JSON.parse(body).error?.message;
			} catch {
				return null;
			}
		})();
		const status = response.status;
		const why = status === 401 || status === 403 ? t('key 不对或没有权限') : status === 404 ? t('接口地址或模型名不对') : status === 429 ? t('请求太多了，过一会儿再试') : t('服务出错了');
		throw new AiError(`${why}（${status}）${said ? `：${said}` : ''}`, status === 429 ? 429 : 502);
	}
	try {
		const content = JSON.parse(body).choices?.[0]?.message?.content;
		// Some services give the answer in parts.
		return Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : String(content ?? '');
	} catch {
		throw new AiError(t('服务的回答看不懂（不是 OpenAI 兼容的格式）'));
	}
}
