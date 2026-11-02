import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleHistory } from './article-history.mjs';
import { ArticleRepository } from './article-repository.mjs';
import { FindReplace, findMatches, replaceMatches } from './find-replace.mjs';

const text = (source, matches) => matches.map(({ from, to }) => source.slice(from, to));

test('found in the text, not in the properties, code, formulas or where links lead (unless asked to)', () => {
	const source = [
		'---',
		'title: B3LYP 计算',
		'---',
		'',
		'用 B3LYP 算，`B3LYP` 写在输入里，$E_{B3LYP}$ 和',
		'',
		'$$',
		'E_{\\mathrm{B3LYP}}',
		'$$',
		'',
		'```text',
		'# B3LYP/def2-SVP opt',
		'```',
		'',
		'见 [b3lyp 的说明](./assets/b3lyp.txt)，B3lyp 也算。',
	].join('\n');
	assert.deepEqual(text(source, findMatches(source, 'B3LYP')), ['B3LYP', 'b3lyp', 'B3lyp']);
	assert.deepEqual(text(source, findMatches(source, 'B3LYP', { caseSensitive: true })), ['B3LYP']);
	// Asked to look in code and formulas too: there as well, never in the properties.
	assert.equal(findMatches(source, 'B3LYP', { skipCode: false }).length, 8);
	assert.deepEqual(findMatches(source, ''), []);
	// Special characters are words, not a pattern.
	assert.deepEqual(text('a.b axb', findMatches('a.b axb', 'a.b')), ['a.b']);
});

test('only the places chosen are put the new words in', () => {
	const source = '甲 乙 甲 丙 甲';
	const matches = findMatches(source, '甲');
	assert.equal(replaceMatches(source, matches, '丁'), '丁 乙 丁 丙 丁');
	assert.equal(replaceMatches(source, matches, '丁丁', [0, 2]), '丁丁 乙 甲 丙 丁丁');
});

test('all the articles: previewed with the words round each place; the chosen changed, a version kept first; one changed since, left', async (t) => {
	const project = await mkdtemp(join(tmpdir(), 'studio-find-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	const articles = new ArticleRepository(blogRoot);
	const history = new ArticleHistory(blogRoot);
	await articles.create({ slug: 'one', title: '一', body: '用 B3LYP-D3 算了结构。\n\n再用 B3LYP-D3 算频率。\n' });
	await articles.create({ slug: 'two', title: '二', body: 'B3LYP-D3 的能量。\n' });
	await articles.create({ slug: 'three', title: '三', body: '没有。\n' });
	const finder = new FindReplace({ articles, history, blogRoot });
	const found = await finder.preview('B3LYP-D3');
	assert.deepEqual(found.map((each) => [each.slug, each.matches.length]).sort(), [['one', 2], ['two', 1]]);
	const one = found.find((each) => each.slug === 'one');
	const { line, ...shown } = one.matches[1];
	assert.deepEqual(shown, { before: '再用 ', text: 'B3LYP-D3', after: ' 算频率。' });
	// Its line in the file (the properties at the top counted): the next but one after the first's.
	assert.equal(line, one.matches[0].line + 2);
	const two = found.find((each) => each.slug === 'two');

	// two changed after it was looked in: left alone.
	const twoFile = join(blogRoot, 'two', 'index.md');
	await writeFile(twoFile, (await readFile(twoFile, 'utf8')).replace('能量', '自由能'));
	const done = await finder.apply('B3LYP-D3', 'B3LYP-D3(BJ)', { one: { revision: one.revision, indexes: [1] }, two: { revision: two.revision, indexes: [0] } });
	assert.deepEqual(done.changed, [{ slug: 'one', count: 1 }]);
	assert.deepEqual(done.skipped.map((each) => each.slug), ['two']);
	const oneText = await readFile(join(blogRoot, 'one', 'index.md'), 'utf8');
	assert.match(oneText, /用 B3LYP-D3 算了结构。\n\n再用 B3LYP-D3\(BJ\) 算频率。/u);
	const [kept] = await history.list('one');
	assert.equal(kept.reason, 'before-change');
	assert.match(await history.read('one', kept.name), /再用 B3LYP-D3 算频率/u);
	assert.match(await readFile(twoFile, 'utf8'), /B3LYP-D3 的自由能/u);
	await assert.rejects(finder.preview('  '));
});
