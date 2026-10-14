import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleConflictError, ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths, assertArticleSlug, resolveInside } from './bundle-paths.mjs';
import { articleSummary, isPublishedArticle, validateArticleSource } from './schemas.mjs';
import { CUBE_DISPLAY_DEFAULTS } from '../../science/cube-display.mjs';

async function temporaryBlog(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-repository-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
}

test('bundle paths reject traversal and invalid slugs', () => {
	assert.throws(() => assertArticleSlug('../outside'));
	assert.throws(() => articleBundlePaths('/tmp/blog', 'Uppercase'));
	assert.throws(() => resolveInside('/tmp/blog', '..', 'outside'));
	assert.equal(articleBundlePaths('/tmp/blog', 'safe-slug').markdown, '/tmp/blog/safe-slug/index.md');
});

test('frontmatter is parsed as YAML and shares the publication rule', () => {
	const source = `---\ntitle: "A: quoted title"\ndescription: test\npubDate: 2026-08-09\ntags: []\ndraft: true\n---\n\nBody\n`;
	assert.deepEqual(articleSummary(source, 'fallback'), { title: 'A: quoted title', draft: true });
	assert.equal(validateArticleSource(source).success, true);
	assert.equal(isPublishedArticle({ data: { draft: true } }), false);
	assert.equal(isPublishedArticle({ data: { draft: false } }), true);
});

test('repository preserves the legacy API while supporting revision aliases', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'first-note', title: "研究者的 '草稿'" });

	const listed = await repository.list();
	assert.deepEqual(listed, [{ slug: 'first-note', title: "研究者的 '草稿'", draft: true }]);

	const initial = await repository.read('first-note');
	assert.equal(initial.content, initial.source);
	assert.equal(initial.hash, initial.revision);
	assert.match(initial.content, /draft: true/u);
	assert.deepEqual(initial.properties, {
		title: "研究者的 '草稿'",
		description: '',
		pubDate: new Date().toISOString().slice(0, 10),
		tags: [],
		draft: true,
	});

	const saved = await repository.save('first-note', {
		source: `${initial.source}\nNew paragraph.\n`,
		expectedRevision: initial.revision,
	});
	assert.equal(saved.hash, saved.revision);
	assert.match(await readFile(join(root, 'first-note', 'index.md'), 'utf8'), /New paragraph\./u);

	await assert.rejects(
		repository.save('first-note', { content: initial.content, expectedHash: initial.hash }),
		ArticleConflictError,
	);
});

test('repository writes 3Dmol views into article.views.json with revision locking', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'camera-note', title: 'Camera note' });
	const initial = await repository.read('camera-note');
	const view = [0, 0, 0, -12.5, 0, 0.382683, 0, 0.92388];

	const saved = await repository.saveMoleculeView('camera-note', 'water123', {
		format: 'xyz',
		view,
		expectedRevision: initial.revision,
	});
	assert.notEqual(saved.revision, initial.revision);
	assert.deepEqual(saved.chemistryViews.water123, { format: 'xyz', view });

	const views = JSON.parse(await readFile(articleBundlePaths(root, 'camera-note').views, 'utf8'));
	assert.deepEqual(views.molecules.water123, { format: 'xyz', view });
	assert.deepEqual((await repository.read('camera-note')).chemistryViews.water123, { format: 'xyz', view });

	await assert.rejects(
		repository.saveMoleculeView('camera-note', 'water123', {
			format: 'xyz',
			view,
			expectedRevision: initial.revision,
		}),
		ArticleConflictError,
	);
});

test('repository persists Cube display parameters with the same revision lock', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'cube-note', title: 'Cube note' });
	const initial = await repository.read('cube-note');
	const view = [0, 0, 0, -10, 0, 0, 0, 1];
	const display = { ...CUBE_DISPLAY_DEFAULTS, isovalue: 0.04, opacity: 0.5, moleculeStyle: 'line' };

	const saved = await repository.saveMoleculeView('cube-note', 'homo123', {
		format: 'cube', view, display, expectedRevision: initial.revision,
	});
	assert.deepEqual(saved.chemistryViews.homo123, { format: 'cube', view, display });
	assert.deepEqual((await repository.read('cube-note')).chemistryViews.homo123, { format: 'cube', view, display });

	await assert.rejects(
		repository.saveMoleculeView('cube-note', 'homo123', {
			format: 'cube', view, display, expectedRevision: initial.revision,
		}),
		ArticleConflictError,
	);
});

test('repository refuses an article bundle that is itself a symbolic link', async (t) => {
	const root = await temporaryBlog(t);
	const outside = await mkdtemp(join(tmpdir(), 'studio-outside-'));
	t.after(() => rm(outside, { recursive: true, force: true }));
	await writeFile(join(outside, 'index.md'), 'secret');
	await symlink(outside, join(root, 'linked-article'));

	const repository = new ArticleRepository(root);
	await assert.rejects(repository.read('linked-article'), /符号链接/u);
});
