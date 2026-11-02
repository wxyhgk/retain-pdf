import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ArticleGit, GitError } from './article-git.mjs';

/** A repository of its own, with blog/ in it: nothing here touches the project's. */
async function repository(t) {
	const root = await mkdtemp(join(tmpdir(), 'studio-git-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
	git('init', '--quiet', '--initial-branch=main');
	git('config', 'user.email', 'studio@example.com');
	git('config', 'user.name', 'Studio Test');
	git('config', 'commit.gpgsign', 'false');
	const blog = join(root, 'blog');
	for (const slug of ['first', 'second']) {
		await mkdir(join(blog, slug, 'img'), { recursive: true });
		await writeFile(join(blog, slug, 'index.md'), `# ${slug}\n`);
	}
	await writeFile(join(root, 'README.md'), 'readme\n');
	git('add', '-A');
	git('commit', '--quiet', '-m', 'start');
	return { root, blog, git, articles: new ArticleGit(blog) };
}

test('which articles have changes not committed, new or modified', async (t) => {
	const { root, blog, articles } = await repository(t);
	assert.deepEqual(await articles.status(), { available: true, changed: {}, vanished: [] });
	await writeFile(join(blog, 'first', 'index.md'), '# first, edited\n');
	await mkdir(join(blog, 'third', 'img'), { recursive: true });
	await writeFile(join(blog, 'third', 'index.md'), '# third\n');
	await writeFile(join(blog, 'third', 'img', 'a.png'), 'png');
	await writeFile(join(root, 'README.md'), 'not an article\n');
	assert.deepEqual(await articles.status(), { available: true, changed: { first: 'modified', third: 'new' }, vanished: [] });
});

test('committing an article takes its folder only, and what else was staged stays staged', async (t) => {
	const { root, blog, git, articles } = await repository(t);
	await writeFile(join(blog, 'first', 'index.md'), '# first, edited\n');
	await writeFile(join(blog, 'second', 'index.md'), '# second, edited\n');
	await writeFile(join(root, 'README.md'), 'staged elsewhere\n');
	git('add', 'README.md');
	await writeFile(join(blog, 'first', 'img', 'new.png'), 'png');

	const result = await articles.commit('first', 'content: first');
	assert.match(result.commit, /^[0-9a-f]{7,}$/u);
	assert.deepEqual(git('show', '--name-only', '--format=%s', 'HEAD').trim().split('\n'), ['content: first', '', 'blog/first/img/new.png', 'blog/first/index.md']);
	assert.deepEqual(await articles.status(), { available: true, changed: { second: 'modified' }, vanished: [] });
	assert.equal(git('diff', '--cached', '--name-only').trim(), 'README.md');
	await assert.rejects(articles.commit('first', 'again'), GitError);
	await assert.rejects(articles.commit('second', '  '), /不能为空/u);
});

test('an article’s ai/ is never committed, whatever .gitignore says (the repository is public)', async (t) => {
	const { blog, git, articles } = await repository(t);
	await mkdir(join(blog, 'first', 'ai', 'work'), { recursive: true });
	await writeFile(join(blog, 'first', 'ai', 'brief.md'), 'private\n');
	await writeFile(join(blog, 'first', 'ai', 'work', 'log.md'), '- did something\n');
	// Only ai/ changed: nothing to commit.
	assert.deepEqual(await articles.status(), { available: true, changed: {}, vanished: [] });
	await writeFile(join(blog, 'first', 'index.md'), '# first, edited\n');
	await articles.commit('first', 'content: first');
	assert.deepEqual(git('show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['blog/first/index.md']);
	assert.equal(git('ls-files', 'blog/first/ai').trim(), '');
});

test('blog/ may be the repository itself: ai/ is left out all the same', async (t) => {
	const blog = await mkdtemp(join(tmpdir(), 'studio-git-blog-'));
	t.after(() => rm(blog, { recursive: true, force: true }));
	const git = (...args) => execFileSync('git', args, { cwd: blog, encoding: 'utf8' });
	git('init', '--quiet', '--initial-branch=main');
	git('config', 'user.email', 'studio@example.com');
	git('config', 'user.name', 'Studio Test');
	git('config', 'commit.gpgsign', 'false');
	await mkdir(join(blog, 'first', 'ai'), { recursive: true });
	await writeFile(join(blog, 'first', 'index.md'), '# first\n');
	await writeFile(join(blog, 'first', 'ai', 'brief.md'), 'private\n');
	const articles = new ArticleGit(blog);
	assert.deepEqual(await articles.status(), { available: true, changed: { first: 'new' }, vanished: [] });
	await articles.commit('first', 'content: first');
	assert.deepEqual(git('show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['first/index.md']);
});

test('a renamed article is committed with its old folder gone, never published twice', async (t) => {
	const { blog, git, articles } = await repository(t);
	await rename(join(blog, 'first'), join(blog, 'renamed'));
	assert.deepEqual(await articles.status(), { available: true, changed: { renamed: 'new' }, vanished: ['first'] });
	const result = await articles.commit('renamed', 'content: 改名');
	assert.deepEqual(result.vanished, ['first']);
	assert.deepEqual(git('ls-files', 'blog').trim().split('\n'), ['blog/renamed/index.md', 'blog/second/index.md']);
	assert.deepEqual(await articles.status(), { available: true, changed: {}, vanished: [] });
});

test('outside a git repository there is nothing to show', async (t) => {
	const folder = await mkdtemp(join(tmpdir(), 'studio-no-git-'));
	t.after(() => rm(folder, { recursive: true, force: true }));
	const articles = new ArticleGit(folder);
	assert.deepEqual(await articles.status(), { available: false, changed: {}, vanished: [] });
	await assert.rejects(articles.commit('note', 'x'), /不在 git 仓库/u);
});

test('an article gone whose removal was staged already is committed with the next one, not an error', async (t) => {
	const { blog, git, articles } = await repository(t);
	git('rm', '-r', '--quiet', 'blog/second');
	await rm(join(blog, 'second'), { recursive: true, force: true });
	await writeFile(join(blog, 'first', 'index.md'), '# first, edited\n');
	assert.deepEqual((await articles.commit('first', 'content: first')).vanished, ['second']);
	assert.deepEqual(git('show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['blog/first/index.md', 'blog/second/index.md']);
});
