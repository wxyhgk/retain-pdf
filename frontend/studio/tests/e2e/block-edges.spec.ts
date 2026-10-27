import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Keys at the edges of blocks, as SiYuan has them: a formula is a stop for the arrows, text is never
// merged into code, a heading is a line again in one ⌫, a quote is neither merged into the line above
// nor split by an empty line, and there is room round the caret.

test.beforeEach(() => resetFixture());

const popup = (page: Page) => page.locator('.pm-source-popup');
const ranges = (page: Page) => editor(page).locator('.pm-block-range');

/** The caret at the start (or end) of the paragraph `text`. */
async function caretIn(page: Page, text: string, end = false) {
	const line = editor(page).getByText(text, { exact: true });
	await line.scrollIntoViewIfNeeded();
	await line.click();
	// Home and End scroll the page on a Mac; ⌘← and ⌘→ go to the line's ends there.
	const mac = process.platform === 'darwin';
	await page.keyboard.press(end ? (mac ? 'Meta+ArrowRight' : 'End') : mac ? 'Meta+ArrowLeft' : 'Home');
}

test('the arrows stop on a formula without opening it, ↩ opens it, and an arrow at its edge goes out', async ({ page }) => {
	appendToFixture('\n上一行。\n\n$$\nE=mc^2\n$$\n\n下一行。\n');
	await openStudio(page);
	const formula = editor(page).locator('.pm-display-math').last();
	await caretIn(page, '下一行。');
	await page.keyboard.press('ArrowUp');
	await expect(formula).toHaveClass(/is-selected/u);
	await expect(popup(page)).toHaveCount(0);
	await page.keyboard.press('ArrowUp');
	await page.keyboard.type('甲');
	await expect(editor(page).getByText('上一行。甲', { exact: true })).toBeVisible();

	await page.keyboard.press('ArrowDown');
	await expect(formula).toHaveClass(/is-selected/u);
	await page.keyboard.press('Enter');
	await expect(popup(page)).toBeVisible();
	await page.keyboard.press('ArrowDown');
	await expect(popup(page)).toHaveCount(0);
	await page.keyboard.type('乙');
	await expect(editor(page).getByText(/^乙下一行。$|^下一行。乙$/u)).toBeVisible();
	await expect(formula).toContainText('E');
});

test('⌫ after code goes to it, never merging the line into the code; an empty line there goes', async ({ page }) => {
	appendToFixture('\n```js\nlet a = 1\n```\n\n后面一行。\n\n最后一行。\n');
	await openStudio(page);
	await caretIn(page, '后面一行。');
	await page.keyboard.press('Backspace');
	await expect(editor(page).getByText('后面一行。', { exact: true })).toBeVisible();
	await expect(editor(page).locator('.cm-content').last()).toHaveText('let a = 1');

	await caretIn(page, '后面一行。', true);
	await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+ArrowLeft' : 'Shift+Home');
	await page.keyboard.press('Backspace');
	const lines = await editor(page).locator('> p').count();
	await page.keyboard.press('Backspace');
	await expect(editor(page).locator('> p')).toHaveCount(lines - 1);
	await expect(editor(page).locator('.cm-content').last()).toHaveText('let a = 1');
});

test('⌫ at the start of a heading makes it a line in one press', async ({ page }) => {
	appendToFixture('\n### 小标题\n');
	await openStudio(page);
	await caretIn(page, '小标题');
	await page.keyboard.press('Backspace');
	await expect(editor(page).locator('> p', { hasText: /^小标题$/u })).toHaveCount(1);
	await expect(editor(page).locator('h1, h2, h3', { hasText: '小标题' })).toHaveCount(0);
});

test('⌫ at the start of a quote takes its first line out in front of it, not into the line above', async ({ page }) => {
	appendToFixture('\n前一段。\n\n> 引用第一行\n>\n> 引用第二行\n');
	await openStudio(page);
	await caretIn(page, '引用第一行');
	await page.keyboard.press('Backspace');
	await expect(editor(page).locator('> p', { hasText: /^前一段。$/u })).toHaveCount(1);
	await expect(editor(page).locator('> p', { hasText: /^引用第一行$/u })).toHaveCount(1);
	await expect(editor(page).locator('blockquote')).toHaveText('引用第二行');
});

test('↩ on an empty line in the middle of a quote is a new line in it, not two quotes', async ({ page }) => {
	appendToFixture('\n> 甲\n>\n> 乙\n');
	await openStudio(page);
	await caretIn(page, '甲', true);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('blockquote')).toHaveCount(1);
	await expect(editor(page).locator('blockquote > p')).toHaveCount(4);
});

test('blocks selected downwards: ↑ goes above the first of them, ↓ below the last', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	await caretIn(page, '甲段落。');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(ranges(page)).toHaveText(['甲段落。', '乙段落。']);
	await page.keyboard.press('ArrowUp');
	await expect(ranges(page)).toHaveText(['结尾段落。']);
	await page.keyboard.press('Shift+ArrowDown');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(ranges(page)).toHaveText(['结尾段落。', '甲段落。', '乙段落。']);
	await page.keyboard.press('ArrowDown');
	await expect(ranges(page)).toHaveText(['丙段落。']);
});

test('⌘A twice selects every block, as blocks', async ({ page }) => {
	appendToFixture('\n甲段落。\n');
	await openStudio(page);
	await caretIn(page, '甲段落。');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.press('ControlOrMeta+a');
	await expect(ranges(page).first()).toContainText('开头段落');
	await expect(ranges(page).last()).toHaveText('甲段落。');
});

test('↑ anywhere on the first line goes to the title', async ({ page }) => {
	await openStudio(page);
	const first = editor(page).locator('> p').first();
	const box = (await first.boundingBox())!;
	await page.mouse.click(box.x + 60, box.y + 10);
	await page.keyboard.press('ArrowUp');
	expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.document-header')))).toBe(true);
});

test('writing at the bottom of the editor keeps room under the caret', async ({ page }) => {
	appendToFixture(`\n${Array.from({ length: 40 }, (_, i) => `第${i + 1}段。`).join('\n\n')}\n`);
	await openStudio(page);
	await caretIn(page, '第40段。', true);
	for (let index = 0; index < 4; index += 1) {
		await page.keyboard.press('Enter');
		await page.keyboard.type('又一行');
	}
	const room = await page.evaluate(() => {
		const caret = getSelection()!.getRangeAt(0).getBoundingClientRect();
		return document.querySelector('.editor-scroll')!.getBoundingClientRect().bottom - caret.bottom;
	});
	expect(room).toBeGreaterThan(90);
});
