import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RetainmolHost } from './retainmol-host.mjs';

async function fixture(t) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-retainmol-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const checkout = join(folder, 'RetainMol');
	await mkdir(join(checkout, 'apps', 'retainmol'), { recursive: true });
	await writeFile(join(checkout, 'apps', 'retainmol', 'package.json'), '{}');
	const project = join(folder, 'blog-repo');
	await mkdir(project);
	return { folder, checkout, project, settingsFile: join(project, '.studio-settings.json') };
}

/** A process as spawn gives it, which exits when told to. */
function fakeChild() {
	const child = new EventEmitter();
	child.pid = undefined;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = () => child.emit('exit', 0);
	return child;
}

test('RetainMol is found where the settings say, or beside the repository; a folder without it is refused, saying where', async (t) => {
	const { checkout, project, settingsFile, folder } = await fixture(t);
	const host = new RetainmolHost({ projectRoot: project, settingsFile });
	assert.equal(await host.root(), checkout);
	await writeFile(settingsFile, JSON.stringify({ retainmolRoot: folder }));
	await assert.rejects(host.root(), (error) => error.statusCode === 503 && error.message.includes(`${folder} 里没有 apps/retainmol`));
	await writeFile(settingsFile, JSON.stringify({ retainmolRoot: checkout }));
	assert.equal(await host.root(), checkout);
});

test('started with its own dev server, once, and its address given when it answers; one running already is used', async (t) => {
	const { project, settingsFile, checkout } = await fixture(t);
	const spawned = [];
	let answering = false;
	const host = new RetainmolHost({
		projectRoot: project,
		settingsFile,
		port: 5399,
		spawnImpl: (command, args, options) => {
			spawned.push({ command, args, cwd: options.cwd });
			setTimeout(() => (answering = true), 50);
			return fakeChild();
		},
		fetchImpl: async () => {
			if (!answering) throw new Error('refused');
			return new Response('<title>retainmol</title>');
		},
	});
	const [first, second] = await Promise.all([host.start(), host.start()]);
	assert.equal(first, 'http://127.0.0.1:5399');
	assert.equal(second, first);
	assert.deepEqual(spawned, [{ command: 'npm', args: ['run', 'dev', '--workspace', 'retainmol', '--', '--host', '127.0.0.1', '--port', '5399', '--strictPort'], cwd: checkout }]);
	assert.equal(await host.start(), first);
	assert.equal(spawned.length, 1);
});

test('a dev server that exits before answering is said, with what it printed; a fixed address is used without starting anything', async (t) => {
	const { project, settingsFile } = await fixture(t);
	const host = new RetainmolHost({
		projectRoot: project,
		settingsFile,
		spawnImpl: () => {
			const child = fakeChild();
			setTimeout(() => {
				child.stderr.emit('data', 'Error: Port 5310 is already in use\n');
				child.emit('exit', 1);
			}, 20);
			return child;
		},
		fetchImpl: async () => {
			throw new Error('refused');
		},
	});
	await assert.rejects(host.start(), /RetainMol 没能启动：Error: Port 5310 is already in use/u);

	const fixed = new RetainmolHost({ projectRoot: project, settingsFile, fixedUrl: 'http://127.0.0.1:4999', spawnImpl: () => assert.fail('nothing started') });
	assert.equal(await fixed.start(), 'http://127.0.0.1:4999');
});
