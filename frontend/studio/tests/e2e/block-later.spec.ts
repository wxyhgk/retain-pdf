import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// The rest of SiYuan's keyboard: ⌘C and ⌘X with nothing selected take the block, ⇧↑ grows a text
// selection into blocks, the slash menu works in a list item, the arrows go through a toggle's title
// and a figure's caption, and through code keeping the caret's place across.

test.beforeEach(() => resetFixture());

const ranges = (page: Page) => editor(page).locator('.pm-block-range');
const mac = process.platform === 'darwin';

/** The caret in the paragraph `text`, `at` of the way along its text. */
async function caretIn(page: Page, text: string, at: number) {
	const line = editor(page).getByText(text, { exact: true });
	await line.scrollIntoViewIfNeeded();
	const box = await line.evaluate((p) => {
		const range = document.createRange();
		range.selectNodeContents(p);
		const r = range.getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height };
	});
	await page.mouse.click(box.x + box.width * at, box.y + box.height / 2);
}

test('⌘C or ⌘X with nothing selected takes the block being written in', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n');
	await openStudio(page);
	// What the editor puts on the clipboard (the test's browser cannot paste from the system's).
	await page.evaluate(() => {
		const keep = (event: ClipboardEvent) => ((window as unknown as { taken: string }).taken = event.clipboardData?.getData('text/plain') ?? '');
		window.addEventListener('copy', keep);
		window.addEventListener('cut', keep);
	});
	const taken = () => page.evaluate(() => (window as unknown as { taken?: string }).taken ?? '');
	await caretIn(page, '甲段落。', 0.5);
	await page.keyboard.press('ControlOrMeta+c');
	await expect(ranges(page)).toHaveText(['甲段落。']);
	expect(await taken()).toContain('甲段落。');
	await caretIn(page, '乙段落。', 0.5);
	await page.keyboard.press('ControlOrMeta+x');
	await expect(editor(page).getByText('乙段落。', { exact: true })).toHaveCount(0);
	expect(await taken()).toContain('乙段落。');
	await expect(editor(page).getByText('甲段落。', { exact: true })).toHaveCount(1);
});

test('⇧↑ takes the selection to the start of the line, then makes it blocks, then grows them', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落比甲长一点。\n');
	await openStudio(page);
	await caretIn(page, '乙段落比甲长一点。', 0.5);
	await page.keyboard.press('Shift+ArrowUp');
	await expect(ranges(page)).toHaveCount(0);
	expect(await page.evaluate(() => getSelection()?.toString())).toMatch(/^乙段落/u);
	await page.keyboard.press('Shift+ArrowUp');
	await expect(ranges(page)).toHaveText(['乙段落比甲长一点。']);
	await page.keyboard.press('Shift+ArrowUp');
	await expect(ranges(page)).toHaveText(['甲段落。', '乙段落比甲长一点。']);
});

test('the slash menu works in a list item, its pick taking the line out of the list', async ({ page }) => {
	appendToFixture('\n- 第一项\n- 第二项\n');
	await openStudio(page);
	await caretIn(page, '第二项', 0.99);
	await page.keyboard.press(mac ? 'Meta+ArrowRight' : 'End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/bt2');
	await expect(page.locator('.milkdown-slash-menu')).toBeVisible();
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await page.keyboard.type('小节');
	await expect(editor(page).locator('> h2', { hasText: '小节' })).toHaveCount(1);
	await expect(editor(page).locator('li h2')).toHaveCount(0);
});

test('↓ from the line above a toggle goes into its title, ↓ again into it, ↑ back to the title and above', async ({ page }) => {
	appendToFixture('\n上一行。\n\n<details>\n<summary>推导</summary>\n\n第一步。\n\n</details>\n');
	await openStudio(page);
	const title = page.locator('.toggle-summary').last();
	await caretIn(page, '上一行。', 0.5);
	await page.keyboard.press('ArrowDown');
	await expect(title).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.type('甲');
	await expect(editor(page).locator('.toggle-body p', { hasText: /甲/u })).toHaveCount(1);
	await page.keyboard.press('ArrowUp');
	await expect(title).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await page.keyboard.type('乙');
	await expect(editor(page).getByText('上一行。乙', { exact: true })).toBeVisible();
});

test('the arrows go through a figure: the picture, its caption, the line under it, and back', async ({ page }) => {
	appendToFixture('\n上一行。\n\n![图注文字](./img/none.png)\n\n下一行。\n');
	await openStudio(page);
	const caption = page.locator('.pm-figure-caption').last();
	await caretIn(page, '下一行。', 0.5);
	await page.keyboard.press('ArrowUp');
	await expect(caption).toBeFocused();
	await page.keyboard.press('ArrowUp');
	// Out of the caption, onto the picture (the editor's).
	expect(await page.evaluate(() => document.activeElement?.classList.contains('ProseMirror'))).toBe(true);
	await page.keyboard.press('ArrowDown');
	await expect(caption).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.type('丙');
	await expect(editor(page).getByText('丙下一行。', { exact: true })).toBeVisible();
});

test('↑ and ↓ through code keep the caret about as far across as it was', async ({ page }) => {
	appendToFixture('\n上面一行文字比较长ABCDEFGHIJ。\n\n```js\nlet alpha = 100000;\nlet beta = 200000;\n```\n\n下面一行文字比较长ABCDEFGHIJ。\n');
	await openStudio(page);
	await caretIn(page, '下面一行文字比较长ABCDEFGHIJ。', 0.4);
	await page.keyboard.press('ArrowUp');
	await page.keyboard.type('Z');
	const code = editor(page).locator('.cm-content').last();
	await expect(code).toContainText('Z');
	const lastLine = await code.locator('.cm-line').last().textContent();
	const z = lastLine!.indexOf('Z');
	expect(z).toBeGreaterThan(2);
	expect(z).toBeLessThan(lastLine!.length - 3);
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');
	await page.keyboard.type('Y');
	const above = (await editor(page).locator('p', { hasText: '上面一行' }).textContent())!;
	const y = above.indexOf('Y');
	expect(y).toBeGreaterThan(2);
	expect(y).toBeLessThan(above.length - 3);
});
