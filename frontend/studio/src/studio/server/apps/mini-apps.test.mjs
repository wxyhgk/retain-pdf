import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readFile } from 'node:fs/promises';
import { MiniApps, STUDIO_CALLS, appDocument } from './mini-apps.mjs';

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
	assert.deepEqual({ ...byId.units }, { id: 'units', name: '单位换算', icon: '⚡', description: '', width: 200, height: 1600, permissions: ['insert'], kind: 'page', blocks: [], commands: [] });

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

test('the Studio’s own apps are listed with the author’s; the author’s one of the same name is the one; new ones are the author’s', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-apps-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const own = join(root, 'notes', 'apps');
	const builtIn = join(root, 'code', 'apps');
	for (const [folder, id, name] of [[builtIn, 'units', '内置换算'], [builtIn, 'library', '代码库'], [own, 'units', '我的换算']]) {
		await mkdir(join(folder, id), { recursive: true });
		await writeFile(join(folder, id, 'app.json'), JSON.stringify({ name }));
		await writeFile(join(folder, id, 'app.html'), `<p>${name}</p>`);
	}
	const apps = new MiniApps(own, { builtIn });
	assert.deepEqual((await apps.list()).map((app) => [app.id, app.name]), [['library', '代码库'], ['units', '我的换算']]);
	assert.match(String((await apps.file('library', '')).body), /<p>代码库<\/p>/u);
	assert.match(String((await apps.file('units', '')).body), /<p>我的换算<\/p>/u);
	assert.equal(await apps.root('library'), join(builtIn, 'library'));
	// Made in the author's apps/, under a name no app has.
	const made = await apps.create({ name: 'library', template: Object.keys((await import('./mini-apps.mjs')).APP_TEMPLATES)[0] });
	assert.equal(made.id, 'library-2');
	assert.equal(await apps.root('library-2'), join(own, 'library-2'));
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

test('a new app from a template: a folder of its own, its name put in; a project one runs on the repository’s Vite', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-apps-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const apps = new MiniApps(join(root, 'apps'));
	const page = await apps.create({ name: 'Energy Units', template: 'page' });
	assert.equal(page.id, 'energy-units');
	assert.equal(page.kind, 'page');
	assert.equal(page.name, 'Energy Units');
	assert.match(await readFile(join(root, 'apps', 'energy-units', 'app.html'), 'utf8'), /小程序「Energy Units」/u);
	const again = await apps.create({ name: 'Energy Units', template: 'page' });
	assert.equal(again.id, 'energy-units-2');
	const project = await apps.create({ name: '结构式<编辑器>', template: 'react' });
	assert.match(project.id, /^app-[0-9a-z]+$/u);
	assert.equal(project.name, '结构式编辑器');
	assert.equal(project.kind, 'project');
	assert.deepEqual((await apps.dev(project.id)).command.slice(0, 2), ['node', '../../node_modules/vite/bin/vite.js']);
	assert.match(await readFile(join(root, 'apps', project.id, 'src', 'App.tsx'), 'utf8'), /<h1 [^>]*>结构式编辑器<\/h1>/u);
	await assert.rejects(apps.create({ name: '', template: 'page' }), /起个名字/u);
	await assert.rejects(apps.create({ name: 'x', template: 'vue' }), /没有这个模板/u);
});

test('what `studio` asks is the list the skill and the React template’s types say', async () => {
	const here = (path) => new URL(path, import.meta.url);
	const bridge = await readFile(here('./mini-apps.mjs'), 'utf8');
	const asked = [...bridge.matchAll(/call\('([\w.]+)'/gu)].map((match) => match[1]).sort();
	assert.deepEqual(asked, [...STUDIO_CALLS].sort());
	const skill = await readFile(here('../../../../.agents/skills/studio-mini-apps/SKILL.md'), 'utf8');
	const types = await readFile(here('./templates/react/src/studio.d.ts'), 'utf8');
	for (const name of STUDIO_CALLS) {
		assert.ok(skill.includes(`studio.${name}(`), `the skill has studio.${name}`);
		const [first, second] = name.split('.');
		// A call of a group (files.read): in that group's lines of the type.
		const group = second ? types.slice(types.indexOf(`\t${first}: {`), types.indexOf('\n\t};', types.indexOf(`\t${first}: {`))) : types;
		assert.match(group, new RegExp(`\\b${second ?? first}[<(]`, 'u'), `studio.d.ts has studio.${name}`);
	}
});
