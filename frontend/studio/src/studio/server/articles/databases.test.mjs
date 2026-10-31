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
	const databases = new Databases({ articles, history });
	await databases.create({ slug: 'runs', title: '计算记录' });
	return { blogRoot, articles, history, databases };
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
	assert.deepEqual(await databases.rows('runs'), []);
	await databases.addRow('runs', { slug: 'run-1', title: 'TS1 优化', props: { 方法: 'B3LYP', 能量: -76.4, 空: '' } });
	await articles.create({ slug: 'other', title: '别的' });
	const [row] = await databases.rows('runs');
	assert.deepEqual({ slug: row.slug, title: row.title, props: row.props }, { slug: 'run-1', title: 'TS1 优化', props: { 方法: 'B3LYP', 能量: -76.4 } });

	await databases.setValue('run-1', '虚频', 'number', '1');
	await databases.setValue('run-1', '方法', 'select', '');
	await databases.setTitle('run-1', "TS1 优化（O'Neil）");
	const [after] = await databases.rows('runs');
	assert.deepEqual(after.props, { 能量: -76.4, 虚频: 1 });
	assert.equal(after.title, "TS1 优化（O'Neil）");
	const source = await readFile(join(blogRoot, 'run-1', 'index.md'), 'utf8');
	assert.match(source, /^props: \{ "能量": -76\.4, "虚频": 1 \}$/mu);
	assert.match(source, /^parent: runs$/mu);
	assert.ok((await history.list('run-1')).length >= 1);
});

test('a column renamed or taken away in every row, the other rows let be', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', { slug: 'a', title: 'A', props: { 方法: 'PBE0', 能量: -1 } });
	await databases.addRow('runs', { slug: 'b', title: 'B', props: { 能量: -2 } });
	await databases.addRow('runs', { slug: 'c', title: 'C' });
	const { changed } = await databases.changeColumns('runs', { renames: { 能量: 'E/Hartree' }, removed: ['方法'] });
	assert.deepEqual(changed.sort(), ['a', 'b']);
	const rows = Object.fromEntries((await databases.rows('runs')).map((row) => [row.slug, row.props]));
	assert.deepEqual(rows, { a: { 'E/Hartree': -1 }, b: { 'E/Hartree': -2 }, c: {} });
	await assert.rejects(databases.rows('none', null), /不存在/u);
});

test('a column of another kind: its values as that kind keeps them; a choice renamed or taken away in the rows', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', { slug: 'a', title: 'A', props: { 能量: '-1.5', 方法: 'PBE0', 标签: ['opt', 'ts'] } });
	await databases.addRow('runs', { slug: 'b', title: 'B', props: { 能量: '很低', 方法: 'B3LYP', 标签: ['ts'] } });
	await databases.changeColumns('runs', { types: { 能量: 'number' }, values: [{ column: '方法', from: 'PBE0', to: 'PBE0-D3' }, { column: '标签', from: 'ts', to: null }] });
	const rows = Object.fromEntries((await databases.rows('runs')).map((row) => [row.slug, row.props]));
	assert.deepEqual(rows, { a: { 能量: -1.5, 方法: 'PBE0-D3', 标签: ['opt'] }, b: { 方法: 'B3LYP' } });
	await databases.changeColumns('runs', { types: { 标签: 'select' } });
	assert.deepEqual((await databases.rows('runs')).find((row) => row.slug === 'a').props.标签, 'opt');
	await assert.rejects(databases.changeColumns('runs', { types: { 能量: 'formula' } }), /没有这种列/u);
});

test('two values of a row set at once: both kept (the writes to a page one after the other)', async (t) => {
	const { databases } = await fixture(t);
	await databases.addRow('runs', { slug: 'a', title: 'A' });
	await Promise.all([databases.setValue('a', '方法', 'select', 'PBE0'), databases.setValue('a', '能量', 'number', '-1'), databases.setTitle('a', 'A2')]);
	const [row] = await databases.rows('runs');
	assert.deepEqual(row.props, { 方法: 'PBE0', 能量: -1 });
	assert.equal(row.title, 'A2');
});

test('a database is a page of its own: its settings in its ```database block, read and changed there, the rest of its text as it was', async (t) => {
	const { blogRoot, articles, databases } = await fixture(t);
	assert.match(await readFile(join(blogRoot, 'runs', 'index.md'), 'utf8'), /^type: database$/mu);
	assert.deepEqual(await databases.info('runs'), { config: (await databases.config('runs')), title: '计算记录', icon: '' });
	await articles.create({ slug: 'plain', title: '普通页面' });
	assert.equal(await databases.info('plain'), null);
	assert.equal(await databases.info('none'), null);
	const { source, revision } = await articles.read('runs');
	await articles.save('runs', { source: source.replace(/```database[\s\S]*```/u, '前面。\n\n```database\n{ "columns": [{ "name": "方法", "type": "select", "options": ["B3LYP"] }], "view": "table" }\n```\n\n后面。'), expectedRevision: revision });
	assert.deepEqual((await databases.config('runs')).columns, [{ name: '方法', type: 'select', options: ['B3LYP'] }]);
	const { config } = await databases.addOption('runs', '方法', 'PBE0');
	assert.deepEqual(config.columns[0].options, ['B3LYP', 'PBE0']);
	assert.match(await readFile(join(blogRoot, 'runs', 'index.md'), 'utf8'), /前面。\n\n```database\n\{\n {2}"columns": \[[\s\S]*"PBE0"[\s\S]*\n```\n\n后面。\n$/u);
	await assert.rejects(databases.addOption('runs', '没有', 'x'), /没有这个选项列/u);
	// Changed where it is shown (another page): all of it as given, but what is not a setting.
	await databases.setConfig('runs', { ...config, view: 'board', group: '方法', id: 'stolen01' });
	assert.equal((await databases.config('runs')).view, 'board');
	assert.equal((await databases.config('runs')).id, null);
	await assert.rejects(databases.setConfig('plain', config), /不是数据库/u);
	await assert.rejects(databases.addRow('plain', { slug: 'x', title: 'x' }), /不是数据库/u);
});

test('a database shown in another page: moved under it, a row gets no link in it; its folder renamed, the blocks naming it follow', async (t) => {
	const { blogRoot, articles, databases } = await fixture(t);
	await articles.create({ slug: 'project', title: '项目', body: '```database\n{"source":"runs"}\n```' });
	await articles.create({ slug: 'loose', title: '散页' });
	await articles.setParent('loose', 'runs');
	assert.deepEqual((await databases.rows('runs')).map((row) => row.slug), ['loose']);
	assert.doesNotMatch(await readFile(join(blogRoot, 'runs', 'index.md'), 'utf8'), /loose/u);
	await articles.rename('runs', 'runs-2026');
	assert.match(await readFile(join(blogRoot, 'project', 'index.md'), 'utf8'), /^\{"source":"runs-2026"\}$/mu);
	assert.deepEqual((await databases.rows('runs-2026')).map((row) => row.slug), ['loose']);
});

test('blocks from before databases were pages made databases of their own: their rows under them, the block naming them; done once', async (t) => {
	const { blogRoot, articles, history, databases } = await fixture(t);
	const block = (settings) => '```database\n' + JSON.stringify(settings) + '\n```';
	await articles.create({ slug: 'book', title: '书', body: `前言。\n\n${block({ id: 'calcaaaa', title: '计算', columns: [{ name: '方法', type: 'text' }] })}\n\n${block({ columns: [{ name: '状态', type: 'select', options: ['读完'] }] })}\n\n${block({ source: 'runs' })}` });
	const row = async (slug, id) => {
		await articles.create({ slug, title: slug, parent: 'book' });
		if (!id) return;
		const { source, revision } = await articles.read(slug);
		await articles.save(slug, { source: source.replace(/^parent:/mu, `database: "${id}"\nparent:`), expectedRevision: revision });
	};
	await row('h2o', 'calcaaaa');
	await row('ch1', null);
	await row('gone', 'nothere1');
	const made = await databases.migrate();
	const [calc, chapters] = made.book;
	assert.equal(made.book.length, 2);
	assert.equal((await databases.info(calc)).title, '计算');
	assert.equal((await databases.config(calc)).id, 'calcaaaa');
	assert.deepEqual((await databases.config(chapters)).columns, [{ name: '状态', type: 'select', options: ['读完'] }]);
	// Its rows: those saying its id; the first one with none, those naming none; one naming another, left a page.
	assert.deepEqual((await databases.rows(calc)).map((each) => each.slug), ['h2o']);
	assert.deepEqual((await databases.rows(chapters)).map((each) => each.slug), ['ch1']);
	assert.equal((await articles.read('gone')).properties.parent, 'book');
	assert.doesNotMatch(await readFile(join(blogRoot, 'h2o', 'index.md'), 'utf8'), /^database:/mu);
	assert.ok((await history.list('h2o')).length >= 1);
	// The page: each block naming its database now, the rest as it was; kept as it was first.
	const page = await readFile(join(blogRoot, 'book', 'index.md'), 'utf8');
	assert.ok(page.includes(`前言。\n\n${block({ source: calc })}\n\n${block({ source: chapters })}\n\n${block({ source: 'runs' })}`));
	assert.ok((await history.list('book')).length >= 1);
	assert.deepEqual(await databases.migrate(), {});
	// One met again (its page as it was, a version brought back): the database made of it before, the rows not yet in it.
	await row('h2o-2', 'calcaaaa');
	assert.equal((await databases.detach('book', JSON.stringify({ id: 'calcaaaa', columns: [] }))).slug, calc);
	assert.deepEqual((await databases.rows(calc)).map((each) => each.slug).sort(), ['h2o', 'h2o-2']);
	// One met in the Studio with no id: its own, no rows taken.
	const fresh = (await databases.detach('book', JSON.stringify({ columns: [] }))).slug;
	assert.deepEqual(await databases.rows(fresh), []);
	await assert.rejects(databases.detach('book', JSON.stringify({ source: 'runs' })), /已经指向/u);
});

test('several values of a row at once: one write, one version kept, each as its column keeps it', async (t) => {
	const { blogRoot, history, databases } = await fixture(t);
	await databases.addRow('runs', { slug: 'a', title: 'A', props: { 备注: 'x' } });
	const kept = await databases.setValues('a', [{ column: '能量', type: 'number', value: '-76.41' }, { column: '收敛', type: 'checkbox', value: 'true' }, { column: '备注', type: 'text', value: '' }]);
	assert.deepEqual(kept.values, [-76.41, true, null]);
	assert.match(await readFile(join(blogRoot, 'a', 'index.md'), 'utf8'), /^props: \{ "能量": -76\.41, "收敛": true \}$/mu);
	assert.equal((await history.list('a')).length, 1);
	await assert.rejects(databases.setValues('a', [{ column: '能量', type: 'formula', value: 1 }]), /没有这种列/u);
});
