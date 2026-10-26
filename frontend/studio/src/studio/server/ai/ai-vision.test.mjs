import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import { AiSettings } from './ai-settings.mjs';
import { answerText, askAboutImage } from './ai-vision.mjs';

const image = Buffer.from('fake png');
const question = { image, mediaType: 'image/png', prompt: '读出公式' };

test('Claude is asked with the picture and the prompt, a fallback on refusal, the key given or left to the SDK', async () => {
	const made = [];
	const anthropic = (options) => {
		const client = {
			beta: {
				messages: {
					create: async (request) => {
						made.push({ options, request });
						return { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '```latex\nE = mc^2\n```' }] };
					},
				},
			},
		};
		return client;
	};
	const text = await askAboutImage({ provider: 'anthropic', model: 'claude-opus-5-5', baseUrl: '', apiKey: '' }, question, { anthropic });
	assert.equal(text, 'E = mc^2');
	const [{ options, request }] = made;
	assert.equal(options.apiKey, undefined);
	assert.equal(request.model, 'claude-opus-5-5');
	assert.deepEqual(request.betas, ['server-side-fallback-2026-07-01']);
	assert.equal(request.fallbacks, 'default');
	assert.deepEqual(request.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.toString('base64') } });
	assert.deepEqual(request.messages[0].content[1], { type: 'text', text: '读出公式' });

	await askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: 'https://proxy.example/', apiKey: 'sk-1' }, question, { anthropic });
	assert.equal(made[1].options.apiKey, 'sk-1');
	assert.equal(made[1].options.baseURL, 'https://proxy.example/');
	assert.equal(made[1].options.defaultHeaders, undefined);

	// A key of the whole organization: asked in the workspace set.
	await askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: '', apiKey: 'sk-org', workspaceId: 'wrkspc_01x' }, question, { anthropic });
	assert.deepEqual(made[2].options.defaultHeaders, { 'anthropic-workspace-id': 'wrkspc_01x' });
});

test('Claude refusing, or its errors, are said in the Studio’s words', async () => {
	const refusing = () => ({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } });
	await assert.rejects(askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: '', apiKey: '' }, question, { anthropic: refusing }), /拒绝/u);
	const failing = () => ({
		beta: {
			messages: {
				create: async () => {
					throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
				},
			},
		},
	});
	await assert.rejects(askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: '', apiKey: '' }, question, { anthropic: failing }), (error) => error.statusCode === 401 && /key/u.test(error.message));
	const unscoped = () => ({
		beta: {
			messages: {
				create: async () => {
					const message = 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use.';
					throw new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message } }, message, new Headers());
				},
			},
		},
	});
	await assert.rejects(askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: '', apiKey: '' }, question, { anthropic: unscoped }), /工作区 ID/u);
});

test('an OpenAI-compatible service is asked at its address, with the picture as a data URL', async () => {
	const asked = [];
	const fetch = async (url, init) => {
		asked.push({ url, init, body: JSON.parse(init.body) });
		return new Response(JSON.stringify({ choices: [{ message: { content: 'H_2O' } }] }), { status: 200 });
	};
	const config = { provider: 'openai', model: 'qwen-vl-max', baseUrl: 'https://dashscope.example/v1/', apiKey: 'k' };
	assert.equal(await askAboutImage(config, question, { fetch }), 'H_2O');
	assert.equal(asked[0].url, 'https://dashscope.example/v1/chat/completions');
	assert.equal(asked[0].init.headers.authorization, 'Bearer k');
	assert.equal(asked[0].body.model, 'qwen-vl-max');
	assert.equal(asked[0].body.messages[1].content[0].image_url.url, `data:image/png;base64,${image.toString('base64')}`);

	const failing = async () => new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 });
	await assert.rejects(askAboutImage(config, question, { fetch: failing }), /模型名不对.*model not found/u);
	await assert.rejects(askAboutImage({ ...config, baseUrl: '' }, question, { fetch }), /接口地址/u);
});

test('a picture the services don’t read (SVG) is turned away before asking', async () => {
	await assert.rejects(askAboutImage({ provider: 'anthropic', model: 'm', baseUrl: '', apiKey: '' }, { ...question, mediaType: 'image/svg+xml' }), (error) => error.statusCode === 415);
});

test('answers lose a fence put around them anyway', () => {
	assert.equal(answerText('  x^2 \n'), 'x^2');
	assert.equal(answerText('```\n| a |\n|---|\n```'), '| a |\n|---|');
	assert.equal(answerText('a ```b``` c'), 'a ```b``` c');
});

test('AI settings: the page sees no key, only that there is one; a saved key keeps the file private', async () => {
	const file = join(mkdtempSync(join(tmpdir(), 'ai-settings-')), '.studio-settings.json');
	const settings = new AiSettings(file, { env: {} });
	assert.deepEqual(await settings.config(), { provider: 'anthropic', model: 'claude-opus-5-5', baseUrl: '', apiKey: '', workspaceId: '' });
	assert.equal((await settings.shown()).hasKey, false);
	assert.equal((await new AiSettings(file, { env: { ANTHROPIC_API_KEY: 'x' } }).shown()).hasKey, true);

	const shown = await settings.set({ provider: 'openai', model: 'qwen-vl-max', baseUrl: 'https://dashscope.example/v1', apiKey: 'secret' });
	assert.equal(shown.hasKey, true);
	assert.equal('apiKey' in shown, false);
	assert.equal(JSON.parse(readFileSync(file, 'utf8')).ai.apiKey, 'secret');
	assert.equal(statSync(file).mode & 0o777, 0o600);
	// Left out, the key stays; empty, it goes.
	await settings.set({ model: 'qwen-vl-plus' });
	assert.equal((await settings.config()).apiKey, 'secret');
	await settings.set({ apiKey: '' });
	assert.equal((await settings.config()).apiKey, '');
	await assert.rejects(settings.set({ provider: 'gemini' }), /provider/u);
	await assert.rejects(settings.set({ baseUrl: 'ftp://x' }), /http/u);
	assert.equal((await settings.set({ provider: 'anthropic', workspaceId: ' wrkspc_01x ' })).workspaceId, 'wrkspc_01x');
	await assert.rejects(settings.set({ workspaceId: 'wrkspc 01' }), /空格/u);
});
