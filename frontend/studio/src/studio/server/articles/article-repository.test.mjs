import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleConflictError, ArticleRepository } from './article-repository.mjs';
import { articleBundlePaths, assertArticleSlug, resolveInside } from '../../../articles/bundle-paths.mjs';
import { articleSummary, isPublishedArticle, validateArticleSource } from '../../../articles/schemas.mjs';
import { CUBE_DISPLAY_DEFAULTS } from '@blog/science/cube-display.mjs';

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
	assert.deepEqual(articleSummary(source, 'fallback'), { title: 'A: quoted title', draft: true, icon: '', tags: [], kind: 'post', parent: '' });
	assert.equal(validateArticleSource(source).success, true);
	assert.equal(isPublishedArticle({ data: { draft: true } }), false);
	assert.equal(isPublishedArticle({ data: { draft: false } }), true);
});

test('an article is read with its text and revision, once each, and saved against that revision', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'first-note', title: "研究者的 '草稿'" });

	const listed = await repository.list();
	assert.equal(typeof listed[0]?.modified, 'number');
	assert.deepEqual(listed, [{
		slug: 'first-note', title: "研究者的 '草稿'", draft: true, icon: '', tags: [], kind: 'post', parent: '',
		pubDate: new Date().toISOString().slice(0, 10), description: '', modified: listed[0].modified,
	}]);

	const initial = await repository.read('first-note');
	// The text once: a book's is megabytes.
	assert.equal('content' in initial, false);
	assert.equal('hash' in initial, false);
	assert.match(initial.source, /draft: true/u);
	assert.deepEqual(initial.properties, {
		title: "研究者的 '草稿'",
		description: '',
		pubDate: new Date().toISOString().slice(0, 10),
		tags: [],
		draft: true,
		icon: '',
		cover: '',
		kind: 'post',
		wide: false,
		parent: '',
		props: {},
	});
	assert.ok(Math.abs(initial.modified - Date.now()) < 60_000);

	const saved = await repository.save('first-note', {
		source: `${initial.source}\nNew paragraph.\n`,
		expectedRevision: initial.revision,
	});
	assert.match(saved.revision, /^[0-9a-f]{64}$/u);
	assert.match(await readFile(join(root, 'first-note', 'index.md'), 'utf8'), /New paragraph\./u);

	await assert.rejects(
		repository.save('first-note', { source: initial.source, expectedRevision: initial.revision }),
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

test('a save sent again after its answer was lost succeeds, and changes nothing', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'retry-note', title: 'Retry note' });
	const initial = await repository.read('retry-note');
	const change = { source: `${initial.source}\nOnce.\n`, expectedRevision: initial.revision };

	const first = await repository.save('retry-note', change);
	const file = join(root, 'retry-note', 'index.md');
	const written = (await stat(file)).mtimeMs;
	const again = await repository.save('retry-note', change);
	assert.equal(again.revision, first.revision);
	assert.deepEqual(again.problems, first.problems);
	assert.equal((await stat(file)).mtimeMs, written, 'not written twice');

	// Something else on disk is still someone else's change.
	await assert.rejects(repository.save('retry-note', { source: `${initial.source}\nOther.\n`, expectedRevision: initial.revision }), ArticleConflictError);
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
	// No title read: none shown (the page's 无标题, in grey), not its folder name.
	assert.equal(opened.properties.title, '');
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
	assert.deepEqual(await repository.rename('old-name', 'new-name'), { slug: 'new-name', relinked: 0 });
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
	assert.deepEqual(copy.properties, { title: 'Original（副本）', description: '', pubDate: '2026-10-16', tags: ['DFT'], draft: true, icon: '', cover: '', kind: 'post', wide: false, parent: '', props: {} });
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

test('the articles that link to one, with the words around each link', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'target', title: '目标' });
	await repository.create({ slug: 'reader', title: '读者' });
	await repository.create({ slug: 'other', title: '无关' });
	const write = (slug, body) => writeFile(join(root, slug, 'index.md'), `---\ntitle: ${slug === 'reader' ? '读者' : '无关'}\nicon: 📘\n---\n\n${body}\n`);
	await write('reader', '先读 [目标](/blog/target/)。\n\n再读 [一次](https://wxyhgk.github.io/blog/target/#eq-1)');
	await write('other', '`[代码](/blog/target/)` 和 [别处](/blog/reader/)');
	await writeFile(join(root, 'target', 'index.md'), '---\ntitle: 目标\n---\n\n[自己](/blog/target/)\n');

	assert.deepEqual(await repository.backlinks('target', { site: 'https://wxyhgk.github.io' }), [{
		slug: 'reader', title: '读者', icon: '📘', draft: false,
		mentions: [{ line: 6, text: '目标', context: '先读 目标。' }, { line: 8, text: '一次', context: '再读 一次' }],
	}]);
	assert.deepEqual((await repository.backlinks('target')).map((found) => found.mentions.length), [1]);
	assert.deepEqual((await repository.backlinks('reader')).map((found) => found.slug), ['other']);
	await assert.rejects(repository.backlinks('../x'), /slug/u);
});

test('pages under pages: made under one, moved under another or to the top, never under themselves; a rename keeps the pages under it', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目' });
	await repository.create({ slug: 'method', title: '方法', parent: 'project' });
	await repository.create({ slug: 'results', title: '结果' });
	const parents = async () => Object.fromEntries((await repository.list()).map((page) => [page.slug, page.parent]));
	assert.deepEqual(await parents(), { project: '', method: 'project', results: '' });

	await repository.setParent('results', 'method');
	assert.deepEqual(await parents(), { project: '', method: 'project', results: 'method' });
	// Under itself, or under a page under it: refused, nothing written.
	await assert.rejects(repository.setParent('project', 'results'), /不能放到它自己/u);
	await assert.rejects(repository.setParent('method', 'method'), /不能放到它自己/u);
	await assert.rejects(repository.setParent('method', 'nowhere'), /上级页面不存在/u);

	const before = await readFile(articleBundlePaths(blog, 'results').markdown, 'utf8');
	await repository.setParent('results', '');
	const after = await readFile(articleBundlePaths(blog, 'results').markdown, 'utf8');
	assert.doesNotMatch(after, /parent/u);
	assert.equal(after, before.replace(/parent: "method"\n/u, ''), 'the rest of the text as it was');

	await repository.rename('project', 'hf-project');
	assert.deepEqual(await parents(), { 'hf-project': '', method: 'hf-project', results: '' });
	assert.equal(validateArticleSource(await readFile(articleBundlePaths(blog, 'method').markdown, 'utf8')).success, true);
});

test('a rename takes the links to the article with it, in the others and its own', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'note-20261021-180000', title: '基组' });
	await repository.create({ slug: 'project', title: '项目' });
	const project = articleBundlePaths(blog, 'project').markdown;
	await writeFile(project, `${await readFile(project, 'utf8')}\n见 [基组](/blog/note-20261021-180000/#de-xuan-ze)。\n`);
	const result = await repository.rename('note-20261021-180000', 'ji-zu');
	assert.deepEqual(result, { slug: 'ji-zu', relinked: 1 });
	assert.match(await readFile(project, 'utf8'), /\[基组\]\(\/blog\/ji-zu\/#de-xuan-ze\)/u);
});

test('a page moved under another is a page block at its end (as Notion has it), and no longer one in the page it left', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目', body: '项目的话。' });
	await repository.create({ slug: 'other', title: '别处', body: '别处的话。' });
	await repository.create({ slug: 'notes', title: '笔记 [草]', body: '笔记的话。' });
	const body = async (slug) => (await readFile(articleBundlePaths(blog, slug).markdown, 'utf8')).replace(/^---[\s\S]*?---\n/u, '');
	await repository.setParent('notes', 'project');
	assert.equal(await body('project'), '\n项目的话。\n\n[笔记 \\[草\\]](/blog/notes/)\n');
	// Moved again: there, and gone from where it was; a link to it in a sentence stays.
	await repository.save('project', { source: (await readFile(articleBundlePaths(blog, 'project').markdown, 'utf8')).replace('项目的话。', '项目的话，见[笔记](/blog/notes/)。'), expectedRevision: '' });
	await repository.setParent('notes', 'other');
	assert.equal(await body('project'), '\n项目的话，见[笔记](/blog/notes/)。\n');
	assert.match(await body('other'), /别处的话。\n\n\[笔记 \\\[草\\\]\]\(\/blog\/notes\/\)\n$/u);
	// Put in its place among those under it again (same page): nothing more added.
	await repository.setParent('notes', 'other');
	assert.equal((await body('other')).match(/\/blog\/notes\//gu).length, 1);
	// To the top: out of the page it left.
	await repository.setParent('notes', '');
	assert.equal(await body('other'), '\n别处的话。\n');
});

test('a page put before or after another under the same page goes just there, the pages there numbered again', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目' });
	for (const [slug, title] of [['part-1', '第1章'], ['part-2', '第2章'], ['part-10', '第10章']]) await repository.create({ slug, title, parent: 'project' });
	const { comparePages } = await import('../../../articles/page-order.mjs');
	const order = async () => (await repository.list()).filter((page) => page.parent === 'project').sort(comparePages).map((page) => page.slug);
	// By title, numbers as numbers.
	assert.deepEqual(await order(), ['part-1', 'part-2', 'part-10']);
	await repository.setParent('part-10', 'project', { before: 'part-1' });
	assert.deepEqual(await order(), ['part-10', 'part-1', 'part-2']);
	assert.match(await readFile(articleBundlePaths(blog, 'part-10').markdown, 'utf8'), /\norder: 10\n/u);
	await repository.setParent('part-10', 'project', { after: 'part-2' });
	assert.deepEqual(await order(), ['part-1', 'part-2', 'part-10']);
	// Put under it without a place: after those given one.
	await repository.create({ slug: 'notes', title: '杂记' });
	await repository.setParent('notes', 'project');
	assert.deepEqual(await order(), ['part-1', 'part-2', 'part-10', 'notes']);
	await assert.rejects(repository.setParent('notes', 'project', { before: 'project' }), /不在那里/u);
	assert.equal(validateArticleSource(await readFile(articleBundlePaths(blog, 'notes').markdown, 'utf8')).success, true);
});

test('a page made with a section of its parent has that text, and the parent’s files it names copied in', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目' });
	await mkdir(join(blog, 'project', 'img'), { recursive: true });
	await writeFile(join(blog, 'project', 'img', 'plot.png'), 'png');
	await repository.create({
		slug: 'method',
		title: '方法',
		parent: 'project',
		body: '先算。\n\n![图](./img/plot.png)\n',
		files: ['img/plot.png', 'img/missing.png', '../project/index.md', 'ai/brief.md'],
	});
	const source = await readFile(articleBundlePaths(blog, 'method').markdown, 'utf8');
	assert.match(source, /\nparent: project\n---\n\n先算。\n\n!\[图\]\(\.\/img\/plot\.png\)\n$/u);
	assert.equal(await readFile(join(blog, 'method', 'img', 'plot.png'), 'utf8'), 'png');
	assert.equal(validateArticleSource(source).success, true);
});

test('a page merged into the one above it: its text a section there, in place of the link to it; its files, pages and links follow', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目', body: '前言。\n\n[方法](/blog/method/)\n\n尾声。' });
	await repository.create({ slug: 'method', title: '方法', parent: 'project', body: '先算。\n\n![图](./img/plot.png)' });
	await mkdir(join(blog, 'method', 'img'), { recursive: true });
	await writeFile(join(blog, 'method', 'img', 'plot.png'), 'png');
	await repository.create({ slug: 'detail', title: '细节', parent: 'method' });
	await repository.create({ slug: 'other', title: '别处', body: '见 [方法](/blog/method/)。' });
	const kept = [];
	assert.deepEqual(await repository.merge('method', { before: (parent, source) => kept.push([parent, source]) }), { slug: 'method', parent: 'project' });
	assert.equal(kept[0][0], 'project');
	assert.match(kept[0][1], /\[方法\]\(\/blog\/method\/\)/u);
	const project = await readFile(articleBundlePaths(blog, 'project').markdown, 'utf8');
	assert.match(project, /前言。\n\n## 方法\n\n先算。\n\n!\[图\]\(\.\/img\/plot\.png\)\n\n尾声。/u);
	assert.equal(await readFile(join(blog, 'project', 'img', 'plot.png'), 'utf8'), 'png');
	assert.equal((await repository.list()).find((page) => page.slug === 'detail').parent, 'project');
	assert.match(await readFile(articleBundlePaths(blog, 'other').markdown, 'utf8'), /\[方法\]\(\/blog\/project\/\)/u);
	await assert.rejects(repository.merge('project'), /没有可以并入的上级/u);
});

test('a page given another title takes along the links to it that were its title, and only those', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'parent-page', title: '上级' });
	await repository.create({ slug: 'sub-page', title: '无标题', parent: 'parent-page' });
	const linking = await repository.read('parent-page');
	const body = '\n[无标题](/blog/sub-page/)\n\n见 [这一页](/blog/sub-page/) 和 [无标题](https://example.org/blog/sub-page/)，[无标题](/blog/parent-page/)。\n\n`[无标题](/blog/sub-page/)`\n';
	await repository.save('parent-page', { source: `${linking.source}${body}`, expectedRevision: linking.revision });

	const page = await repository.read('sub-page');
	const saved = await repository.save('sub-page', { source: page.source.replace("title: '无标题'", "title: '量子化学 [一]'"), expectedRevision: page.revision }, { site: 'https://example.org' });
	assert.equal(saved.retitled, 1);
	const after = (await repository.read('parent-page')).source;
	assert.ok(after.endsWith('\n[量子化学 \\[一\\]](/blog/sub-page/)\n\n见 [这一页](/blog/sub-page/) 和 [量子化学 \\[一\\]](https://example.org/blog/sub-page/)，[无标题](/blog/parent-page/)。\n\n`[无标题](/blog/sub-page/)`\n'), after);

	// Saved again as it is, and with its title taken away: nothing more changes.
	const again = await repository.read('sub-page');
	assert.equal((await repository.save('sub-page', { source: `${again.source}\n正文。\n`, expectedRevision: again.revision })).retitled, undefined);
	assert.equal((await repository.read('parent-page')).source, after);
});

test('merged into the page above, a file of the same name that is another file is copied beside it, the library gets what it lacks, and a merge asked again adds nothing', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目', body: '前言 [@old]。\n\n[方法](/blog/method/)' });
	await repository.create({ slug: 'method', title: '方法', parent: 'project', body: '![图](./img/plot.png) ![同](img/same.png)\n\n见 [@new] 和 [@old]。' });
	for (const [page, name, text] of [
		['project', 'img/plot.png', 'the parent’s plot'],
		['method', 'img/plot.png', 'the page’s plot'],
		['project', 'img/same.png', 'same'],
		['method', 'img/same.png', 'same'],
		['project', 'assets/refs.bib', '@article{old,\n  title = {Parent’s},\n}\n'],
		['method', 'assets/refs.bib', '@article{old,\n  title = {Page’s},\n}\n\n@book{new,\n  title = {New},\n}\n'],
	]) {
		await mkdir(join(blog, page, name, '..'), { recursive: true });
		await writeFile(join(blog, page, name), text);
	}
	await repository.merge('method');
	const project = () => readFile(articleBundlePaths(blog, 'project').markdown, 'utf8');
	assert.match(await project(), /## 方法\n\n!\[图\]\(\.\/img\/plot-2\.png\) !\[同\]\(img\/same\.png\)\n\n见 \[@new\] 和 \[@old\]。/u);
	assert.equal(await readFile(join(blog, 'project', 'img', 'plot.png'), 'utf8'), 'the parent’s plot');
	assert.equal(await readFile(join(blog, 'project', 'img', 'plot-2.png'), 'utf8'), 'the page’s plot');
	const library = await readFile(join(blog, 'project', 'assets', 'refs.bib'), 'utf8');
	assert.match(library, /title = \{Parent’s\}/u);
	assert.doesNotMatch(library, /Page’s/u);
	assert.match(library, /@book\{new,\n {2}title = \{New\},\n\}/u);
	// Stopped before the page went to the trash, and asked again: the same files, one section.
	const once = await project();
	await repository.merge('method');
	assert.equal(await project(), once);
	assert.equal((await readFile(join(blog, 'project', 'assets', 'refs.bib'), 'utf8')), library);
});

test('a page made from a section takes the parent’s library when it cites, never a file through a link to elsewhere, and is not left half made', async (t) => {
	const blog = await temporaryBlog(t);
	const outside = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'project', title: '项目' });
	await mkdir(join(blog, 'project', 'assets'), { recursive: true });
	await writeFile(join(blog, 'project', 'assets', 'refs.bib'), '@article{a,\n  title = {A},\n}\n');
	await writeFile(join(outside, 'secret.png'), 'secret');
	await rm(join(blog, 'project', 'img'), { recursive: true, force: true });
	await symlink(outside, join(blog, 'project', 'img'));
	await repository.create({ slug: 'method', title: '方法', parent: 'project', body: '见 [@a]。\n\n![](./img/secret.png)', files: ['img/secret.png'] });
	assert.equal(await readFile(join(blog, 'method', 'assets', 'refs.bib'), 'utf8'), '@article{a,\n  title = {A},\n}\n');
	await assert.rejects(stat(join(blog, 'method', 'img', 'secret.png')), { code: 'ENOENT' });
	// Taken: refused, and what is there stays.
	await assert.rejects(repository.create({ slug: 'method', title: '又一个' }), ArticleConflictError);
	assert.match(await readFile(articleBundlePaths(blog, 'method').markdown, 'utf8'), /title: '方法'/u);
});

test('a version that cannot be kept does not stop a save; a write by another program meanwhile does', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'note', title: 'Note' });
	const first = await repository.read('note');
	const warn = t.mock.method(console, 'warn', () => {});
	const saved = await repository.save('note', { source: `${first.source}\n一。\n`, expectedRevision: first.revision }, { before: () => Promise.reject(new Error('ENOSPC')) });
	assert.equal(warn.mock.callCount(), 1);
	assert.match((await repository.read('note')).source, /一。/u);
	// Written by another program between the check and the write (here: while the version is kept).
	const markdown = articleBundlePaths(blog, 'note').markdown;
	await assert.rejects(
		repository.save('note', { source: `${first.source}\n二。\n`, expectedRevision: saved.revision }, { before: (current) => writeFile(markdown, `${current}\n别人。\n`) }),
		ArticleConflictError,
	);
	assert.match(await readFile(markdown, 'utf8'), /别人。/u);
});

test('a title typed a letter at a time is followed once it stays, from what it was; the pages changed keep a version', async (t) => {
	const blog = await temporaryBlog(t);
	const kept = [];
	const repository = new ArticleRepository(blog, { retitleAfter: 30, keep: (slug, source) => kept.push([slug, source]) });
	await repository.create({ slug: 'hf', title: 'Hartree-Fock 方法' });
	await repository.create({ slug: 'notes', title: '笔记', body: '[Hartree-Fock 方法](/blog/hf/) 和 [Hartree-Fock](/blog/hf/)' });
	for (const title of ['Hartree-Fock', 'Hartree-Fock 理', 'Hartree-Fock 理论']) {
		const page = await repository.read('hf');
		await repository.save('hf', { source: page.source.replace(/title: .*/u, `title: ${title}`), expectedRevision: page.revision });
	}
	assert.equal(kept.length, 0);
	await new Promise((done) => setTimeout(done, 80));
	assert.match(await readFile(articleBundlePaths(blog, 'notes').markdown, 'utf8'), /\[Hartree-Fock 理论\]\(\/blog\/hf\/\) 和 \[Hartree-Fock\]\(\/blog\/hf\/\)/u);
	assert.deepEqual(kept.map(([slug]) => slug), ['notes']);
});

test('two pages linking to each other given new titles at once both finish', async (t) => {
	const blog = await temporaryBlog(t);
	const repository = new ArticleRepository(blog);
	await repository.create({ slug: 'one', title: '一', body: '[二](/blog/two/)' });
	await repository.create({ slug: 'two', title: '二', body: '[一](/blog/one/)' });
	const [one, two] = await Promise.all([repository.read('one'), repository.read('two')]);
	const answers = await Promise.all([
		repository.save('one', { source: one.source.replace(/title: .*/u, 'title: 甲'), expectedRevision: one.revision }),
		repository.save('two', { source: two.source.replace(/title: .*/u, 'title: 乙'), expectedRevision: two.revision }),
	]);
	assert.deepEqual(answers.map((answer) => answer.retitled), [1, 1]);
	assert.match((await repository.read('one')).source, /title: 甲[\s\S]*\[乙\]\(\/blog\/two\/\)/u);
	assert.match((await repository.read('two')).source, /title: 乙[\s\S]*\[甲\]\(\/blog\/one\/\)/u);
});

test('a page put under another by someone editing its file gets a page block there, and leaves the one it was under', async (t) => {
	const root = await temporaryBlog(t);
	const repository = new ArticleRepository(root);
	await repository.create({ slug: 'page-a', title: '甲' });
	await repository.create({ slug: 'page-b', title: '乙' });
	await repository.create({ slug: 'page-c', title: '丙' });
	await repository.followParents();
	const markdown = (slug) => articleBundlePaths(root, slug).markdown;
	const edit = async (slug, change) => writeFile(markdown(slug), change(await readFile(markdown(slug), 'utf8')));

	// As an AI writes it: parent: in the file, by hand.
	await edit('page-a', (source) => source.replace('draft: true\n', 'draft: true\nparent: "page-b"\n'));
	await repository.followParents(['page-a']);
	assert.match(await readFile(markdown('page-b'), 'utf8'), /\n\[甲\]\(\/blog\/page-a\/\)\n$/u);

	// Moved on: out of 乙, into 丙; told twice, written once.
	await edit('page-a', (source) => source.replace('parent: "page-b"', 'parent: page-c'));
	await repository.followParents(['page-a']);
	await repository.followParents(['page-a']);
	assert.doesNotMatch(await readFile(markdown('page-b'), 'utf8'), /page-a/u);
	assert.equal((await readFile(markdown('page-c'), 'utf8')).match(/\/blog\/page-a\//gu)?.length, 1);

	// A page not seen before (new, back from the trash) is learned, not taken as moved; moved after, an untitled one is
	// linked as 无标题.
	await repository.create({ slug: 'page-d', title: '' });
	await repository.followParents(['page-d']);
	await edit('page-d', (source) => source.replace('draft: true\n', 'draft: true\nparent: page-c\n'));
	await repository.followParents(['page-d']);
	assert.match(await readFile(markdown('page-c'), 'utf8'), /\[无标题\]\(\/blog\/page-d\/\)/u);
	await repository.create({ slug: 'page-e', title: '戊', parent: 'page-c' });
	const before = await readFile(markdown('page-c'), 'utf8');
	await repository.followParents(['page-e']);
	assert.equal(await readFile(markdown('page-c'), 'utf8'), before);
});

test('a page made under another with `link`: linked from it at its end (无标题 till named, then its title); under a database, not', async (t) => {
	const root = await temporaryBlog(t);
	const repo = new ArticleRepository(root);
	await repo.create({ slug: 'project', title: '项目', body: '正文。' });
	await repo.create({ slug: 'child', title: '', parent: 'project', link: true });
	assert.match((await repo.read('project')).source, /正文。\n\n\[无标题\]\(\/blog\/child\/\)\n$/u);
	const { source, revision } = await repo.read('child');
	await repo.save('child', { source: source.replace(/^title: .*$/mu, "title: '基组'"), expectedRevision: revision });
	assert.match((await repo.read('project')).source, /\[基组\]\(\/blog\/child\/\)\n$/u);
	// Not asked: not linked (a [[ or /page link written where the caret is, by the editor).
	await repo.create({ slug: 'quiet', title: '安静', parent: 'project' });
	assert.doesNotMatch((await repo.read('project')).source, /quiet/u);
	await repo.create({ slug: 'table', title: '表', parent: 'project', type: 'database', body: '```database\n{}\n```' });
	await repo.create({ slug: 'row', title: '一行', parent: 'table', link: true });
	assert.doesNotMatch((await repo.read('table')).source, /row/u);
});
