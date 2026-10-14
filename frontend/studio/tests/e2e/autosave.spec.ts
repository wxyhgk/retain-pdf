import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug } from './studio.ts';

test.beforeEach(() => resetFixture());

test('edits save themselves once typing stops', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	await editor(page).getByText(/^结尾段落。/).click();
	await page.keyboard.press('End');
	await page.keyboard.type('自己保存');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。自己保存');
});

test('what is typed while a save is under way is saved next', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	let release!: () => void;
	const held = new Promise<void>((resolve) => { release = resolve; });
	let saves = 0;
	await page.route(`**/api/studio/articles/${slug}`, async (route) => {
		if (route.request().method() === 'PUT' && ++saves === 1) await held;
		await route.continue();
	});
	await editor(page).getByText(/^结尾段落。/).click();
	await page.keyboard.press('End');
	await page.keyboard.type('先');
	await expect(saveStatus(page)).toHaveText('正在保存…');
	await page.keyboard.type('后');
	release();
	await expect(saveStatus(page)).toHaveText('已保存');
	await expect.poll(savedMarkdown).toContain('结尾段落。先后');
	expect(saves).toBe(2);
});

test('opening another article saves this one first, without asking', async ({ page }) => {
	const other = join(process.env.STUDIO_BLOG_DIR!, 'another-article');
	cpSync(join(process.env.STUDIO_BLOG_DIR!, slug), other, { recursive: true });
	try {
		let dialogs = 0;
		page.on('dialog', (dialog) => { dialogs += 1; void dialog.dismiss(); });
		await openStudio(page);
		await editor(page).getByText(/^结尾段落。/).click();
		await page.keyboard.press('End');
		await page.keyboard.type('切换前');
		await expect(saveStatus(page)).toHaveText('未保存');
		await page.locator('.page-row:not(.active)').click();
		await expect(page).toHaveURL(/article=another-article/);
		await expect.poll(savedMarkdown).toContain('结尾段落。切换前');
		expect(dialogs).toBe(0);
	} finally {
		rmSync(other, { recursive: true, force: true });
	}
});

test('a save that meets a change on disk asks once, then goes on with the author’s choice', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	let release!: () => void;
	const held = new Promise<void>((resolve) => { release = resolve; });
	let saves = 0;
	await page.route(`**/api/studio/articles/${slug}`, async (route) => {
		if (route.request().method() === 'PUT' && ++saves === 1) await held;
		await route.continue();
	});
	const messages: string[] = [];
	page.on('dialog', (dialog) => { messages.push(dialog.message()); void dialog.dismiss(); });
	await editor(page).getByText(/^结尾段落。/).click();
	await page.keyboard.press('End');
	await page.keyboard.type('我的改动');
	await expect(saveStatus(page)).toHaveText('正在保存…');

	const file = join(process.env.STUDIO_BLOG_DIR!, slug, 'index.md');
	writeFileSync(file, readFileSync(file, 'utf8').replace('开头段落', '终端改过的开头'));
	release();

	await expect(saveStatus(page)).toHaveText('已保存');
	await expect.poll(savedMarkdown).toContain('结尾段落。我的改动');
	expect(savedMarkdown()).not.toContain('终端改过的开头');
	expect(messages).toHaveLength(1);
	expect(messages[0]).toContain('在磁盘上被修改了');
});
