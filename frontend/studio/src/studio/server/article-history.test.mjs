import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ArticleHistory, HISTORY_LIMIT } from './article-history.mjs';
import { ArticleRepository } from './article-repository.mjs';

async function blog(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-history-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await new ArticleRepository(root).create({ slug: 'note', title: 'Note' });
	return { root, history: new ArticleHistory(root) };
}

test('versions are kept in ai/history, newest first, and read back', async (t) => {
	const { root, history } = await blog(t);
	assert.deepEqual(await history.list('note'), []);
	const first = await history.keep('note', 'one', 'before-change', new Date('2026-10-17T06:00:00.000Z'));
	const second = await history.keep('note', 'two', 'unsaved', new Date('2026-10-17T06:00:01.500Z'));
	assert.equal(first.name, '2026-10-17T06-00-00-000-before-change.md');
	assert.deepEqual(await readdir(join(root, 'note', 'ai', 'history')), [first.name, second.name]);
	const listed = await history.list('note');
	assert.deepEqual(listed.map((entry) => [entry.name, entry.reason, entry.size]), [[second.name, 'unsaved', 3], [first.name, 'before-change', 3]]);
	assert.equal(listed[0].time, Date.parse('2026-10-17T06:00:01.500Z'));
	assert.equal(await history.read('note', first.name), 'one');
});

test('the same text twice in a row is kept once; two in one millisecond both are', async (t) => {
	const { history } = await blog(t);
	const at = new Date('2026-10-17T06:00:00.000Z');
	await history.keep('note', 'same', 'before-change', at);
	assert.deepEqual(await history.keep('note', 'same', 'unsaved', at), { name: null });
	await history.keep('note', 'other', 'unsaved', at);
	assert.deepEqual((await history.list('note')).map((entry) => entry.name), ['2026-10-17T06-00-00-001-unsaved.md', '2026-10-17T06-00-00-000-before-change.md']);
});

test('only the newest versions are kept', async (t) => {
	const { history } = await blog(t);
	for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) {
		await history.keep('note', `v${index}`, 'before-change', new Date(Date.UTC(2026, 9, 17, 0, 0, index)));
	}
	const listed = await history.list('note');
	assert.equal(listed.length, HISTORY_LIMIT);
	assert.equal(await history.read('note', listed.at(-1).name), 'v3');
});

test('names, reasons and articles are checked', async (t) => {
	const { history } = await blog(t);
	await assert.rejects(history.keep('note', 'x', 'whatever'), /原因无效/u);
	await assert.rejects(history.read('note', '../index.md'), /名字无效/u);
	await assert.rejects(history.read('note', '2026-10-17T06-00-00-000-unsaved.md'), /找不到/u);
	await assert.rejects(history.list('missing'), { name: 'ArticleNotFoundError' });
});
