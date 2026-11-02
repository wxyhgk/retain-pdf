import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

import { appendToFixture, openStudio, removeArticle, resetFixture, writeArticle, writeFixtureFile } from './studio.ts';

// 导出 Markdown (article-export.mjs) and 导入 Markdown (article-import.mjs).

test.beforeEach(() => resetFixture());

test('⋯ › 导出 Markdown: a page with files is a zip of its .md and its files; with the pages under it, theirs too', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	appendToFixture('\n脚本：[opt.py](./assets/opt.py)\n');
	writeArticle('export-child', '---\ntitle: 子页面\npubDate: 2026-10-01\ndraft: true\nparent: studio-fixture\n---\n\n子页面的正文。\n');
	try {
		await openStudio(page);
		await page.locator('#page-menu').click();
		const saving = page.waitForEvent('download');
		await page.getByRole('menuitem', { name: '导出 Markdown', exact: true }).click();
		const download = await saving;
		expect(download.suggestedFilename()).toBe('Studio 测试夹具.zip');
		const zip = await JSZip.loadAsync(readFileSync(await download.path()));
		const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
		expect(names).toContain('Studio 测试夹具.md');
		expect(names).toContain('assets/opt.py');
		expect(names.some((name) => name.startsWith('子页面/'))).toBe(false);
		expect(await zip.file('Studio 测试夹具.md')!.async('string')).toContain('[opt.py](./assets/opt.py)');

		await page.locator('#page-menu').click();
		const both = page.waitForEvent('download');
		await page.getByRole('menuitem', { name: '导出 Markdown（连同子页面）' }).click();
		const withChildren = await JSZip.loadAsync(readFileSync(await (await both).path()));
		expect(Object.keys(withChildren.files)).toContain('子页面/子页面.md');
	} finally {
		removeArticle('export-child');
	}
});

/** The folders made by an import, taken away after. */
const blogFolders = () => readdirSync(process.env.STUDIO_BLOG_DIR!).filter((name) => !name.startsWith('.'));

test('导入 Markdown 文件: .md files and the picture they show, made pages; the first opened, the picture there', async ({ page }) => {
	const before = blogFolders();
	try {
		await openStudio(page);
		await page.locator('#workspace-menu').click();
		const choosing = page.waitForEvent('filechooser');
		await page.locator('#import-markdown-files').click();
		await (await choosing).setFiles([
			{ name: '导入的笔记.md', mimeType: 'text/markdown', buffer: Buffer.from('# 导入的笔记\n\n一段话。\n\n![图](plot.png)\n\n见 [另一条](另一条.md)。\n') },
			{ name: '另一条.md', mimeType: 'text/markdown', buffer: Buffer.from('另一条的正文。\n') },
			{ name: 'plot.png', mimeType: 'image/png', buffer: readFileSync(new URL('./fixtures/plot.png', import.meta.url)) },
		]);
		await expect(page.locator('.studio-toast')).toContainText('导入了 2 个页面、1 个文件');
		// The first of them (by name) opened.
		await expect(page.locator('#breadcrumb-title')).toHaveText('导入的笔记');
		await expect(page.locator('#article-list .page-row', { hasText: '另一条' })).toBeVisible();
		await expect(page.locator('#crepe-editor .milkdown .ProseMirror img')).toHaveAttribute('src', /img\/plot\.png/u);
		await expect(page.locator('#crepe-editor .milkdown .ProseMirror a', { hasText: '另一条' })).toHaveAttribute('href', /^\/blog\/note-/u);
	} finally {
		for (const folder of blogFolders()) if (!before.includes(folder)) removeArticle(folder);
	}
});

test('导入 Markdown 到这页下面: a zip (a Notion export) made pages under the open page', async ({ page }) => {
	const before = blogFolders();
	const zip = new JSZip();
	zip.file('Book 0123456789abcdef0123456789abcdef.md', '# 一本书\n\n[第一章](Book%200123456789abcdef0123456789abcdef/Ch%20fedcba9876543210fedcba9876543210.md)\n');
	zip.file('Book 0123456789abcdef0123456789abcdef/Ch fedcba9876543210fedcba9876543210.md', '# 第一章\n\n正文。\n');
	try {
		await openStudio(page);
		await page.locator('#page-menu').click();
		const choosing = page.waitForEvent('filechooser');
		await page.getByRole('menuitem', { name: '导入 Markdown 到这页下面…' }).click();
		await (await choosing).setFiles([{ name: 'export.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) }]);
		await expect(page.locator('.studio-toast')).toContainText('导入了 2 个页面');
		await expect(page.locator('#breadcrumb-title')).toHaveText('一本书');
		await expect(page.locator('.page-path-link')).toHaveText(['Studio 测试夹具']);
		const made = blogFolders().filter((folder) => !before.includes(folder));
		const chapter = made.find((folder) => readFileSync(`${process.env.STUDIO_BLOG_DIR}/${folder}/index.md`, 'utf8').includes("title: '第一章'"));
		const book = made.find((folder) => folder !== chapter)!;
		expect(readFileSync(`${process.env.STUDIO_BLOG_DIR}/${chapter}/index.md`, 'utf8')).toContain(`parent: ${book}`);
	} finally {
		for (const folder of blogFolders()) if (!before.includes(folder)) removeArticle(folder);
	}
});
