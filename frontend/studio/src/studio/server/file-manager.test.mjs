import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths } from './bundle-paths.mjs';
import {
	ArticleFileManager,
	FileConflictError,
	FileLockedError,
	FileNotFoundError,
	UploadTooLargeError,
	assertName,
	managedSegments,
	safeFolderName,
	safeUploadName,
} from './file-manager.mjs';

async function fixture(t, options) {
	const project = await mkdtemp(join(tmpdir(), 'studio-manager-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	await new ArticleRepository(blogRoot).create({ slug: 'note', title: 'Note' });
	return { project, paths: articleBundlePaths(blogRoot, 'note'), files: new ArticleFileManager(blogRoot, options) };
}

const bytes = (text) => Readable.from([Buffer.from(text)]);
const paths = (entries) => entries.map((entry) => `${entry.path}${entry.kind === 'directory' ? '/' : ''}${entry.locked ? ' 🔒' : ''}`);

test('lists the article folder, locking its own files and resource folders', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	await mkdir(join(bundle.assets, 'frames'));
	await writeFile(join(bundle.assets, 'frames', 'b.xyz'), '1');
	await writeFile(join(bundle.assets, 'a.cube'), '12');
	await writeFile(join(bundle.assets, 'frames-2.xyz'), '1');
	await writeFile(join(bundle.img, '.DS_Store'), '');
	await symlink('/etc/hosts', join(bundle.img, 'hosts'));

	const entries = await files.list('note');
	assert.deepEqual(paths(entries), [
		'ai/ 🔒',
		'article.views.json 🔒',
		'assets/ 🔒',
		'assets/a.cube',
		'assets/frames/',
		'assets/frames/b.xyz',
		'assets/frames-2.xyz',
		'img/ 🔒',
		'index.md 🔒',
	]);
	assert.equal(entries.find((entry) => entry.path === 'assets/a.cube').size, 2);
	assert.equal(typeof entries[0].modified, 'number');
});

test('only img/, assets/ and ai/ contents can change', () => {
	assert.deepEqual(managedSegments('img/a/b.png'), ['img', 'a', 'b.png']);
	assert.throws(() => managedSegments('index.md'), FileLockedError);
	assert.throws(() => managedSegments('img'), FileLockedError);
	assert.deepEqual(managedSegments('img', { allowFolderRoot: true }), ['img']);
	for (const path of ['other/a.png', '../img/a.png', 'img/../index.md', 'img//a', 'img/./a', '/img/a', 'img\\a', '']) {
		assert.throws(() => managedSegments(path), path);
	}
});

test('names stay simple enough for Markdown links', () => {
	assert.equal(assertName('水分子-HOMO_1.cube'), '水分子-HOMO_1.cube');
	for (const name of ['', '.', '..', '.hidden', 'a b.png', 'a#b', 'a(1).png', 'a[1]', 'x'.repeat(256)]) {
		assert.throws(() => assertName(name), name);
	}
	assert.equal(safeUploadName('Screen Shot 2026-10-14 at 10.00.00.PNG'), 'Screen-Shot-2026-10-14-at-10.00.00.png');
	assert.equal(safeUploadName('C:\\Users\\me\\图 (1).png'), '图-1.png');
	assert.equal(safeUploadName('.bashrc'), 'bashrc');
	assert.equal(safeUploadName('???.png'), 'file.png');
	assert.ok(Buffer.byteLength(safeUploadName(`${'长'.repeat(200)}.png`)) <= 255);
});

test('uploads never overwrite unasked', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	assert.deepEqual(await files.upload('note', 'img', 'Cover Photo.png', bytes('one')), { path: 'img/Cover-Photo.png', size: 3 });
	assert.deepEqual(await files.upload('note', 'img', 'Cover Photo.png', bytes('two')), { path: 'img/Cover-Photo-1.png', size: 3 });
	assert.equal(await readFile(join(bundle.img, 'Cover-Photo.png'), 'utf8'), 'one');
	assert.deepEqual(await files.upload('note', 'img', 'Cover-Photo.png', bytes('three'), { replace: true }), { path: 'img/Cover-Photo.png', size: 5 });
	assert.equal(await readFile(join(bundle.img, 'Cover-Photo.png'), 'utf8'), 'three');
	assert.deepEqual((await readdir(bundle.img)).sort(), ['Cover-Photo-1.png', 'Cover-Photo.png']);
});

test('an upload over the limit leaves nothing behind', async (t) => {
	const { paths: bundle, files } = await fixture(t, { uploadSizeLimit: 4 });
	await assert.rejects(files.upload('note', 'assets', 'big.cube', bytes('12345')), UploadTooLargeError);
	assert.deepEqual(await readdir(bundle.assets), []);
});

test('uploads go only into existing managed folders', async (t) => {
	const { files } = await fixture(t);
	await assert.rejects(files.upload('note', 'img/missing', 'a.png', bytes('x')), FileNotFoundError);
	await assert.rejects(files.upload('note', 'index.md', 'a.png', bytes('x')), FileLockedError);
	await assert.rejects(files.upload('missing', 'img', 'a.png', bytes('x')), FileNotFoundError);
});

test('folders are made with their parents, but not over a file', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	assert.deepEqual(await files.createFolder('note', 'assets/runs/2026'), { path: 'assets/runs/2026' });
	assert.deepEqual(await readdir(join(bundle.assets, 'runs')), ['2026']);
	await files.createFolder('note', 'assets/runs');
	await writeFile(join(bundle.assets, 'taken'), '');
	await assert.rejects(files.createFolder('note', 'assets/taken'), FileConflictError);
	await assert.rejects(files.createFolder('note', 'assets/a b'), /空格/u);
});

test('moving renames within and across folders, never onto an existing name', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	await writeFile(join(bundle.img, 'a.png'), 'a');
	await writeFile(join(bundle.img, 'b.png'), 'b');
	await mkdir(join(bundle.assets, 'my dir'));

	assert.deepEqual(await files.move('note', 'img/a.png', 'img/first.png'), { path: 'img/first.png' });
	await assert.rejects(files.move('note', 'img/first.png', 'img/b.png'), FileConflictError);
	assert.deepEqual(await files.move('note', 'img/first.png', 'assets/my dir/first.png'), { path: 'assets/my dir/first.png' });
	assert.equal(await readFile(join(bundle.assets, 'my dir', 'first.png'), 'utf8'), 'a');
	await assert.rejects(files.move('note', 'img/missing.png', 'img/c.png'), FileNotFoundError);
	await assert.rejects(files.move('note', 'img/b.png', 'img/no/c.png'), FileNotFoundError);
	await assert.rejects(files.move('note', 'assets/my dir', 'assets/my dir/inner'), /自己里面/u);
	await assert.rejects(files.move('note', 'img', 'assets/img'), FileLockedError);
	await assert.rejects(files.move('note', 'img/b.png', 'index.md'), FileLockedError);
});

test('removing moves the file to the trash', async (t) => {
	const { project, paths: bundle, files } = await fixture(t);
	await mkdir(join(bundle.assets, 'runs'));
	await writeFile(join(bundle.assets, 'runs', 'out.log'), 'log');

	const result = await files.trash('note', 'assets/runs/out.log');
	assert.equal(result.path, 'assets/runs/out.log');
	assert.ok(result.trashedTo.startsWith(join(project, '.studio-trash')));
	assert.match(result.trashedTo, /-note\/assets\/runs\/out\.log$/u);
	assert.equal(await readFile(result.trashedTo, 'utf8'), 'log');
	assert.deepEqual(await readdir(join(bundle.assets, 'runs')), []);
	await assert.rejects(files.trash('note', 'index.md'), FileLockedError);
	await assert.rejects(files.trash('note', 'assets'), FileLockedError);
});

test('symbolic links are never followed', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	const outside = await mkdtemp(join(tmpdir(), 'studio-manager-outside-'));
	t.after(() => rm(outside, { recursive: true, force: true }));
	await writeFile(join(outside, 'secret'), 'secret');
	await symlink(outside, join(bundle.assets, 'linked'));

	await assert.rejects(files.upload('note', 'assets/linked', 'a.txt', bytes('x')), /符号链接/u);
	await assert.rejects(files.move('note', 'assets/linked/secret', 'assets/secret'), /符号链接/u);
	await assert.rejects(files.trash('note', 'assets/linked/secret'), /符号链接/u);
	await assert.rejects(files.createFolder('note', 'assets/linked/new'), /符号链接/u);
	assert.deepEqual(await readdir(outside), ['secret']);
});

test('a resource folder git did not keep is listed, and made on first use', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	await rm(bundle.img, { recursive: true });
	await rm(bundle.ai, { recursive: true });
	assert.deepEqual(paths(await files.list('note')).filter((path) => path.endsWith('🔒') && path.includes('/')), ['ai/ 🔒', 'assets/ 🔒', 'img/ 🔒']);
	assert.deepEqual(await files.upload('note', 'img', 'a.png', bytes('a')), { path: 'img/a.png', size: 1 });
	assert.deepEqual(await files.createFolder('note', 'ai/runs'), { path: 'ai/runs' });
	assert.deepEqual(await readdir(bundle.ai), ['runs']);
});

test('locating finds any of the article’s files, never outside it', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	assert.equal(await files.locate('note', ''), bundle.directory);
	assert.equal(await files.locate('note', 'index.md'), bundle.markdown);
	assert.equal(await files.locate('note', 'img/'), bundle.img);
	await assert.rejects(files.locate('note', 'img/missing.png'), FileNotFoundError);
	for (const path of ['../other', 'img/../../x', '/etc/passwd', '.git', 'img\\a']) {
		await assert.rejects(files.locate('note', path), path);
	}
	await symlink('/etc', join(bundle.assets, 'etc'));
	await assert.rejects(files.locate('note', 'assets/etc/hosts'), /符号链接/u);
});

test('a dropped folder arrives with its folders, made safe', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	assert.equal(safeFolderName('My Data (1)'), 'My-Data-1');
	assert.equal(safeFolderName('..'), 'folder');
	assert.equal(safeFolderName('.git'), 'git');
	assert.deepEqual(
		await files.upload('note', 'assets', 'out 1.log', bytes('a'), { subfolders: ['My Data', 'run 1'] }),
		{ path: 'assets/My-Data/run-1/out-1.log', size: 1 },
	);
	assert.deepEqual(
		await files.upload('note', 'assets', 'out 2.log', bytes('b'), { subfolders: ['My Data', 'run 1'] }),
		{ path: 'assets/My-Data/run-1/out-2.log', size: 1 },
	);
	assert.deepEqual(await readdir(join(bundle.assets, 'My-Data', 'run-1')), ['out-1.log', 'out-2.log']);
	await writeFile(join(bundle.assets, 'taken'), '');
	await assert.rejects(files.upload('note', 'assets', 'a.log', bytes('c'), { subfolders: ['taken'] }), FileConflictError);
	// Folder names cannot climb out: `..` is made into a name like any other.
	assert.deepEqual(
		await files.upload('note', 'assets', 'a.log', bytes('c'), { subfolders: ['..', '..', 'escape'] }),
		{ path: 'assets/folder/folder/escape/a.log', size: 1 },
	);
});

test('what was removed can be put back, but never over what has taken its place', async (t) => {
	const { paths: bundle, files } = await fixture(t);
	await mkdir(join(bundle.assets, 'runs'));
	await writeFile(join(bundle.assets, 'runs', 'out.log'), 'log');

	const first = await files.trash('note', 'assets/runs');
	assert.match(first.trashed, /^\d{4}-\d{2}-\d{2}T[\d-]+Z-note\/assets\/runs$/u);
	assert.deepEqual(await files.restore('note', first.trashed), { path: 'assets/runs' });
	assert.equal(await readFile(join(bundle.assets, 'runs', 'out.log'), 'utf8'), 'log');
	await assert.rejects(files.restore('note', first.trashed), FileNotFoundError);

	const second = await files.trash('note', 'assets/runs/out.log');
	await writeFile(join(bundle.assets, 'runs', 'out.log'), 'newer');
	await assert.rejects(files.restore('note', second.trashed), FileConflictError);
	assert.equal(await readFile(join(bundle.assets, 'runs', 'out.log'), 'utf8'), 'newer');

	await assert.rejects(files.restore('note', '../../etc/passwd'), /回收站路径/u);
	await assert.rejects(files.restore('note', second.trashed.replace('-note/', '-other-note/')), /不是这篇文章/u);
});

test('a whole article goes to the trash and comes back under its name', async (t) => {
	const { project, paths: bundle, files } = await fixture(t);
	const trashed = await files.trashArticle('note');
	assert.match(trashed.trashed, /^articles\/[\d-]+T[\d-]+Z-note$/u);
	assert.ok(trashed.trashedTo.startsWith(join(project, '.studio-trash', 'articles')));
	await assert.rejects(readFile(bundle.markdown, 'utf8'));
	assert.deepEqual(await files.restoreArticle(trashed.trashed), { slug: 'note' });
	assert.match(await readFile(bundle.markdown, 'utf8'), /title/u);
	await assert.rejects(files.restoreArticle('2026-01-01T00-00-00-000Z-note'), /不是删除的文章/u);
});

test('the trash forgets what it has kept for a month', async (t) => {
	const { project, paths: bundle, files } = await fixture(t);
	const trashRoot = join(project, '.studio-trash');
	await mkdir(join(trashRoot, '2020-01-01T00-00-00-000Z-note', 'img'), { recursive: true });
	await mkdir(join(trashRoot, 'articles', '2020-01-01T00-00-00-000Z-old'), { recursive: true });
	await writeFile(join(bundle.img, 'a.png'), 'png');
	await files.trash('note', 'img/a.png');
	const left = await readdir(trashRoot);
	assert.equal(left.filter((name) => name.startsWith('2020')).length, 0);
	assert.deepEqual(await readdir(join(trashRoot, 'articles')), []);
	assert.equal(left.filter((name) => name.endsWith('-note')).length, 1);
});
