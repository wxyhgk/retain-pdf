import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Writing as in Notion: Markdown typed at the start of a line turns the line into its block, marks typed
// around text apply them, and Enter, ⌫ and Tab on empty or listed lines do what one means.

test.beforeEach(() => resetFixture());

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

/** The caret on a new empty line after the fixture's last paragraph. */
async function newLine(page: Page): Promise<void> {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

/** What was written after the fixture's last paragraph. */
async function written(page: Page): Promise<string> {
	const saved = await save(page);
	return saved.slice(saved.indexOf('结尾段落。') + '结尾段落。'.length).trim();
}

for (const [typed, markdown] of [
	['## 小节', '## 小节'],
	['### 小小节', '### 小小节'],
	['- 一项', '- 一项'],
	['1. 第一步', '1. 第一步'],
	['> 引一句', '> 引一句'],
] as const) {
	test(`\`${typed.split(' ')[0]} \` at the start of a line makes its block`, async ({ page }) => {
		await newLine(page);
		await page.keyboard.type(typed);
		expect(await written(page)).toBe(markdown);
	});
}

test('``` and Enter make a code block, --- a divider', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('```');
	await page.keyboard.press('Enter');
	await page.keyboard.type('x = 1');
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('---');
	expect(await written(page)).toMatch(/^---\n\n```\nx = 1\n```$/u);
});

test('marks typed around text apply: bold, italic, code, link', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('有 **粗** 和 *斜* 和 `码` 和 [链](https://example.com) 。');
	expect(await written(page)).toBe('有 **粗** 和 *斜* 和 `码` 和 [链](https://example.com) 。');
	await expect(editor(page).locator('strong', { hasText: '粗' })).toBeVisible();
	await expect(editor(page).locator('em', { hasText: '斜' })).toBeVisible();
	await expect(editor(page).locator('code', { hasText: '码' })).toBeVisible();
	await expect(editor(page).locator('a[href="https://example.com"]')).toHaveText('链');
});

test('Enter on an empty list item ends the list', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('- 一项');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('列表外');
	expect(await written(page)).toBe('- 一项\n\n列表外');
});

test('⌫ at the start of a list item makes it a line again, not part of the item above', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('- 一项');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Backspace');
	await page.keyboard.type('不是列表');
	await page.keyboard.press('Enter');
	await page.keyboard.type('- 二项');
	await page.keyboard.press('ControlOrMeta+ArrowLeft');
	await page.keyboard.press('Backspace');
	expect(await written(page)).toBe('- 一项\n\n不是列表\n\n二项');
});

test('⌫ at the start of a nested item takes it one level out', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('- 外');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Tab');
	await page.keyboard.type('里');
	await page.keyboard.press('ControlOrMeta+ArrowLeft');
	await page.keyboard.press('Backspace');
	expect(await written(page)).toBe('- 外\n- 里');
});

test('⌫ on an empty line removes it and the caret goes to the end of the line above', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('上一行');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Backspace');
	await page.keyboard.type('接上');
	expect(await written(page)).toBe('上一行接上');
});

test('Tab nests a list item, ⇧Tab takes it out again', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('- 外');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Tab');
	await page.keyboard.type('里');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.type('又外');
	expect(await written(page)).toBe('- 外\n  - 里\n- 又外');
});

test('⇧Enter in a list item breaks the line inside it', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('- 第一行');
	await page.keyboard.press('Shift+Enter');
	await page.keyboard.type('第二行');
	expect(await written(page)).toBe('- 第一行\\\n  第二行');
});

for (const [keys, markdown] of [
	['ControlOrMeta+Alt+2', '## 改'],
	['ControlOrMeta+Alt+3', '### 改'],
	['ControlOrMeta+Alt+7', '1. 改'],
	['ControlOrMeta+Alt+8', '* 改'],
	['ControlOrMeta+Shift+b', '> 改'],
] as const) {
	test(`${keys} turns the line`, async ({ page }) => {
		await newLine(page);
		await page.keyboard.type('改');
		await page.keyboard.press(keys);
		expect(await written(page)).toBe(markdown);
	});
}

test('⌘A selects the text of the block first, then every block; ⌫ then clears the article', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('只选这段');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ControlOrMeta+a');
	await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe('只选这段');
	await page.keyboard.press('ControlOrMeta+a');
	await expect(editor(page).locator('.pm-block-range').first()).toContainText('开头段落');
	await page.keyboard.press('Backspace');
	await page.keyboard.type('全换掉');
	const saved = await save(page);
	expect(saved.slice(saved.indexOf('---', 3) + 3).trim()).toBe('全换掉');
});

