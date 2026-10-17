import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture } from './studio.ts';

// The slash menu as Notion has it: opened by `、` too, found by English names and pinyin.

test.beforeEach(() => resetFixture());

const menu = (page: Page) => page.locator('.milkdown-slash-menu');
const shownItems = (page: Page) => menu(page).locator('.menu-groups [data-index]');

/** A new empty block after the fixture's last paragraph. */
async function newBlock(page: Page): Promise<void> {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

/** Picks the first item shown. */
async function pick(page: Page): Promise<void> {
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
}

test('`、` opens the slash menu, as the `/` key types it under a Chinese input method', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.insertText('、');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type('bt2');
	await expect(shownItems(page)).toHaveText(['标题 2']);
	await pick(page);
	await page.keyboard.type('第二节');
	await expect(editor(page).locator('h2', { hasText: '第二节' })).toBeVisible();
});

test('a block is found by its English name and its pinyin', async ({ page }) => {
	await newBlock(page);
	for (const [typed, found] of [
		['/todo', '待办'],
		['/table', '表格'],
		['/daima', '代码'],
		['/dai ma', '代码'],
		['/callout', '提示块'],
		['/zdk', '折叠块'],
		['/smiles', '化学 SMILES'],
	]) {
		await page.keyboard.type(typed);
		await expect(shownItems(page).first(), typed).toHaveText(found);
		for (let index = 0; index < typed.length; index += 1) await page.keyboard.press('Backspace');
		await expect(menu(page)).toBeHidden();
	}
	await page.keyboard.type('/todo');
	await pick(page);
	await page.keyboard.type('写结论');
	await expect(editor(page).locator('li[data-item-type="task"], li.list-item', { hasText: '写结论' })).toBeVisible();
});

test('`、` inside a sentence is a comma, not the menu', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('甲');
	await page.keyboard.insertText('、');
	await page.keyboard.type('乙');
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();
});
