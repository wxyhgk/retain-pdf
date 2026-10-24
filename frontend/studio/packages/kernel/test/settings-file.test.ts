import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readSettings, updateSettings } from '../settings-file.mjs';

async function file(t: { after(fn: () => unknown): void }) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-settings-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	return join(folder, '.studio-settings.json');
}

test('changes made at once each keep the others’, and the file is the author’s alone', async (t) => {
	const path = await file(t);
	await writeFile(path, JSON.stringify({ ai: { apiKey: 'k' } }));
	await chmod(path, 0o644);
	await Promise.all([
		updateSettings(path, (settings) => ({ ...settings, driveRoot: '/d' })),
		updateSettings(path, (settings) => ({ ...settings, computeHosts: [] })),
		updateSettings(path, (settings) => {
			settings.plugins = { disabled: ['x'] };
		}),
	]);
	assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { ai: { apiKey: 'k' }, driveRoot: '/d', computeHosts: [], plugins: { disabled: ['x'] } });
	assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test('a file that cannot be read is not written over; read, it is nothing', async (t) => {
	const path = await file(t);
	await writeFile(path, '{"ai": {"apiKey": "k"');
	await assert.rejects(updateSettings(path, (settings) => ({ ...settings, driveRoot: '/d' })), /不是有效的 JSON/u);
	assert.equal(await readFile(path, 'utf8'), '{"ai": {"apiKey": "k"');
	assert.deepEqual(await readSettings(path), {});
	// Missing: the first change makes it.
	await rm(path);
	await updateSettings(path, () => ({ agents: {} }));
	assert.deepEqual(await readSettings(path, { strict: true }), { agents: {} });
});
