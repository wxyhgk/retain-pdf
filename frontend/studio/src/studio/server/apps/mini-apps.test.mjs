import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { MiniApps, appDocument } from './mini-apps.mjs';

test('小程序: listed from their app.json, a broken one saying what is wrong; what they ask for kept to what there is', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-apps-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, 'units'));
	await writeFile(join(root, 'units', 'app.json'), JSON.stringify({ name: '单位换算', icon: '⚡', width: 50, height: 9000, permissions: ['insert', 'everything'] }));
	await writeFile(join(root, 'units', 'app.html'), '<p>hi</p>');
	await writeFile(join(root, 'units', 'data.json'), '{"a":1}');
	await mkdir(join(root, 'broken'));
	await writeFile(join(root, 'broken', 'app.json'), '{');
	await mkdir(join(root, 'Not An Id'));
	const apps = new MiniApps(root);
	const listed = await apps.list();
	assert.deepEqual(listed.map((app) => app.id).sort(), ['broken', 'units']);
	const byId = Object.fromEntries(listed.map((app) => [app.id, app]));
	assert.match(byId.broken.problem, /app\.json 读不了/u);
	assert.deepEqual({ ...byId.units }, { id: 'units', name: '单位换算', icon: '⚡', description: '', width: 200, height: 1600, permissions: ['insert'], kind: 'page' });

	// Its page with `studio` first; its other files as they are; nothing outside its folder.
	const page = await apps.file('units', '');
	assert.equal(page.type, 'text/html; charset=utf-8');
	assert.match(String(page.body), /^<!doctype html><html><head><meta charset="utf-8">.*window\.studio = studio.*<\/head><body><p>hi<\/p><\/body><\/html>$/su);
	assert.equal(String((await apps.file('units', 'data.json')).body), '{"a":1}');
	assert.equal(await apps.file('units', '../broken/app.json'), null);
	assert.equal(await apps.file('../etc', 'passwd'), null);
	assert.equal(await apps.get('nothing'), null);
	assert.match(appDocument('<html><head><title>x</title></head></html>'), /^<html><head><meta charset="utf-8">/u);
});

test('a project app: how it is run from its app.json, where it is from app.local.json; a path of this machine committed is said, not run', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-apps-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const app = async (id, manifest, local) => {
		await mkdir(join(root, id));
		await writeFile(join(root, id, 'app.json'), JSON.stringify(manifest));
		if (local) await writeFile(join(root, id, 'app.local.json'), JSON.stringify(local));
	};
	await app('here', { name: '在这里', dev: { command: ['npm', 'run', 'dev', '--', '--port', '{port}'], backend: ['npm', 'run', 'backend'] } });
	await app('elsewhere', { name: '在别处', dev: { command: ['npm', 'run', 'dev'] } }, { dev: { cwd: '/somewhere/structura' } });
	await app('committed-path', { name: '路径', dev: { cwd: '/Users/me/x', command: ['npm', 'run', 'dev'] } });
	await app('no-command', { name: '没命令', dev: { command: 'npm run dev' } });
	await app('page', { name: '网页' });
	const apps = new MiniApps(root);
	const listed = Object.fromEntries((await apps.list()).map((entry) => [entry.id, entry]));
	assert.equal(listed.here.kind, 'project');
	assert.equal(listed.page.kind, 'page');
	assert.deepEqual(await apps.dev('here'), { cwd: join(root, 'here'), command: ['npm', 'run', 'dev', '--', '--port', '{port}'], backend: ['npm', 'run', 'backend'] });
	assert.deepEqual(await apps.dev('elsewhere'), { cwd: '/somewhere/structura', command: ['npm', 'run', 'dev'], backend: null });
	assert.match(listed['committed-path'].problem, /app\.local\.json/u);
	assert.equal(await apps.dev('committed-path'), null);
	assert.match(listed['no-command'].problem, /dev\.command/u);
	assert.equal(await apps.dev('page'), null);
	// A project's own page keeps its style: the bridge and the notes' colors only, and what goes wrong is told.
	const page = appDocument('<html><head><link rel="stylesheet" href="x.css"></head></html>', { project: true });
	assert.match(page, /window\.studio = studio/u);
	assert.match(page, /type: 'error'/u);
	assert.doesNotMatch(page, /font: 14px/u);
});
