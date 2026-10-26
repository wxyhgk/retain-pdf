import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { PanelModels, PiModels } from './panel-models.mjs';

async function settings(t, options) {
	const folder = await mkdtemp(join(tmpdir(), 'panel-models-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const file = join(folder, '.studio-settings.json');
	return { file, models: new PanelModels(file, options) };
}

test('the Claude account first: Claude Code as it is, its own login', async (t) => {
	const { models } = await settings(t);
	assert.equal((await models.shown()).chosen, 'claude-account');
	assert.deepEqual(await models.env(), {});
	assert.equal(await models.models(), null);
});

test('a service chosen: its key kept here and never shown, Claude Code given its address, key and models', async (t) => {
	const { file, models } = await settings(t);
	const shown = await models.set({ provider: 'deepseek', apiKey: ' sk-deep ' });
	assert.equal(shown.chosen, 'deepseek');
	const deepseek = shown.providers.find((entry) => entry.id === 'deepseek');
	assert.equal(deepseek.hasKey, true);
	assert.equal(JSON.stringify(shown).includes('sk-deep'), false);
	assert.deepEqual(await models.env(), {
		ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
		ANTHROPIC_API_KEY: 'sk-deep',
		ANTHROPIC_AUTH_TOKEN: '',
		ANTHROPIC_MODEL: 'deepseek-v4-pro',
		ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro',
		ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-pro',
		ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-flash',
		CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-flash',
		API_TIMEOUT_MS: '600000',
		CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
	});
	assert.deepEqual(await models.models(), { name: 'DeepSeek', main: 'deepseek-v4-pro', fast: 'deepseek-flash' });

	// Another, with its own models; the first keeps its key for when it is chosen again.
	await models.set({ provider: 'glm', apiKey: 'glm-key', main: 'glm-x', fast: '' });
	const glm = await models.env();
	assert.equal(glm.ANTHROPIC_AUTH_TOKEN, 'glm-key');
	assert.equal(glm.ANTHROPIC_API_KEY, '');
	assert.equal(glm.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'glm-x');
	await models.set({ provider: 'deepseek' });
	assert.equal((await models.env()).ANTHROPIC_API_KEY, 'sk-deep');
	// An empty key forgets it.
	await models.set({ provider: 'deepseek', apiKey: '' });
	await assert.rejects(models.env(), /还没有填 DeepSeek 的 API key/u);
	assert.match(await readFile(file, 'utf8'), /glm-key/u);
});

test('another address must be one; a service tried with a word says what it answered, or why not', async (t) => {
	const asked = [];
	const answers = [
		{ ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: '好' }] }) },
		{ ok: false, status: 401, text: async () => JSON.stringify({ error: { message: 'invalid api key' } }) },
	];
	const { models } = await settings(t, { fetch: async (url, init) => (asked.push({ url, init }), answers.shift()) });
	await assert.rejects(models.set({ provider: 'custom', apiKey: 'k' }), /要填接口地址/u);
	await assert.rejects(models.set({ provider: 'custom', baseUrl: 'ftp://x' }), /http/u);
	await models.set({ provider: 'custom', baseUrl: 'https://llm.example.com/anthropic/', apiKey: 'k', main: 'm1' });
	assert.deepEqual(await models.check(), { ok: true, model: 'm1', answered: '好' });
	assert.equal(asked[0].url, 'https://llm.example.com/anthropic/v1/messages');
	assert.equal(asked[0].init.headers.authorization, 'Bearer k');
	assert.equal(JSON.parse(asked[0].init.body).model, 'm1');
	await assert.rejects(models.check(), /回答 401：invalid api key/u);
});

test('pi: its own setting first; a service of its catalog given by the key pi reads, kept apart from Claude Code’s', async (t) => {
	const { file, models } = await settings(t);
	const pi = new PiModels(file, '/project/node_modules/.bin');
	assert.equal((await pi.shown()).chosen, 'pi-own');
	assert.deepEqual(await pi.env(), { PI_ACP_PI_COMMAND: '/project/node_modules/.bin/pi', PI_OFFLINE: '1' });
	assert.equal(await pi.service(), null);
	await assert.rejects(pi.check(), /pi 自己的设置/u);

	const shown = await pi.set({ provider: 'moonshotai-cn', apiKey: 'sk-kimi' });
	assert.equal(shown.providers.find((entry) => entry.id === 'moonshotai-cn').hasKey, true);
	assert.equal(JSON.stringify(shown).includes('sk-kimi'), false);
	assert.deepEqual(await pi.env(), { PI_ACP_PI_COMMAND: '/project/node_modules/.bin/pi', PI_OFFLINE: '1', MOONSHOT_API_KEY: 'sk-kimi' });
	assert.deepEqual(await pi.service(), { name: 'Kimi（月之暗面，国内）', provider: 'moonshotai-cn' });
	await pi.set({ provider: 'deepseek' });
	await assert.rejects(pi.env(), /还没有填 pi 用的 DeepSeek 的 API key/u);
	// Claude Code's choice is its own.
	await models.set({ provider: 'deepseek', apiKey: 'sk-claude' });
	assert.equal((await pi.shown()).chosen, 'deepseek');
	assert.equal((await models.env()).ANTHROPIC_API_KEY, 'sk-claude');
});
