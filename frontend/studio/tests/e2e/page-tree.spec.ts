import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { openStudio, removeArticle, resetFixture, slug, writeArticle } from './studio.ts';

// Pages under pages, as Notion and SiYuan show them: a tree in the sidebar made from `parent:` (each page
// still a folder of its own in blog/), folded and unfolded, made under a page, moved by dragging, and on
// the blog the pages above in the path and the pages under at the end.

const TITLE = 'Studio 测试夹具';
const PAGES = ['tree-method', 'tree-results', 'tree-ai', 'tree-made', 'tree-top', 'tree-under'];
const item = (page: Page, title: string) => page.locator('.page-item', { has: page.locator('.page-title', { hasText: new RegExp(`^${title}$`, 'u') }) });
const source = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');

function page(title: string, extra = '', draft = true): string {
	return `---\ntitle: '${title}'\ndescription: '${title}的简介'\npubDate: '2026-10-21'\ntags: []\ndraft: ${draft}\n${extra}---\n\n${title}的正文。\n`;
}

test.beforeEach(() => {
	for (const folder of PAGES) removeArticle(folder);
	resetFixture();
});
test.afterAll(() => {
	for (const folder of PAGES) removeArticle(folder);
});

test('the pages under a page show under it, folded and unfolded; one an AI writes shows there at once', async ({ page: tab }) => {
	writeArticle('tree-method', page('方法', `parent: ${slug}\n`));
	writeArticle('tree-results', page('结果', 'parent: tree-method\n'));
	await openStudio(tab);
	await expect(item(tab, '方法')).toHaveCSS('--depth', '1');
	await expect(item(tab, '结果')).toHaveCSS('--depth', '2');
	const toggle = item(tab, TITLE).locator('.page-toggle');
	await toggle.click();
	await expect(item(tab, '方法')).toHaveCount(0);
	// Folded still, the next time.
	await tab.reload();
	await expect(item(tab, TITLE)).toBeVisible();
	await expect(item(tab, '方法')).toHaveCount(0);
	await item(tab, TITLE).locator('.page-toggle').click();
	await expect(item(tab, '结果')).toBeVisible();

	// Written into blog/ while the Studio is open (by the AI in the terminal).
	writeArticle('tree-ai', page('AI 写的子页面', `parent: ${slug}\n`));
	await expect(item(tab, 'AI 写的子页面')).toHaveCSS('--depth', '1', { timeout: 10_000 });
});

test('「在下面新建页面」 makes a page under that one', async ({ page: tab }) => {
	await openStudio(tab);
	await item(tab, TITLE).locator('.page-row').click({ button: 'right' });
	await tab.getByRole('menuitem', { name: '在下面新建页面…' }).click();
	const dialog = tab.locator('#new-article-dialog');
	await expect(dialog).toContainText(`放在「${TITLE}」下面`);
	await tab.locator('#new-article-title').fill('新的子页面');
	await tab.locator('#new-article-slug').fill('tree-made');
	await tab.locator('#create-article').click();
	await expect(item(tab, '新的子页面')).toHaveCSS('--depth', '1');
	expect(source('tree-made')).toMatch(new RegExp(`\\nparent: ${slug}\\n`, 'u'));
});

test('a page dragged onto another goes under it; dragged below the pages, to the top; never under itself', async ({ page: tab }) => {
	writeArticle('tree-top', page('顶层一页'));
	writeArticle('tree-under', page('下面一页', 'parent: tree-top\n'));
	await openStudio(tab);
	await item(tab, '顶层一页').locator('.page-row').dragTo(item(tab, '下面一页').locator('.page-row'));
	// Under a page under it: refused, nothing changes.
	expect(source('tree-top')).not.toMatch(/parent/u);
	await item(tab, '下面一页').locator('.page-row').dragTo(item(tab, TITLE).locator('.page-row'));
	await expect(item(tab, '下面一页')).toHaveCSS('--depth', '1');
	await expect.poll(() => source('tree-under')).toMatch(new RegExp(`parent: "?${slug}"?`, 'u'));
	await item(tab, '下面一页').locator('.page-row').dragTo(tab.locator('#article-list'), { targetPosition: { x: 40, y: (await tab.locator('#article-list').boundingBox())!.height - 10 } });
	await expect(item(tab, '下面一页')).toHaveCSS('--depth', '0');
	await expect.poll(() => source('tree-under')).not.toMatch(/parent/u);
});

test('the open page dragged under another is put there as an edit of it, saved', async ({ page: tab }) => {
	writeArticle('tree-top', page('顶层一页'));
	await openStudio(tab);
	await item(tab, TITLE).locator('.page-row').dragTo(item(tab, '顶层一页').locator('.page-row'));
	await expect(item(tab, TITLE)).toHaveCSS('--depth', '1');
	await expect.poll(() => source(slug)).toMatch(/parent: "?tree-top"?/u);
});
