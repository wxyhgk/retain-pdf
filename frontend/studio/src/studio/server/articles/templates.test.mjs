import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleTemplates, fillTemplate, parseTemplate } from './templates.mjs';

async function fixture(t) {
	const folder = await mkdtemp(join(tmpdir(), 'studio-templates-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	return { folder, templates: new ArticleTemplates(join(folder, 'templates')) };
}

const at = new Date(2026, 9, 29, 9, 5);

test('a template’s own lines and its body; what is filled in', () => {
	const parsed = parseTemplate("---\nname: 计算记录\ntitle: '{{date}} 计算记录'\n---\n\n## 体系\n");
	assert.deepEqual(parsed, { name: '计算记录', description: '', title: '{{date}} 计算记录', body: '\n## 体系\n' });
	assert.equal(fillTemplate('{{date}} {{time}} {{weekday}} {{year}}/{{month}}/{{day}} 《{{title}}》 {{other}}', { now: at, title: '甲' }), '2026-10-29 09:05 星期四 2026/10/29 《甲》 {{other}}');
	assert.equal(parseTemplate('只有正文').body, '只有正文');
});

test('templates listed by name; one rendered for a page made now; none there, an empty list', async (t) => {
	const { folder, templates } = await fixture(t);
	assert.deepEqual(await templates.list(), []);
	await mkdir(join(folder, 'templates'));
	await writeFile(join(folder, 'templates', 'journal.md'), "---\nname: 日志\ntitle: '{{date}}'\n---\n\n# {{title}}\n\n今天：\n");
	await writeFile(join(folder, 'templates', 'calc.md'), '---\nname: 计算记录\ndescription: 体系、方法\n---\n\n## 体系\n');
	await writeFile(join(folder, 'templates', 'Not An Id.md'), 'x');
	assert.deepEqual((await templates.list()).map((each) => each.id), ['calc', 'journal']);
	assert.deepEqual(await templates.render('journal', { now: at }), { id: 'journal', name: '日志', title: '2026-10-29', body: '\n# 2026-10-29\n\n今天：\n' });
	assert.equal((await templates.render('journal', { now: at, title: '自己起的' })).title, '自己起的');
	await assert.rejects(templates.render('none'), /没有模板/u);
	await assert.rejects(templates.render('../x'), /无效/u);
});

test('a page kept as a template: a new file each time, its pictures left out', async (t) => {
	const { folder, templates } = await fixture(t);
	assert.deepEqual(await templates.save('我的模板', '## 方法\n\n![图](./img/a.png)\n\n结果。\n'), { id: 'template', name: '我的模板' });
	assert.equal(await readFile(join(folder, 'templates', 'template.md'), 'utf8'), '---\nname: 我的模板\n---\n\n## 方法\n\n结果。\n');
	assert.equal((await templates.save('又一个', 'x')).id, 'template-1');
	await assert.rejects(templates.save('', 'x'));
});
