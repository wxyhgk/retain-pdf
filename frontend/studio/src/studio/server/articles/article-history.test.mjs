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

test('what is written is kept every ten minutes, however often it is saved, and a save keeps it as it was', async (t) => {
	const { root, history } = await blog(t);
	const at = (minutes) => new Date(Date.parse('2026-10-24T06:00:00.000Z') + minutes * 60_000);
	assert.ok((await history.keepWritten('note', 'v0', at(0))).name);
	assert.equal((await history.keepWritten('note', 'v1', at(4))).name, null);
	assert.equal((await history.keepWritten('note', 'v2', at(9.9))).name, null);
	assert.ok((await history.keepWritten('note', 'v3', at(10))).name);
	assert.deepEqual((await history.list('note')).map((entry) => [entry.reason, entry.size]), [['edit', 2], ['edit', 2]]);

	// Through a save: the text before it.
	const repository = new ArticleRepository(root);
	const before = await repository.read('note');
	await repository.save('note', { source: `${before.source}\n新写的。\n`, expectedRevision: before.revision }, { before: (current) => history.keepWritten('note', current, at(30)) });
	assert.equal(await history.read('note', (await history.list('note'))[0].name), before.source);
});

test('versions written are all kept for a day, then the last of each day for a month; the others, the newest fifty', async (t) => {
	const { history } = await blog(t);
	const now = Date.parse('2026-10-24T12:00:00.000Z');
	const hours = (count) => new Date(now - count * 60 * 60_000);
	// Three a day for 40 days back, and sixty kept before changes on disk long ago.
	for (let index = 0; index < 60; index += 1) await history.keep('note', `disk ${index}`, 'before-change', new Date(now - 90 * 24 * 60 * 60_000 + index * 1000));
	for (let day = 40; day >= 0; day -= 1) for (const hour of [20, 12, 4]) await history.keep('note', `day ${day} ${hour}`, 'edit', hours(day * 24 + hour));
	await history.keep('note', 'now', 'edit', new Date(now));
	const kept = await history.list('note');
	assert.equal(kept.filter((entry) => entry.reason === 'before-change').length, HISTORY_LIMIT);
	const written = kept.filter((entry) => entry.reason === 'edit');
	// The last day's all (now, and 4, 12, 20 hours ago), then one a day back to 30 days.
	assert.ok(written.every((entry) => now - entry.time < 31 * 24 * 60 * 60_000));
	const recent = written.filter((entry) => now - entry.time < 24 * 60 * 60_000);
	assert.equal(recent.length, 4);
	const days = written.filter((entry) => now - entry.time >= 24 * 60 * 60_000).map((entry) => new Date(entry.time).toDateString());
	assert.equal(new Set(days).size, days.length);
	assert.ok(days.length >= 28 && days.length <= 31, String(days.length));
});
