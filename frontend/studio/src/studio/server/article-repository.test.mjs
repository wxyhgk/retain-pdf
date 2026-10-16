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
	assert.deepEqual(articleSummary(source, 'fallback'), { title: 'A: quoted title', draft: true, icon: '', tags: [], kind: 'post' });
	assert.equal(validateArticleSource(source).success, true);
	assert.equal(isPublishedArticle({ data: { draft: true } }), false);
	assert.equal(isPublishedArticle({ data: { draft: false } }), true);
});

test('repository preserves the legacy API while supporting revision aliases', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'first-note', title: "研究者的 '草稿'" });

	const listed = await repository.list();
	assert.deepEqual(listed, [{ slug: 'first-note', title: "研究者的 '草稿'", draft: true, icon: '', tags: [], kind: 'post' }]);

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
		icon: '',
		cover: '',
		kind: 'post',
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

test('two saves from the same revision cannot both win', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'race-note', title: 'Race note' });
	const initial = await repository.read('race-note');

	const results = await Promise.allSettled([
		repository.save('race-note', { source: `${initial.source}\nFirst.\n`, expectedRevision: initial.revision }),
		repository.save('race-note', { source: `${initial.source}\nSecond.\n`, expectedRevision: initial.revision }),
	]);
	assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected']);
	assert.ok(results[1].reason instanceof ArticleConflictError);
	assert.match(await readFile(join(root, 'race-note', 'index.md'), 'utf8'), /First\./u);
});

test('an article whose properties are broken still lists, opens and saves, and says what is wrong', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'good-note', title: 'Good' });
	await repository.create({ slug: 'broken-note', title: 'Broken' });
	const markdown = articleBundlePaths(root, 'broken-note').markdown;
	await writeFile(markdown, '---\ntitle: [unclosed\n---\n\nBody\n');

	assert.deepEqual((await repository.list()).map((article) => article.slug), ['broken-note', 'good-note']);
	const opened = await repository.read('broken-note');
	assert.equal(opened.properties.title, 'broken-note');
	assert.match(opened.problems[0], /YAML/u);
	assert.deepEqual((await repository.read('good-note')).problems, []);

	const saved = await repository.save('broken-note', { source: '---\ntitle: Fixed\npubDate: 2026-10-16\n---\n\nBody\n', expectedRevision: opened.revision });
	assert.deepEqual(saved.problems, ["缺少简介（description）；没有简介也要写 description: ''"]);
	assert.match(await readFile(markdown, 'utf8'), /title: Fixed/u, 'saved all the same');
});

test('an article takes another folder name, never one taken', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'old-name', title: 'Old' });
	await repository.create({ slug: 'taken', title: 'Taken' });
	await writeFile(join(root, 'old-name', 'img', 'a.png'), 'png');

	await assert.rejects(repository.rename('old-name', 'taken'), ArticleConflictError);
	await assert.rejects(repository.rename('old-name', 'Bad Name'), /slug/u);
	assert.deepEqual(await repository.rename('old-name', 'new-name'), { slug: 'new-name' });
	assert.deepEqual((await repository.list()).map((article) => article.slug), ['new-name', 'taken']);
	assert.equal(await readFile(join(root, 'new-name', 'img', 'a.png'), 'utf8'), 'png');
});

test('a copy is a draft of today, titled 副本, with the files and views', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'original', title: 'Original' });
	const paths = articleBundlePaths(root, 'original');
	await writeFile(paths.markdown, "---\ntitle: 'Original' # 标题\ndescription: ''\npubDate: 2026-01-01\ntags: [DFT]\ndraft: false\nmacros:\n  Ha: \\hat{H}\n---\n\n正文\n");
	await writeFile(join(paths.img, 'a.png'), 'png');
	await writeFile(join(paths.img, '.DS_Store'), 'x');

	await repository.duplicate('original', 'original-copy', { now: new Date('2026-10-16T08:00:00Z') });
	const copy = await repository.read('original-copy');
	assert.deepEqual(copy.properties, { title: 'Original（副本）', description: '', pubDate: '2026-10-16', tags: ['DFT'], draft: true, icon: '', cover: '', kind: 'post' });
	assert.match(copy.source, /# 标题\n/u);
	assert.match(copy.source, /macros:\n  Ha: \\hat\{H\}\n---\n\n正文\n$/u);
	assert.equal(await readFile(join(root, 'original-copy', 'img', 'a.png'), 'utf8'), 'png');
	await assert.rejects(readFile(join(root, 'original-copy', 'img', '.DS_Store')));
	assert.equal((await repository.read('original')).properties.draft, false, 'the original as it was');
	await assert.rejects(repository.duplicate('original', 'original-copy'), ArticleConflictError);
});

test('an article is its index.md: one without article.views.json opens and saves', async (t) => {
	const root = await temporaryBlog(t);
	await mkdir(join(root, 'bare-note'));
	await writeFile(join(root, 'bare-note', 'index.md'), "---\ntitle: Bare\ndescription: ''\npubDate: 2026-10-16\n---\n\nBody\n");
	const repository = new ArticleRepository(root);
	const opened = await repository.read('bare-note');
	assert.equal(opened.properties.title, 'Bare');
	const saved = await repository.save('bare-note', { source: `${opened.source}More.\n`, expectedRevision: opened.revision });
	assert.notEqual(saved.revision, opened.revision);

	await repository.create({ slug: 'fresh-note', title: 'Fresh' });
	await assert.rejects(readFile(join(root, 'fresh-note', 'article.config.yaml')), /ENOENT/u);
});

test('search finds titles first, then the text, with the lines it is on', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'dft-basics', title: 'DFT 入门' });
	await repository.create({ slug: 'hf-notes', title: 'Hartree–Fock' });
	await writeFile(articleBundlePaths(root, 'hf-notes').markdown, "---\ntitle: 'Hartree–Fock'\ndescription: 'not DFT here'\n---\n\n和 dft 比较。\n\n## 再说一次 DFT\n");

	const found = await repository.search('dft');
	assert.deepEqual(found.map((result) => [result.slug, result.inTitle]), [['dft-basics', true], ['hf-notes', false]]);
	assert.deepEqual(found[1].matches, [{ line: 6, text: '和 dft 比较。' }, { line: 8, text: '再说一次 DFT' }]);
	assert.deepEqual(await repository.search('  '), []);
});
