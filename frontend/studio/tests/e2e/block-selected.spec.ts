import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Blocks selected, as SiYuan has them: the menu acts on all of them, a key typed by mistake loses
// nothing, Tab stays in the editor.

test.beforeEach(() => resetFixture());

const ranges = (page: Page) => editor(page).locator('.pm-block-range');
const lines = (page: Page) => editor(page).locator('> p').filter({ hasText: /^[甲乙丙]段落/u });

async function selectFirstTwo(page: Page) {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	await editor(page).getByText('丙段落。', { exact: true }).scrollIntoViewIfNeeded();
	await editor(page).getByText('甲段落。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(ranges(page)).toHaveText(['甲段落。', '乙段落。']);
}

async function openMenuOn(page: Page, text: string) {
	await editor(page).getByText(text, { exact: true }).hover();
	const handle = page.locator('.milkdown-block-handle .operation-item').last();
	await expect(handle).toBeVisible();
	await handle.click();
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
}

test('the menu of blocks selected deletes all of them', async ({ page }) => {
	await selectFirstTwo(page);
	await openMenuOn(page, '乙段落。');
	await page.locator('.milkdown-block-menu [data-key="delete"]').click();
	await expect(lines(page)).toHaveText(['丙段落。']);
});

test('the menu of blocks selected copies all of them', async ({ page }) => {
	await selectFirstTwo(page);
	await openMenuOn(page, '甲段落。');
	await page.locator('.milkdown-block-menu [data-key="duplicate"]').click();
	await expect(lines(page)).toHaveText(['甲段落。', '乙段落。', '甲段落。', '乙段落。', '丙段落。']);
});

test('a key typed with blocks selected is written after them; nothing is lost', async ({ page }) => {
	await selectFirstTwo(page);
	await page.keyboard.type('x');
	await expect(ranges(page)).toHaveCount(0);
	await expect(lines(page)).toHaveText(['甲段落。', '乙段落。x', '丙段落。']);
});

test('Tab with blocks selected, or ⇧Tab on a line, keeps the focus in the editor', async ({ page }) => {
	await selectFirstTwo(page);
	await page.keyboard.press('Tab');
	expect(await page.evaluate(() => document.activeElement?.classList.contains('ProseMirror'))).toBe(true);
	await editor(page).getByText('丙段落。', { exact: true }).click();
	await page.keyboard.press('Shift+Tab');
	expect(await page.evaluate(() => document.activeElement?.classList.contains('ProseMirror'))).toBe(true);
	await page.keyboard.type('续');
	await expect(editor(page).getByText(/丙段.*续|续/u)).toHaveCount(1);
});
