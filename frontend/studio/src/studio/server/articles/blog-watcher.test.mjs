import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BlogWatcher } from './blog-watcher.mjs';

/** A stand-in for fs.watch that reports whatever the test says changed. */
function fakeWatch() {
	const watcher = Object.assign(new EventEmitter(), { closed: false, close() { this.closed = true; } });
	let report = null;
	const watchImpl = (_root, options, callback) => {
		assert.deepEqual(options, { recursive: true });
		report = callback;
		return watcher;
	};
	return { watcher, watchImpl, change: (filename) => report('change', filename) };
}

/** Waits for a change to this file; macOS may first report making the test's own folders. */
const changeTo = (watcher, slug, path) => new Promise((resolve) => {
	const stop = watcher.subscribe((changes) => {
		if (!changes.some((entry) => entry.slug === slug && entry.paths.includes(path))) return;
		stop();
		resolve();
	});
});

test('changes come together, per article, without hidden and temporary files', async () => {
	const fake = fakeWatch();
	const watcher = new BlogWatcher('/blog', { delay: 10, watchImpl: fake.watchImpl });
	const changes = [];
	const stop = watcher.subscribe((batch) => changes.push(batch));
	for (const filename of ['note/index.md', 'note/index.md.8f2c.tmp', 'note/img/a.png', 'note/img/.upload-1', 'other', '.DS_Store', 'note/index.md']) {
		fake.change(filename);
	}
	await new Promise((resolve) => setTimeout(resolve, 40));
	assert.deepEqual(changes, [[{ slug: 'note', paths: ['img/a.png', 'index.md'] }, { slug: 'other', paths: [''] }]]);
	stop();
	assert.equal(fake.watcher.closed, true, 'nobody listening, nothing watched');
});

test('a real folder reports what was written in it', { timeout: 5000 }, async (t) => {
	const blog = await mkdtemp(join(tmpdir(), 'studio-watch-'));
	t.after(() => rm(blog, { recursive: true, force: true }));
	await mkdir(join(blog, 'note', 'assets'), { recursive: true });
	const watcher = new BlogWatcher(blog, { delay: 50 });
	t.after(() => watcher.close());
	const changed = changeTo(watcher, 'note', 'assets/water.xyz');
	await new Promise((resolve) => setTimeout(resolve, 100));
	await writeFile(join(blog, 'note', 'assets', 'water.xyz'), '3\n');
	await changed;
});
