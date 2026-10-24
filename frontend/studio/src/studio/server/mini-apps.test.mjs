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
	assert.deepEqual({ ...byId.units }, { id: 'units', name: '单位换算', icon: '⚡', description: '', width: 200, height: 1600, permissions: ['insert'] });

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
