import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture, savedMarkdown, saveStatus, scienceBlock } from './studio.ts';

// A click on a block's drag handle opens its menu; a chemistry block's ⋯
// button opens the same one.

const menu = (page: Page) => page.locator('.milkdown-block-menu');
const item = (page: Page, key: string) => menu(page).locator(`[data-key="${key}"]`);

async function clickHandleOf(page: Page, text: string): Promise<void> {
	await editor(page).getByText(text, { exact: true }).hover();
	const handle = page.locator('.milkdown-block-handle .operation-item').last();
	await expect(handle).toBeVisible();
	await handle.click();
}

test.beforeEach(async ({ page }) => {
	resetFixture();
	await openStudio(page);
});

test('the drag handle opens the block menu; an entry turns the block into another kind', async ({ page }) => {
	await clickHandleOf(page, '结尾段落。');
	await expect(menu(page)).toBeVisible();
	await expect(item(page, 'turn-paragraph')).toHaveClass(/current/);
	await item(page, 'turn-h2').click();
	await expect(menu(page)).toBeHidden();
	await expect(editor(page).locator('h2', { hasText: '结尾段落。' })).toBeVisible();

	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/\n## 结尾段落。\n$/u);
});

test('the keyboard works the menu, and a second click on the handle closes it', async ({ page }) => {
	await clickHandleOf(page, '结尾段落。');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu(page)).toBeHidden();
	// Letters do nothing while it is open: the block under it is selected.
	await clickHandleOf(page, '结尾段落。');
	await page.keyboard.press('x');
	await expect(editor(page).getByText('结尾段落。', { exact: true })).toBeVisible();
	await page.locator('.milkdown-block-handle .operation-item').last().click();
	await expect(menu(page)).toBeHidden();
});

test('a chemistry block’s ⋯ opens the menu for chemistry blocks', async ({ page }) => {
	const xyz = scienceBlock(page, 'XYZ');
	await xyz.hover();
	await xyz.locator('.science-block-menu-button').click();
	await expect(item(page, 'edit')).toBeVisible();
	await expect(item(page, 'convert-xyz')).toHaveClass(/current/);
	await expect(item(page, 'turn-h2')).toHaveCount(0);
	await item(page, 'convert-sdf').click();
	await expect(scienceBlock(page, 'SDF')).toHaveCount(2);
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(0);
});
