import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AGENT_PRESETS, AgentSettings } from './agent-settings.mjs';

async function folder(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-agents-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
}

test('Claude, Codex and pi to start with; installed as a login shell finds them', async (t) => {
	const root = await folder(t);
	await writeFile(join(root, 'codex'), '#!/bin/sh\n');
	await chmod(join(root, 'codex'), 0o755);
	const settings = new AgentSettings(join(root, 'settings.json'), { env: { PATH: `${root}:/usr/bin:/bin`, HOME: root }, shell: '/bin/sh' });
	const shown = await settings.shown();
	assert.deepEqual(shown.agents.map((agent) => agent.id), ['claude', 'codex', 'pi']);
	assert.deepEqual(shown.agents.filter((agent) => agent.installed).map((agent) => agent.id), ['codex']);
	assert.equal(shown.default, 'claude');
});

test('the words an agent runs by: what it is told is one of them, as it is', () => {
	const [claude, codex] = AGENT_PRESETS;
	const prompt = '画一个 sin x 的图; rm -rf "$HOME"';
	const words = AgentSettings.words(claude, prompt, false);
	assert.equal(words[0], 'claude');
	assert.equal(words.at(-1), prompt);
	assert.ok(words.includes('{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false}}'));
	assert.ok(!words.includes('--continue'));
	assert.ok(AgentSettings.words(claude, prompt, true).includes('--continue'));
	assert.deepEqual(AgentSettings.words(codex, prompt, true).slice(0, 4), ['codex', 'exec', 'resume', '--last']);
});

test('another agent added (omp) and made the default; a half-written one refused', async (t) => {
	const root = await folder(t);
	const file = join(root, 'settings.json');
	await writeFile(file, JSON.stringify({ ai: { provider: 'anthropic' } }));
	const settings = new AgentSettings(file, { env: { PATH: '/usr/bin:/bin' }, shell: '/bin/sh' });
	const omp = { id: 'omp', name: 'omp', launch: 'omp', run: 'omp -p {prompt}', resume: 'omp -p --continue {prompt}' };
	const shown = await settings.set({ list: [...AGENT_PRESETS, omp], default: 'omp' });
	assert.equal(shown.default, 'omp');
	assert.deepEqual(shown.agents.map((agent) => agent.id), ['claude', 'codex', 'pi', 'omp']);
	// The other settings stay.
	assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).ai, { provider: 'anthropic' });
	await assert.rejects(settings.set({ list: [{ ...omp, run: 'omp -p' }], default: 'omp' }), /\{prompt\}/u);
	await assert.rejects(settings.set({ list: [omp, omp], default: 'omp' }), /重复/u);
	await assert.rejects(settings.set({ list: [omp], default: 'claude' }), /默认/u);
});
