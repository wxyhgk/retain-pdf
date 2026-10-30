import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleHistory } from './article-history.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { coerceValue, Databases } from './databases.mjs';

async function fixture(t) {
	const project = await mkdtemp(join(tmpdir(), 'studio-databases-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	const articles = new ArticleRepository(blogRoot);
	const history = new ArticleHistory(blogRoot);
	await articles.create({ slug: 'runs', title: '计算记录' });
	return { blogRoot, articles, history, databases: new Databases({ articles, history }) };
}

test('values kept as their column’s kind keeps them', () => {
	assert.equal(coerceValue('number', '-76.40'), -76.4);
	assert.equal(coerceValue('number', '1,234.5'), 1234.5);
	assert.equal(coerceValue('number', 'abc'), null);
	assert.equal(coerceValue('checkbox', 'true'), true);
	assert.deepEqual(coerceValue('multi', 'DFT，opt, DFT'), ['DFT', 'opt']);
	assert.equal(coerceValue('date', '2026-10-29'), '2026-10-29');
	assert.equal(coerceValue('date', '昨天'), null);
	assert.equal(coerceValue('text', ''), null);
});

test('a database’s rows are the pages under it, with their values; a row made, a value set, a title set', async (t) => {
	const { blogRoot, articles, history, databases } = await fixture(t);
	assert.deepEqual(await databases.rows('runs', null), []);
	await databases.addRow('runs', null, { slug: 'run-1', title: 'TS1 优化', props: { 方法: 'B3LYP', 能量: -76.4, 空: '' } });
	await articles.create({ slug: 'other', title: '别的' });
	const [row] = await databases.rows('runs', null);
	assert.deepEqual({ slug: row.slug, title: row.title, props: row.props }, { slug: 'run-1', title: 'TS1 优化', props: { 方法: 'B3LYP', 能量: -76.4 } });

	await databases.setValue('run-1', '虚频', 'number', '1');
	await databases.setValue('run-1', '方法', 'select', '');
	await databases.setTitle('run-1', "TS1 优化（O'Neil）");
	const [after] = await databases.rows('runs', null);
	assert.deepEqual(after.props, { 能量: -76.4, 虚频: 1 });
	assert.equal(after.title, "TS1 优化（O'Neil）");
	const source = await readFile(join(blogRoot, 'run-1', 'index.md'), 'utf8');
	assert.match(source, /^props: \{ "能量": -76\.4, "虚频": 1 \}$/mu);
	assert.match(source, /^parent: runs$/mu);
	assert.ok((await history.list('run-1')).length >= 1);
});

test('a column renamed or taken away in every row, the other rows let be', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', null, { slug: 'a', title: 'A', props: { 方法: 'PBE0', 能量: -1 } });
	await databases.addRow('runs', null, { slug: 'b', title: 'B', props: { 能量: -2 } });
	await databases.addRow('runs', null, { slug: 'c', title: 'C' });
	const { changed } = await databases.changeColumns('runs', null, { renames: { 能量: 'E/Hartree' }, removed: ['方法'] });
	assert.deepEqual(changed.sort(), ['a', 'b']);
	const rows = Object.fromEntries((await databases.rows('runs', null)).map((row) => [row.slug, row.props]));
	assert.deepEqual(rows, { a: { 'E/Hartree': -1 }, b: { 'E/Hartree': -2 }, c: {} });
	await assert.rejects(databases.rows('none', null), /不存在/u);
});

test('a column of another kind: its values as that kind keeps them; a choice renamed or taken away in the rows', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', null, { slug: 'a', title: 'A', props: { 能量: '-1.5', 方法: 'PBE0', 标签: ['opt', 'ts'] } });
	await databases.addRow('runs', null, { slug: 'b', title: 'B', props: { 能量: '很低', 方法: 'B3LYP', 标签: ['ts'] } });
	await databases.changeColumns('runs', null, { types: { 能量: 'number' }, values: [{ column: '方法', from: 'PBE0', to: 'PBE0-D3' }, { column: '标签', from: 'ts', to: null }] });
	const rows = Object.fromEntries((await databases.rows('runs', null)).map((row) => [row.slug, row.props]));
	assert.deepEqual(rows, { a: { 能量: -1.5, 方法: 'PBE0-D3', 标签: ['opt'] }, b: { 方法: 'B3LYP' } });
	await databases.changeColumns('runs', null, { types: { 标签: 'select' } });
	assert.deepEqual((await databases.rows('runs', null)).find((row) => row.slug === 'a').props.标签, 'opt');
	await assert.rejects(databases.changeColumns('runs', null, { types: { 能量: 'formula' } }), /没有这种列/u);
});

test('two values of a row set at once: both kept (the writes to a page one after the other)', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', null, { slug: 'a', title: 'A' });
	await Promise.all([databases.setValue('a', '方法', 'select', 'PBE0'), databases.setValue('a', '能量', 'number', '-1'), databases.setTitle('a', 'A2')]);
	const [row] = await databases.rows('runs', null);
	assert.deepEqual(row.props, { 方法: 'PBE0', 能量: -1 });
	assert.equal(row.title, 'A2');
});

test('a page’s database settings read from its ```database block; a choice added there, the rest of the page as it was', async (t) => {
	const { blogRoot, articles, databases } = await fixture(t);
	assert.equal(await databases.config('runs', null), null);
	const { source, revision } = await articles.read('runs');
	await articles.save('runs', { source: `${source}\n前面。\n\n\`\`\`database\n{ "columns": [{ "name": "方法", "type": "select", "options": ["B3LYP"] }], "view": "table" }\n\`\`\`\n\n后面。\n`, expectedRevision: revision });
	assert.deepEqual((await databases.config('runs', null)).columns, [{ name: '方法', type: 'select', options: ['B3LYP'] }]);
	const { config } = await databases.addOption('runs', null, '方法', 'PBE0');
	assert.deepEqual(config.columns[0].options, ['B3LYP', 'PBE0']);
	const after = await readFile(join(blogRoot, 'runs', 'index.md'), 'utf8');
	assert.match(after, /前面。\n\n```database\n\{\n {2}"columns": \[[\s\S]*"PBE0"[\s\S]*\n```\n\n后面。\n$/u);
	await assert.rejects(databases.addOption('runs', null, '没有', 'x'), /没有这个选项列/u);
});

test('several databases in a page, each its rows (the pages saying its id); the page’s other pages not rows of any', async (t) => {
	const { blogRoot, articles, databases } = await fixture(t);
	const { source, revision } = await articles.read('runs');
	const block = (id, title) => '```database\n' + JSON.stringify({ id, title, columns: [{ name: '方法', type: 'text' }] }) + '\n```\n';
	await articles.save('runs', { source: `${source}\n${block('calcaaaa', '计算')}\n${block('readbbbb', '文献')}`, expectedRevision: revision });
	await databases.addRow('runs', 'calcaaaa', { slug: 'h2o', title: 'H2O', props: { 方法: 'B3LYP' } });
	await databases.addRow('runs', 'readbbbb', { slug: 'paper', title: '论文' });
	await articles.create({ slug: 'notes', title: '普通子页面', parent: 'runs' });
	assert.deepEqual((await databases.rows('runs', 'calcaaaa')).map((row) => row.slug), ['h2o']);
	assert.deepEqual((await databases.rows('runs', 'readbbbb')).map((row) => row.slug), ['paper']);
	assert.match(await readFile(join(blogRoot, 'h2o', 'index.md'), 'utf8'), /^database: "calcaaaa"$/mu);
	assert.equal((await databases.config('runs', 'readbbbb')).title, '文献');
	// Listed with it: which database a row is of, and the databases a page holds.
	const listed = Object.fromEntries((await articles.list()).map((article) => [article.slug, article]));
	assert.equal(listed.h2o.database, 'calcaaaa');
	assert.deepEqual(listed.runs.databases, [{ id: 'calcaaaa', title: '计算' }, { id: 'readbbbb', title: '文献' }]);
	assert.equal(listed.notes.database, undefined);
	// A row moved under another page: a page there, no longer a row.
	await articles.setParent('h2o', 'notes');
	assert.doesNotMatch(await readFile(join(blogRoot, 'h2o', 'index.md'), 'utf8'), /database:/u);
	assert.deepEqual(await databases.rows('runs', 'calcaaaa'), []);
});

test('a database from before ids given one: the pages that were its rows say it now', async (t) => {
	const { blogRoot, articles, databases } = await fixture(t);
	await databases.addRow('runs', null, { slug: 'a', title: 'A' });
	await databases.addRow('runs', null, { slug: 'b', title: 'B' });
	await databases.addRow('runs', 'otherxxx', { slug: 'c', title: 'C' });
	assert.deepEqual((await databases.adopt('runs', 'calcaaaa')).adopted.sort(), ['a', 'b']);
	assert.deepEqual((await databases.rows('runs', 'calcaaaa')).map((row) => row.slug), ['a', 'b']);
	assert.match(await readFile(join(blogRoot, 'c', 'index.md'), 'utf8'), /^database: "otherxxx"$/mu);
	await assert.rejects(databases.adopt('runs', '../x'), /id 无效/u);
});
