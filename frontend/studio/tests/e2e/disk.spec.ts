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

const reviewBar = (page: Page): Locator => page.locator('#review-bar');

test('an article changed on disk is reviewed where it is; accepting keeps the change', async ({ page }) => {
	await openStudio(page);
	// Nothing in common with what it replaces: one change.
	editOnDisk('结尾段落。', 'The end.');
	await expect(reviewBar(page)).toBeVisible();
	await expect(page.locator('#review-count')).toHaveText('磁盘上的文章有 1 处改动');
	await expect(saveStatus(page)).toHaveText('磁盘上的改动待审阅');
	await expect(editor(page).locator('.milkdown-diff-added')).toContainText('The end.');
	await expect(editor(page).locator('.milkdown-diff-removed')).toContainText('结尾段落。');

	const changed = readFileSync(articleFile(), 'utf8');
	await reviewBar(page).getByRole('button', { name: '全部接受' }).click();
	await expect(reviewBar(page)).toBeHidden();
	await expect(editor(page)).toContainText('The end.');
	await expect(editor(page)).not.toContainText('结尾段落。');
	await expect(saveStatus(page)).toHaveText('已保存');
	await page.waitForTimeout(500);
	expect(readFileSync(articleFile(), 'utf8')).toBe(changed);
});

test('rejecting a change on disk writes the article back as it was', async ({ page }) => {
	await openStudio(page);
	const before = readFileSync(articleFile(), 'utf8');
	editOnDisk('结尾段落。', '终端改过的结尾。');
	await expect(reviewBar(page)).toBeVisible();
	await reviewBar(page).getByRole('button', { name: '全部拒绝' }).click();
	await expect(reviewBar(page)).toBeHidden();
	// The rejection is an edit like any other: saved as soon as asked.
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(readFileSync(articleFile(), 'utf8')).toBe(before);
});

test('a changed chemistry block is one change, shown as its old structure and its new source', async ({ page }) => {
	await openStudio(page);
	editOnDisk('CC(=O)Oc1ccccc1C(=O)O', 'c1ccccc1O');
	await expect(page.locator('#review-count')).toHaveText('磁盘上的文章有 1 处改动');
	await expect(editor(page).locator('.milkdown-diff-added')).toContainText('c1ccccc1O');
	await reviewBar(page).getByRole('button', { name: '全部接受' }).click();
	await expect(reviewBar(page)).toBeHidden();
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(readFileSync(articleFile(), 'utf8')).toContain('```smiles\nc1ccccc1O\n```');
});

test('each change is accepted or rejected on its own, and nothing is typed meanwhile', async ({ page }) => {
	await openStudio(page);
	writeFileSync(
		articleFile(),
		readFileSync(articleFile(), 'utf8').replace('开头段落', '开头段落（终端补的）').replace('结尾段落。', '结尾段落。终端补的结尾。'),
	);
	await expect(page.locator('#review-count')).toHaveText('磁盘上的文章有 2 处改动');

	// Typing waits for the review.
	await editor(page).locator('p').first().click();
	await page.keyboard.type('不该出现');
	await expect(editor(page)).not.toContainText('不该出现');

	await editor(page).locator('.milkdown-diff-reject').first().click();
	await expect(page.locator('#review-count')).toHaveText('磁盘上的文章有 1 处改动');
	await editor(page).locator('.milkdown-diff-accept').first().click();
	await expect(reviewBar(page)).toBeHidden();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const saved = readFileSync(articleFile(), 'utf8');
	expect(saved).not.toContain('（终端补的）');
	expect(saved).toContain('结尾段落。终端补的结尾。');
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
	await page.keyboard.press('ControlOrMeta+s');
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
		await page.keyboard.press('ControlOrMeta+s');
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
