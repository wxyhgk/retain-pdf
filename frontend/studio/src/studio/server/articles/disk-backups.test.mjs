import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { atomicWriteText } from '../files/atomic-write.mjs';
import { ArticleHistory } from './article-history.mjs';
import { BlogWatcher } from './blog-watcher.mjs';
import { DiskBackups } from './disk-backups.mjs';

/** A stand-in for the blog's watcher: the test says what changed. */
function fakeWatcher() {
	const listeners = new Set();
	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		tell: (slug, path = 'index.md') => {
			for (const listener of listeners) listener([{ slug, paths: [path] }]);
		},
	};
}

async function blog(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-backups-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	for (const slug of ['shut', 'other']) {
		await mkdir(join(root, slug));
		await writeFile(join(root, slug, 'index.md'), `---\ntitle: ${slug}\n---\n\n作者写的原文。\n`);
	}
	const history = new ArticleHistory(root);
	const watcher = fakeWatcher();
	const backups = new DiskBackups(root, history, watcher);
	t.after(() => backups.stop());
	await backups.start();
	return { root, history, watcher, backups };
}

test('an article changed from outside keeps what it was, open or not; once, however often it is looked at', async (t) => {
	const { root, history, watcher, backups } = await blog(t);
	await writeFile(join(root, 'shut', 'index.md'), '---\ntitle: shut\n---\n\nAI 改过的。\n');
	watcher.tell('shut');
	await backups.check('shut');
	await backups.check('shut');
	const kept = await history.list('shut');
	assert.deepEqual(kept.map((entry) => entry.reason), ['before-change']);
	assert.match(await history.read('shut', kept[0].name), /作者写的原文/u);
	// Changed again: what the AI had written is kept too.
	await writeFile(join(root, 'shut', 'index.md'), '---\ntitle: shut\n---\n\nAI 又改了。\n');
	await backups.check('shut');
	assert.match(await history.read('shut', (await history.list('shut'))[0].name), /AI 改过的/u);
	assert.deepEqual(await history.list('other'), []);
});

test('what the Studio writes itself is not a change from outside', async (t) => {
	const { root, history, backups } = await blog(t);
	await atomicWriteText(join(root, 'shut', 'index.md'), '---\ntitle: shut\n---\n\n作者接着写。\n');
	await backups.check('shut');
	assert.deepEqual(await history.list('shut'), []);
	// An AI after it: what the author had saved is what is kept.
	await writeFile(join(root, 'shut', 'index.md'), '---\ntitle: shut\n---\n\nAI 改的。\n');
	await backups.check('shut');
	assert.match(await history.read('shut', (await history.list('shut'))[0].name), /作者接着写/u);
});

test('a new article, or one gone, keeps nothing', async (t) => {
	const { root, history, backups } = await blog(t);
	await mkdir(join(root, 'new'));
	await writeFile(join(root, 'new', 'index.md'), '新的\n');
	await backups.check('new');
	assert.deepEqual(await history.list('new'), []);
	await rm(join(root, 'other'), { recursive: true });
	await backups.check('other');
	await mkdir(join(root, 'other'));
	await writeFile(join(root, 'other', 'index.md'), '同名的新页\n');
	await backups.check('other');
	assert.deepEqual(await history.list('other'), []);
});

test('with the blog’s own watcher: a file an AI writes is noticed, and what was there kept', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'studio-backups-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, 'page'));
	await writeFile(join(root, 'page', 'index.md'), '原文\n');
	const history = new ArticleHistory(root);
	const watcher = new BlogWatcher(root, { delay: 20 });
	const backups = new DiskBackups(root, history, watcher);
	t.after(() => backups.stop());
	await backups.start();
	await writeFile(join(root, 'page', 'index.md'), 'AI 写的\n');
	for (let tries = 0; tries < 100 && !(await history.list('page')).length; tries += 1) await new Promise((resolve) => setTimeout(resolve, 20));
	const [kept] = await history.list('page');
	assert.equal(await history.read('page', kept.name), '原文\n');
});
