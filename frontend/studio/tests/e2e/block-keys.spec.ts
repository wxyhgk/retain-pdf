import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Notion's keys for blocks: Esc selects one, ⌘⇧↑↓ move it, ⌘D copies it; ⌘K links selected text, `[] ` is a to-do.

test.beforeEach(() => resetFixture());

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

/** Three paragraphs after the fixture's last one, the caret at the end of the third. */
async function threeParagraphs(page: Page): Promise<void> {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	for (const text of ['甲段', '乙段', '丙段']) {
		await page.keyboard.press('Enter');
		await page.keyboard.type(text);
	}
}

test('⌘⇧↑ moves the block up, ⌘D copies it, and the text stays where it was written', async ({ page }) => {
	await threeParagraphs(page);
	await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
	await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
	await page.keyboard.press('ControlOrMeta+d');
	await page.keyboard.type('（副本）');
	const saved = await save(page);
	expect(saved).toContain('结尾段落。\n\n丙段\n\n丙段（副本）\n\n甲段\n\n乙段');
});

test('Esc selects the block; ↓ and ⇧↓ pick more, ⌫ deletes them, Esc goes back to writing', async ({ page }) => {
	await threeParagraphs(page);
	await editor(page).locator('p', { hasText: '甲段' }).click();
	await page.keyboard.press('Escape');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段']);
	await page.keyboard.press('Shift+ArrowDown');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段', '乙段']);
	await page.keyboard.press('Backspace');
	await expect(editor(page).locator('.pm-block-range')).toHaveCount(0);
	const saved = await save(page);
	expect(saved).toContain('结尾段落。\n\n丙段');
	expect(saved).not.toContain('甲段');

	await editor(page).locator('p', { hasText: '丙段' }).click();
	await page.keyboard.press('Escape');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['丙段']);
	await page.keyboard.press('Enter');
	await page.keyboard.type('写完');
	await expect(editor(page).locator('p', { hasText: '丙段写完' })).toBeVisible();
});

test('⌘K on selected text links it; with nothing selected it finds an article', async ({ page }) => {
	await threeParagraphs(page);
	await editor(page).locator('p', { hasText: '丙段' }).selectText();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.locator('#quick-find-dialog')).toBeHidden();
	// Crepe focuses the address field a frame later.
	await expect(page.locator('.milkdown-link-edit input')).toBeFocused();
	await page.keyboard.type('https://example.com');
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('a[href="https://example.com"]')).toHaveText('丙段');

	await editor(page).locator('p', { hasText: '乙段' }).click();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.locator('#quick-find-dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+p');
	await expect(page.locator('#quick-find-dialog')).toBeVisible();
});

test('`[] ` starts a to-do, ⌘⇧S strikes text through', async ({ page }) => {
	await threeParagraphs(page);
	// Typed at once: a new list item used to send keys typed in its first frame back to its start.
	await page.keyboard.press('Enter');
	await page.keyboard.type('[] 算频率');
	await page.keyboard.press('Enter');
	await page.keyboard.type('优化结构');
	await editor(page).locator('li p', { hasText: '优化结构' }).selectText();
	await page.keyboard.press('ControlOrMeta+Shift+s');
	await expect(editor(page).locator('li del')).toHaveText('优化结构');
	await page.keyboard.press('ArrowRight');
	// The editor hears of the browser moving the cursor a moment later (selectionchange).
	await page.waitForTimeout(50);
	// An empty to-do ends the list.
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('[x] 读文献');
	const saved = await save(page);
	// A list right after another is written with the other bullet, so it stays a list of its own.
	expect(saved).toContain('丙段\n\n- [ ] 算频率\n- [ ] ~~优化结构~~\n\n* [x] 读文献');
});
