import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { ArticleRepository } from './article-repository.mjs';
import { ArticleFileManager } from '../files/file-manager.mjs';
import { ArticleImport } from './article-import.mjs';

async function fixture(t) {
	const project = await mkdtemp(join(tmpdir(), 'studio-import-'));
	t.after(() => rm(project, { recursive: true, force: true }));
	const blogRoot = join(project, 'blog');
	await mkdir(blogRoot);
	const articles = new ArticleRepository(blogRoot);
	let count = 0;
	const importer = new ArticleImport({ articles, manager: new ArticleFileManager(blogRoot), slugs: (taken) => {
		let slug;
		do slug = `note-${++count}`; while (taken.has(slug));
		return slug;
	} });
	const zipOf = async (files) => {
		const zip = new JSZip();
		for (const [name, content] of Object.entries(files)) zip.file(name, content);
		return zip.generateAsync({ type: 'nodebuffer' });
	};
	const page = async (title) => {
		const found = (await articles.list()).find((article) => article.title === title);
		assert.ok(found, `no page 「${title}」`);
		return { ...found, source: await readFile(join(blogRoot, found.slug, 'index.md'), 'utf8'), files: async (folder) => readdir(join(blogRoot, found.slug, folder)) };
	};
	return { articles, importer, zipOf, page };
}

test('Notion’s export: Page.md beside Page/; ids after the names gone; pictures and links between them brought along', async (t) => {
	const { importer, zipOf, page } = await fixture(t);
	const done = await importer.import(await zipOf({
		'Book 0123456789abcdef0123456789abcdef.md': '# 书\n\n第一章：[Chapter 1](Book%200123456789abcdef0123456789abcdef/Chapter%201%20fedcba9876543210fedcba9876543210.md)\n\n![](Book%200123456789abcdef0123456789abcdef/plot.png)\n',
		'Book 0123456789abcdef0123456789abcdef/Chapter 1 fedcba9876543210fedcba9876543210.md': '# 第一章\n\n回到 [书](../Book%200123456789abcdef0123456789abcdef.md)。\n',
		'Book 0123456789abcdef0123456789abcdef/plot.png': 'png',
	}), { parent: '' });
	assert.deepEqual(done.pages.map((each) => each.title).sort(), ['书', '第一章']);
	assert.equal(done.files, 1);
	const book = await page('书');
	const chapter = await page('第一章');
	assert.equal(chapter.parent, book.slug);
	assert.match(book.source, new RegExp(`第一章：\\[Chapter 1\\]\\(/blog/${chapter.slug}/\\)`, 'u'));
	assert.match(book.source, /!\[\]\(\.\/img\/plot\.png\)/u);
	assert.doesNotMatch(book.source, /^# 书/mu);
	assert.deepEqual(await book.files('img'), ['plot.png']);
	assert.match(chapter.source, new RegExp(`回到 \\[书\\]\\(/blog/${book.slug}/\\)`, 'u'));
});

test('an Obsidian vault: a folder a page of its notes; ![[pictures]] found by name, [[links]] to the notes, properties’ titles', async (t) => {
	const { importer, zipOf, page } = await fixture(t);
	const done = await importer.import(await zipOf({
		'Vault/甲.md': '---\ntitle: 甲的标题\ntags: [dft]\n---\n\n见 [[乙|另一篇]]。\n\n![[mol.png|300]]\n\n![[data.csv]]\n\n![[nothere.png]]\n',
		'Vault/乙.md': '乙的正文，没有标题行。\n',
		'Vault/attachments/mol.png': 'png',
		'Vault/attachments/data.csv': 'x,y\n',
	}), { parent: '' });
	assert.equal(done.pages.length, 3);
	const vault = await page('Vault');
	const a = await page('甲的标题');
	const b = await page('乙');
	assert.equal(a.parent, vault.slug);
	assert.equal(b.parent, vault.slug);
	assert.match(a.source, new RegExp(`见 \\[另一篇\\]\\(/blog/${b.slug}/\\)。`, 'u'));
	assert.match(a.source, /!\[\]\(\.\/img\/mol\.png\)/u);
	assert.match(a.source, /\[data\.csv\]\(\.\/assets\/data\.csv\)/u);
	assert.deepEqual(done.missing, ['甲的标题: nothere.png']);
	// The folder's page: a page block for each note in it.
	assert.match(vault.source, new RegExp(`\\[甲的标题\\]\\(/blog/${a.slug}/\\)`, 'u'));
	assert.match(vault.source, new RegExp(`\\[乙\\]\\(/blog/${b.slug}/\\)`, 'u'));
});

test('under a page asked for; a zip with no Markdown, refused', async (t) => {
	const { articles, importer, zipOf, page } = await fixture(t);
	await articles.create({ slug: 'top', title: '上层' });
	await importer.import(await zipOf({ 'note.md': '# 一条笔记\n\n正文。\n' }), { parent: 'top' });
	assert.equal((await page('一条笔记')).parent, 'top');
	await assert.rejects(importer.import(await zipOf({ 'a.txt': 'x' })), /没有 Markdown/u);
	await assert.rejects(importer.import(Buffer.from('not a zip')), /读不出/u);
});
