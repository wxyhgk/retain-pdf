import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus, scienceBlock } from './studio.ts';

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

test('the menu moves a block, tells each action’s key, and turns a block into a callout', async ({ page }) => {
	await clickHandleOf(page, '结尾段落。');
	await expect(item(page, 'duplicate').locator('.hint')).toHaveText(/D$/u);
	await expect(item(page, 'move-up').locator('.hint')).toHaveText(/↑$/u);
	await expect(item(page, 'ask-ai')).toHaveText(/问 AI…/u);
	await expect(item(page, 'ask-ai').locator('.hint')).toHaveText(/J$/u);
	await item(page, 'move-up').click();
	await expect(menu(page)).toBeHidden();

	await clickHandleOf(page, '结尾段落。');
	await item(page, 'turn-callout').click();
	await expect(editor(page).locator('aside.callout-tip .callout-body')).toHaveText('结尾段落。');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	// Moved above the XYZ block, which was the block before it.
	expect(savedMarkdown()).toContain('> [!TIP]\n> 结尾段落。\n\n```xyz');
});

test('「转换成」 in the toolbar over selected text opens the block’s menu below it', async ({ page }) => {
	const paragraph = editor(page).getByText('结尾段落。', { exact: true });
	// In view, as when a person selects it: the menu closes when the page scrolls.
	await paragraph.scrollIntoViewIfNeeded();
	await paragraph.selectText();
	const turn = page.locator('.milkdown-toolbar [aria-label="转换成"]');
	await expect(turn).toBeVisible();
	await expect(page.locator('.milkdown-toolbar [aria-label="删除线"]')).toHaveAttribute('title', /⇧⌘S|Ctrl\+Shift\+S/u);
	await expect(page.locator('.milkdown-toolbar [aria-label="问 AI"]')).toBeVisible();
	await turn.click();
	await expect(menu(page)).toBeVisible();
	await item(page, 'turn-h3').click();
	await expect(editor(page).locator('h3', { hasText: '结尾段落。' })).toBeVisible();
});

test('several blocks selected turn together into one list', async ({ page }) => {
	appendToFixture('\n第一点\n\n第二点\n\n第三点\n');
	await page.reload();
	await expect(saveStatus(page)).toHaveText('已载入');
	// From inside the first to inside the third.
	await editor(page).getByText('第一点', { exact: true }).click();
	await page.keyboard.press('Home');
	await page.keyboard.down('Shift');
	await editor(page).getByText('第三点', { exact: true }).click();
	await page.keyboard.up('Shift');
	await expect(page.locator('.milkdown-toolbar[data-show="true"]')).toBeVisible();
	await page.locator('.milkdown-toolbar [aria-label="转换成"]').click();
	await item(page, 'turn-bullet').click();
	await expect(editor(page).locator('ul').last().locator('li')).toHaveCount(3);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/\n([-*]) 第一点\n\1 第二点\n\1 第三点\s*$/u);
});

test('in a list, the block menu turns only the item it is for', async ({ page }) => {
	appendToFixture('\n- 甲\n- 乙\n- 丙\n');
	await page.reload();
	await expect(saveStatus(page)).toHaveText('已载入');
	await clickHandleOf(page, '乙');
	await item(page, 'turn-h3').click();
	await expect(editor(page).locator('h3', { hasText: '乙' })).toBeVisible();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/\n- 甲\n\n### 乙\n\n- 丙\n$/u);
});
