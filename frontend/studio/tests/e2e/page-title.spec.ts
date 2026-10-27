import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { editor, openStudio, removeArticle, resetFixture, saveStatus, writeArticle } from './studio.ts';

// A page as Notion has it: it need not be named (无标题, in grey); Enter in its title starts a new block at the top of
// it; the Studio opens again on the page open last.

const blog = () => process.env.STUDIO_BLOG_DIR!;
const title = (page: import('@playwright/test').Page) => page.locator('#article-title-input');
const made: string[] = [];

test.beforeEach(() => resetFixture());
test.afterEach(() => {
	for (const folder of made.splice(0)) removeArticle(folder);
});

test('opened again, the Studio shows the page open last', async ({ page }) => {
	writeArticle('opened-last', '---\ntitle: 上次看的\ndescription: \'\'\npubDate: 2026-10-27\ndraft: true\n---\n\n正文。\n');
	made.push('opened-last');
	await openStudio(page);
	await page.goto('/studio?article=opened-last');
	await expect(page.locator('#breadcrumb-title')).toHaveText('上次看的');
	await page.goto('/studio');
	await expect(page.locator('#breadcrumb-title')).toHaveText('上次看的');
});

test('a new page need not be named: it is saved with no title and listed as 无标题', async ({ page }) => {
	await openStudio(page);
	const before = new Set(readdirSync(blog()));
	await page.locator('#new-article').click();
	await expect(title(page)).toBeFocused();
	await expect(title(page)).toHaveValue('');
	await expect(title(page)).toHaveAttribute('placeholder', '无标题');
	const folder = readdirSync(blog()).find((name) => !before.has(name))!;
	made.push(folder);
	expect(readFileSync(join(blog(), folder, 'index.md'), 'utf8')).toContain("title: ''");
	await expect(page.locator('#breadcrumb-title')).toHaveText('无标题');
	await expect(page.locator('#article-list .page-row', { hasText: '无标题' })).toHaveCount(1);
	// Written in, saved, no title still: no complaint.
	await page.keyboard.press('Enter');
	await page.keyboard.type('一段没有标题的笔记。');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	await expect(page.locator('#property-error')).toBeHidden();
	expect(readFileSync(join(blog(), folder, 'index.md'), 'utf8')).toContain('一段没有标题的笔记。');
});

test('Enter in the title starts a new block at the top; what was after the caret goes into it', async ({ page }) => {
	await openStudio(page);
	const first = await editor(page).locator('> p').first().textContent();
	await title(page).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('新的开头');
	await expect(editor(page).locator('> p').first()).toHaveText('新的开头');
	await expect(editor(page).locator('> p').nth(1)).toHaveText(first!);
	await expect(title(page)).toHaveValue('Studio 测试夹具');

	// From the middle of the title: the rest of it is the new block's.
	await title(page).click();
	await page.keyboard.press('End');
	for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('Enter');
	await expect(title(page)).toHaveValue('Studio ');
	await expect(editor(page).locator('> p').first()).toHaveText('测试夹具');
	await page.keyboard.type('在');
	await expect(editor(page).locator('> p').first()).toHaveText('在测试夹具');
});
