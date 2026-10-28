import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { ArticleRepository } from '../articles/article-repository.mjs';
import { articleBundlePaths } from '../../../articles/bundle-paths.mjs';
import { ArticleFileManager } from './file-manager.mjs';
import { FILE_HISTORY_LIMIT } from './file-history.mjs';

async function fixture(t) {
	const project = await mkdtemp(join(tmpdir(), 'studio-file-history-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	await new ArticleRepository(blogRoot).create({ slug: 'note', title: 'Note' });
	return { paths: articleBundlePaths(blogRoot, 'note'), files: new ArticleFileManager(blogRoot) };
}

const bytes = (text) => Readable.from([Buffer.from(text)]);

test('a file written over is kept first, in the article’s ai/history/files, and can be read back', async (t) => {
	const { paths, files } = await fixture(t);
	await files.upload('note', 'assets', 'opt.py', bytes('v1\n'));
	assert.deepEqual(await files.history.list('note', 'assets/opt.py'), []);
	await files.upload('note', 'assets', 'opt.py', bytes('v2\n'), { replace: true });
	const [kept, ...more] = await files.history.list('note', 'assets/opt.py');
	assert.equal(more.length, 0);
	assert.equal(kept.reason, 'replaced');
	assert.equal(await readFile(await files.history.version('note', kept.id, 'assets/opt.py'), 'utf8'), 'v1\n');
	assert.ok((await files.history.version('note', kept.id, 'assets/opt.py')).startsWith(join(paths.ai, 'history', 'files')));
	assert.equal(await readFile(join(paths.directory, 'assets/opt.py'), 'utf8'), 'v2\n');
});

test('the same text twice is one version; a new name is none; each file its own newest few', async (t) => {
	const { files } = await fixture(t);
	await files.upload('note', 'assets', 'a.csv', bytes('x\n'));
	await files.upload('note', 'assets', 'a.csv', bytes('y\n'), { replace: true });
	await files.upload('note', 'assets', 'a.csv', bytes('y\n'), { replace: true });
	await files.upload('note', 'assets', 'a.csv', bytes('y\n'), { replace: true });
	assert.equal((await files.history.list('note', 'assets/a.csv')).length, 2);
	await files.upload('note', 'assets', 'new.csv', bytes('z\n'), { replace: true });
	assert.deepEqual(await files.history.list('note', 'assets/new.csv'), []);
	for (let index = 0; index < FILE_HISTORY_LIMIT + 5; index += 1) await files.upload('note', 'assets', 'a.csv', bytes(`${index}\n`), { replace: true });
	const versions = await files.history.list('note', 'assets/a.csv');
	assert.equal(versions.length, FILE_HISTORY_LIMIT);
	assert.equal(await readFile(await files.history.version('note', versions[0].id, 'assets/a.csv'), 'utf8'), `${FILE_HISTORY_LIMIT + 3}\n`);
});

test('only files of img/ and assets/, by a path that stays in them, have versions', async (t) => {
	const { files } = await fixture(t);
	await assert.rejects(files.history.list('note', 'index.md'));
	await assert.rejects(files.history.list('note', 'assets/../index.md'));
	await assert.rejects(files.history.version('note', '../x', 'assets/a.py'));
});
