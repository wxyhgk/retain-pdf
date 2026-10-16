import { expect, test, type Page } from '@playwright/test';

import { blogHasArticle, openStudio, removeArticle, resetFixture, slug } from './studio.ts';

// Whole articles, from the list: another folder name, a copy, the trash and back.

const TITLE = 'Studio 测试夹具';
const RENAMED = 'renamed-fixture';
const COPY = `${slug}-copy`;
const row = (page: Page, title: string) => page.locator('.page-row', { hasText: title });

async function fromMenu(page: Page, title: string, item: string): Promise<void> {
	await row(page, title).click({ button: 'right' });
	await page.getByRole('menuitem', { name: item }).click();
}

/** Answers the next prompt or confirm: with `value`, or as it suggests. */
function answer(page: Page, value?: string): void {
	page.once('dialog', (dialog) => void dialog.accept(value ?? dialog.defaultValue()));
}

test.beforeEach(() => {
	for (const folder of [RENAMED, COPY]) removeArticle(folder);
	resetFixture();
});
test.afterAll(() => {
	for (const folder of [RENAMED, COPY]) removeArticle(folder);
	resetFixture();
});

test('the open article takes another folder name and stays open under it', async ({ page }) => {
	await openStudio(page);
	answer(page, RENAMED);
	await fromMenu(page, TITLE, '改文件夹名…');
	await expect(page).toHaveURL(new RegExp(`article=${RENAMED}`, 'u'));
	await expect(page.locator('#save-status')).toHaveText('已载入');
	expect(blogHasArticle(RENAMED)).toBe(true);
	expect(blogHasArticle(slug)).toBe(false);
	await expect(row(page, TITLE)).toHaveCount(1);
});

test('a copy is a draft titled 副本, opened at once', async ({ page }) => {
	await openStudio(page);
	answer(page);
	await fromMenu(page, TITLE, '复制一份');
	await expect(page).toHaveURL(new RegExp(`article=${COPY}`, 'u'));
	await expect(page.locator('#article-title-input')).toHaveValue(`${TITLE}（副本）`);
	await expect(row(page, `${TITLE}（副本）`).locator('.page-draft')).toBeVisible();
	expect(blogHasArticle(slug)).toBe(true);
});

test('a deleted article opens the next one, and 撤销 brings it back', async ({ page }) => {
	await openStudio(page);
	answer(page);
	await fromMenu(page, TITLE, '复制一份');
	await expect(page).toHaveURL(new RegExp(`article=${COPY}`, 'u'));

	answer(page);
	await fromMenu(page, `${TITLE}（副本）`, '移到回收站');
	await expect(page).toHaveURL(new RegExp(`article=${slug}`, 'u'));
	expect(blogHasArticle(COPY)).toBe(false);
	await expect(row(page, `${TITLE}（副本）`)).toHaveCount(0);

	await page.locator('.studio-toast-action', { hasText: '撤销' }).click();
	await expect(page).toHaveURL(new RegExp(`article=${COPY}`, 'u'));
	expect(blogHasArticle(COPY)).toBe(true);
});

test('deleting the last article leaves the workspace empty, still able to undo', async ({ page }) => {
	await openStudio(page);
	answer(page);
	await fromMenu(page, TITLE, '移到回收站');
	await expect(page.locator('.article-list-empty')).toBeVisible();
	expect(blogHasArticle(slug)).toBe(false);
	await page.locator('.studio-toast-action', { hasText: '撤销' }).click();
	await expect(row(page, TITLE)).toBeVisible();
	await expect(page.locator('#save-status')).toHaveText('已载入');
	expect(blogHasArticle(slug)).toBe(true);
});
