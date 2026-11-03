import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AgentSettings } from './agent-settings.mjs';

async function folder(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-agents-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
}

test('pi first and the default; Claude Code and Codex in the panel only once on, or when conversations were had with them', async (t) => {
	const file = join(await folder(t), 'settings.json');
	const settings = new AgentSettings(file, { env: {} });
	const fresh = await settings.config();
	assert.deepEqual(fresh.list.map((agent) => agent.id), ['pi', 'claude', 'codex']);
	assert.deepEqual(fresh.listed.map((agent) => agent.id), ['pi']);
	assert.equal(fresh.default, 'pi');
	// Nothing said yet: those the author has talked to are on.
	assert.deepEqual((await settings.config(async () => ['pi', 'codex', 'codex'])).listed.map((agent) => agent.id), ['pi', 'codex']);
	// Said: as said, whatever was talked to.
	const shown = await settings.set({ on: ['claude'] });
	assert.deepEqual(shown.agents.map(({ id, on }) => [id, on]), [['claude', true], ['codex', false]]);
	assert.deepEqual((await settings.config(() => ['codex'])).listed.map((agent) => agent.id), ['pi', 'claude']);
	assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).agents, { on: ['claude'] });
	await assert.rejects(settings.set({ on: ['pi'] }), /只能/u);
});

test('saved before (the terminal’s and Alt+Enter’s command lines): an AI added with an adapter kept, the rest let be', async (t) => {
	const file = join(await folder(t), 'settings.json');
	await writeFile(file, JSON.stringify({ agents: { default: 'claude', list: [
		{ id: 'claude', name: 'Claude', launch: 'claude', run: 'claude -p {prompt}', resume: 'claude -p --continue {prompt}' },
		{ id: 'omp', name: 'omp', launch: 'omp', run: 'omp -p {prompt}', resume: 'omp -p -c {prompt}', acp: 'omp-acp --stdio' },
		{ id: 'old', name: 'old', launch: 'old', run: 'old {prompt}', resume: 'old {prompt}' },
	] } }));
	const known = await new AgentSettings(file, { env: {} }).config();
	assert.deepEqual(known.listed.map((agent) => [agent.id, agent.acp]), [['pi', 'pi-acp'], ['omp', 'omp-acp --stdio']]);
	// The old default was Alt+Enter's: pi's now.
	assert.equal(known.default, 'pi');
});

test('the browser tests: the stand-in adapters by their path, Claude on and talked to first', async (t) => {
	const file = join(await folder(t), 'settings.json');
	const known = await new AgentSettings(file, { env: { STUDIO_TERMINAL_AGENT_DIR: '/fakes', STUDIO_AGENTS_ON: 'claude,codex' } }).config();
	assert.equal(known.default, 'claude');
	assert.deepEqual(known.listed.map((agent) => agent.acp), ['/fakes/pi-acp', '/fakes/claude-agent-acp', '/fakes/codex-acp']);
});
