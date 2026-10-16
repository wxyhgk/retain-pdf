import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { blogHasArticle, fixtureHas, openStudio, removeArticle, resetFixture, slug, writeFixtureFile } from './studio.ts';

// Getting about as in Notion: ⌘K finds titles and text, ⋯ on a row, the trash.

const TITLE = 'Studio 测试夹具';
const COPY = `${slug}-copy`;
const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));
const row = (page: Page, title: string) => page.locator('.page-item', { has: page.locator('.page-row', { hasText: title }) });

test.beforeEach(() => {
	removeArticle(COPY);
	resetFixture();
});
test.afterAll(() => {
	removeArticle(COPY);
	resetFixture();
});

test('⌘K finds an article by its text, and opening it shows where', async ({ page }) => {
	await openStudio(page);
	await page.keyboard.press('ControlOrMeta+k');
	const dialog = page.locator('#quick-find-dialog');
	await expect(dialog).toBeVisible();
	await page.locator('#quick-find-input').fill('结尾段');
	const result = dialog.locator('.quick-find-item').first();
	await expect(result.locator('.quick-find-title')).toHaveText(TITLE);
	await expect(result.locator('.quick-find-snippet mark')).toHaveText('结尾段');
	await page.keyboard.press('Enter');
	await expect(dialog).toBeHidden();
	// Marked where it is: the mark lies over the paragraph that holds it, which is in view.
	const mark = await page.locator('.editor-scroll .search-flash').boundingBox();
	const paragraph = page.locator('.ProseMirror p', { hasText: '结尾段落' });
	await expect(paragraph).toBeInViewport();
	const box = (await paragraph.boundingBox())!;
	expect(mark && Math.abs(mark.y - box.y) < 8 && Math.abs(mark.height - box.height) < 10).toBe(true);

	await page.locator('#open-search').click();
	await page.locator('#quick-find-input').fill('没有这样的字');
	await expect(dialog.locator('.quick-find-empty')).toHaveText('没有找到');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});

test('a row’s ⋯ opens what can be done to it', async ({ page }) => {
	await openStudio(page);
	const item = row(page, TITLE);
	await item.hover();
	await item.locator('.page-more').click();
	await expect(page.getByRole('menuitem')).toHaveText(['改文件夹名…', '复制一份', '移到回收站']);
	await page.keyboard.press('Escape');
});

test('the trash lists deleted files and articles, puts them back, or deletes them for good', async ({ page }) => {
	writeFixtureFile('img/plot.png', PLOT);
	await openStudio(page);
	page.on('dialog', (dialog) => void dialog.accept(dialog.defaultValue()));

	await page.locator('.file-row', { hasText: 'plot.png' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: '移到回收站' }).click();
	await expect.poll(() => fixtureHas('img/plot.png')).toBe(false);
	await row(page, TITLE).locator('.page-row').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '复制一份' }).click();
	await expect(page).toHaveURL(new RegExp(`article=${COPY}`, 'u'));
	await row(page, `${TITLE}（副本）`).locator('.page-row').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '移到回收站' }).click();
	await expect.poll(() => blogHasArticle(COPY)).toBe(false);

	await page.locator('#open-trash').click();
	const items = page.locator('#trash-list .trash-item');
	await expect(items.locator('.trash-name')).toHaveText([`${TITLE}（副本）`, 'img/plot.png']);
	await items.filter({ hasText: 'img/plot.png' }).getByRole('button', { name: '恢复' }).click();
	await expect(page.locator('#trash-status')).toHaveText(`已恢复 ${slug}/img/plot.png`);
	expect(fixtureHas('img/plot.png')).toBe(true);
	await items.filter({ hasText: '（副本）' }).getByRole('button', { name: '彻底删除' }).click();
	await expect(page.locator('#trash-list .trash-empty')).toBeVisible();
	expect(blogHasArticle(COPY)).toBe(false);
});
