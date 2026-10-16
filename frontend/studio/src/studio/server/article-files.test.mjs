import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { moleculeViewKey } from '../../science/view-key.mjs';
import { ArticleFiles } from './article-files.mjs';
import { ArticleConflictError, ArticleRepository } from './article-repository.mjs';
import { readMoleculeViews, writeMoleculeView } from './article-views.mjs';
import { articleBundlePaths } from './bundle-paths.mjs';
import { ArticleFileManager } from './file-manager.mjs';

const VIEW = [0, 0, 0, 100, 0, 0, 0, 1];

async function fixture(t, body) {
	const project = await mkdtemp(join(tmpdir(), 'studio-article-files-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	const articles = new ArticleRepository(blogRoot);
	await articles.create({ slug: 'note', title: 'Note' });
	const paths = articleBundlePaths(blogRoot, 'note');
	await writeFile(paths.markdown, `---\ntitle: Note\n---\n${body}`);
	await writeFile(join(paths.img, 'plot.png'), 'png');
	await writeFile(join(paths.img, 'unused.png'), 'png');
	await writeFile(join(paths.assets, 'homo.cube'), 'cube');
	return { paths, articles, files: new ArticleFiles(articles, new ArticleFileManager(blogRoot)) };
}

test('moving a referenced file rewrites the article to follow it', async (t) => {
	const { paths, articles, files } = await fixture(t, '![图](./img/plot.png)\n\n见 [原图](img/plot.png)。\n');
	const { revision } = await articles.read('note');

	const result = await files.move('note', 'img/plot.png', 'img/figures-1.png', { expectedRevision: revision });
	assert.equal(result.path, 'img/figures-1.png');
	assert.equal(result.references, 2);
	assert.equal(await readFile(paths.markdown, 'utf8'), '---\ntitle: Note\n---\n![图](./img/figures-1.png)\n\n见 [原图](img/figures-1.png)。\n');
	assert.equal(result.revision, (await articles.read('note')).revision);
	assert.deepEqual((await readdir(paths.img)).sort(), ['figures-1.png', 'unused.png']);
});

test('a move the article refers to needs the article as it is on disk', async (t) => {
	const { paths, files } = await fixture(t, '![图](./img/plot.png)\n');
	await assert.rejects(files.move('note', 'img/plot.png', 'img/b.png', { expectedRevision: 'stale' }), ArticleConflictError);
	await assert.rejects(files.move('note', 'img/plot.png', 'img/b.png'), ArticleConflictError);
	assert.deepEqual((await readdir(paths.img)).sort(), ['plot.png', 'unused.png']);
	assert.equal(await readFile(paths.markdown, 'utf8'), '---\ntitle: Note\n---\n![图](./img/plot.png)\n');
});

test('a file nothing refers to moves without a revision', async (t) => {
	const { paths, files } = await fixture(t, '![图](./img/plot.png)\n');
	const before = await readFile(paths.markdown, 'utf8');
	const result = await files.move('note', 'img/unused.png', 'assets/unused.png');
	assert.equal(result.references, 0);
	assert.equal(await readFile(paths.markdown, 'utf8'), before);
});

test('saved 3D views follow their @file to its new name', async (t) => {
	const { paths, articles, files } = await fixture(t, '```cube\n@file ./assets/homo.cube\n```\n');
	await writeFile(paths.views, writeMoleculeView(await readFile(paths.views, 'utf8'), moleculeViewKey('cube', './assets/homo.cube'), 'cube', VIEW));
	const { revision } = await articles.read('note');

	const result = await files.move('note', 'assets', 'assets', { expectedRevision: revision }).catch((error) => error);
	assert.ok(result instanceof Error, 'a resource folder itself cannot move');

	await mkdir(join(paths.assets, 'orbitals'));
	const moved = await files.move('note', 'assets/homo.cube', 'assets/orbitals/homo.cube', { expectedRevision: revision });
	assert.equal(moved.views, 1);
	assert.match(await readFile(paths.markdown, 'utf8'), /@file \.\/assets\/orbitals\/homo\.cube\n/u);
	const views = readMoleculeViews(await readFile(paths.views, 'utf8'));
	assert.deepEqual(Object.keys(views), [moleculeViewKey('cube', './assets/orbitals/homo.cube')]);
	assert.deepEqual(views[moleculeViewKey('cube', './assets/orbitals/homo.cube')].view, VIEW);
	assert.equal(moved.revision, (await articles.read('note')).revision);
});

test('when the article cannot be written, the file goes back', async (t) => {
	const { paths, articles, files } = await fixture(t, '![图](./img/plot.png)\n');
	const { revision } = await articles.read('note');
	const write = articles.writeSnapshot.bind(articles);
	let calls = 0;
	articles.writeSnapshot = async (...args) => {
		calls += 1;
		if (calls === 1) throw new Error('disk full');
		return write(...args);
	};

	await assert.rejects(files.move('note', 'img/plot.png', 'img/b.png', { expectedRevision: revision }), /disk full/u);
	assert.deepEqual((await readdir(paths.img)).sort(), ['plot.png', 'unused.png']);
	assert.equal(await readFile(paths.markdown, 'utf8'), '---\ntitle: Note\n---\n![图](./img/plot.png)\n');
});

test('a save sent while a move rewrites the article waits for it, and then conflicts', async (t) => {
	const { paths, articles, files } = await fixture(t, '![plot](./img/plot.png)\n');
	const { revision } = await articles.snapshot('note');
	const [moved, saved] = await Promise.allSettled([
		files.move('note', 'img/plot.png', 'img/energy.png', { expectedRevision: revision }),
		articles.save('note', { source: '---\ntitle: Note\n---\n![plot](./img/plot.png)\nEdited.\n', expectedRevision: revision }),
	]);
	assert.equal(moved.status, 'fulfilled');
	assert.equal(saved.status, 'rejected');
	assert.ok(saved.reason instanceof ArticleConflictError);
	assert.match(await readFile(paths.markdown, 'utf8'), /\.\/img\/energy\.png/u);
});
