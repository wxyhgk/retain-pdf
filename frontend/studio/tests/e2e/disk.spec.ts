import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug, writeFixtureFile } from './studio.ts';

const articleFile = (): string => join(process.env.STUDIO_BLOG_DIR!, slug, 'index.md');
const toast = (page: Page): Locator => page.locator('.studio-toast');

/** Change the article on disk the way an AI in the terminal would. */
function editOnDisk(from: string, to: string): void {
	writeFileSync(articleFile(), readFileSync(articleFile(), 'utf8').replace(from, to));
}

test.beforeEach(() => resetFixture());

test('files added on disk appear in the panel by themselves', async ({ page }) => {
	await openStudio(page);
	writeFixtureFile('assets/from-terminal.xyz', '3\nwater\n');
	await expect(page.locator('#file-tree .file-row[data-path="assets/from-terminal.xyz"]')).toBeVisible();
});

test('an article changed on disk is shown again when nothing is unsaved', async ({ page }) => {
	await openStudio(page);
	editOnDisk('结尾段落。', '终端改过的结尾。');
	await expect(editor(page)).toContainText('终端改过的结尾。');
	await expect(toast(page)).toHaveText('文章在磁盘上被修改，已重新载入');
	await expect(saveStatus(page)).toHaveText('已载入');
});

test('with unsaved edits the author chooses, and keeping them saves over the disk', async ({ page }) => {
	await openStudio(page);
	await editor(page).getByText('结尾段落。').click();
	await page.keyboard.press('End');
	await page.keyboard.type('我的改动');
	await expect(saveStatus(page)).toHaveText('未保存');

	const asked = page.waitForEvent('dialog');
	editOnDisk('开头段落', '终端改过的开头');
	const dialog = await asked;
	expect(dialog.message()).toContain('在磁盘上被修改了');
	await dialog.dismiss();
	await expect(editor(page)).toContainText('我的改动');

	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。我的改动');
	expect(savedMarkdown()).not.toContain('终端改过的开头');
});

test('taking the disk version drops the unsaved edits', async ({ page }) => {
	await openStudio(page);
	await editor(page).getByText('结尾段落。').click();
	await page.keyboard.press('End');
	await page.keyboard.type('我的改动');
	await expect(saveStatus(page)).toHaveText('未保存');

	page.once('dialog', (dialog) => void dialog.accept());
	editOnDisk('开头段落', '终端改过的开头');
	await expect(editor(page)).toContainText('终端改过的开头');
	await expect(editor(page)).not.toContainText('我的改动');
	await expect(saveStatus(page)).toHaveText('已载入');
});

test('the Studio’s own saves are not taken for changes from outside', async ({ page }) => {
	let dialogs = 0;
	page.on('dialog', (dialog) => { dialogs += 1; void dialog.dismiss(); });
	await openStudio(page);
	for (const word of ['一', '二']) {
		await editor(page).getByText(/^结尾段落。/).click();
		await page.keyboard.press('End');
		await page.keyboard.type(word);
		await page.waitForTimeout(400);
		await page.keyboard.press('ControlOrMeta+Enter');
		await expect(saveStatus(page)).toHaveText('已保存');
	}
	await page.waitForTimeout(1000);
	expect(dialogs).toBe(0);
	await expect(toast(page)).toHaveCount(0);
	await expect(saveStatus(page)).toHaveText('已保存');
});

test('an article made on disk joins the list', async ({ page }) => {
	await openStudio(page);
	const fixture = join(process.env.STUDIO_BLOG_DIR!, slug);
	const copy = join(process.env.STUDIO_BLOG_DIR!, 'from-terminal');
	cpSync(fixture, copy, { recursive: true });
	writeFileSync(join(copy, 'index.md'), readFileSync(join(copy, 'index.md'), 'utf8').replace("title: 'Studio 测试夹具'", "title: '终端写的文章'"));
	try {
		await expect(page.locator('.page-row', { hasText: '终端写的文章' })).toBeVisible();
	} finally {
		rmSync(copy, { recursive: true, force: true });
	}
});
