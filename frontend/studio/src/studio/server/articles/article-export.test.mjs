import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { ArticleRepository } from './article-repository.mjs';
import { ArticleFileManager } from '../files/file-manager.mjs';
import { ArticleExport, fileNameOf } from './article-export.mjs';

async function fixture(t) {
	const project = await mkdtemp(join(tmpdir(), 'studio-export-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	const articles = new ArticleRepository(blogRoot);
	const manager = new ArticleFileManager(blogRoot);
	return { blogRoot, articles, exporter: new ArticleExport({ articles, manager, blogRoot, site: 'https://example.com' }) };
}

test('a title as a file’s name', () => {
	assert.equal(fileNameOf('CO₂/H₂O: 计算?', 'x'), 'CO₂ H₂O 计算');
	assert.equal(fileNameOf('  ', 'note-1'), 'note-1');
});

test('a page with no files: its .md alone, without where it was in the tree; links elsewhere to the blog', async (t) => {
	const { articles, exporter } = await fixture(t);
	await articles.create({ slug: 'top', title: '上层' });
	await articles.create({ slug: 'one', title: '一篇', parent: 'top', body: '见 [上层](/blog/top/)。\n' });
	const out = await exporter.export('one');
	assert.equal(out.name, '一篇.md');
	const text = out.body.toString('utf8');
	assert.doesNotMatch(text, /^parent:/mu);
	assert.match(text, /title: '一篇'/u);
	assert.match(text, /见 \[上层\]\(https:\/\/example\.com\/blog\/top\/\)。/u);
});

test('with its files and the pages under it: a zip, each page a folder of its own, links between them to their .md', async (t) => {
	const { blogRoot, articles, exporter } = await fixture(t);
	await articles.create({ slug: 'book', title: '书', body: '第一章见 [第一章](/blog/ch1/)。\n\n![图](./img/a.png)\n' });
	await articles.create({ slug: 'ch1', title: '第一章', parent: 'book', body: '回到 [书](/blog/book/)。\n' });
	await writeFile(join(blogRoot, 'book', 'img', 'a.png'), 'png');
	await writeFile(join(blogRoot, 'book', 'ai', 'brief.md'), 'not given out');
	const out = await exporter.export('book', { children: true });
	assert.equal(out.name, '书.zip');
	const zip = await JSZip.loadAsync(out.body);
	assert.deepEqual(Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort(), ['img/a.png', '书.md', '第一章/第一章.md']);
	assert.match(await zip.file('书.md').async('string'), /\[第一章\]\(%E7%AC%AC%E4%B8%80%E7%AB%A0\/%E7%AC%AC%E4%B8%80%E7%AB%A0\.md\)/u);
	assert.match(await zip.file('第一章/第一章.md').async('string'), /\[书\]\(\.\.\/%E4%B9%A6\.md\)/u);
	// Without the pages under it: the page and its files.
	const alone = await JSZip.loadAsync((await exporter.export('book')).body);
	assert.deepEqual(Object.keys(alone.files).filter((name) => !alone.files[name].dir).sort(), ['img/a.png', '书.md']);
});
