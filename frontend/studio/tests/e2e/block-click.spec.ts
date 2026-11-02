import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Clicks with blocks selected, and presses among the blocks, as SiYuan has them: one press puts the caret,
// a drag among the blocks selects text, only the margin selects blocks.

test.beforeEach(() => resetFixture());

const ranges = (page: Page) => editor(page).locator('.pm-block-range');

async function selectFirstTwo(page: Page) {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	await editor(page).getByText('丙段落。', { exact: true }).scrollIntoViewIfNeeded();
	await editor(page).getByText('甲段落。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(ranges(page)).toHaveText(['甲段落。', '乙段落。']);
}

/** A point on the text of the paragraph `text`, `at` of the way along it. */
async function onText(page: Page, text: string, at: number) {
	const box = await editor(page)
		.getByText(text, { exact: true })
		.evaluate((p) => {
			const range = document.createRange();
			range.selectNodeContents(p);
			const r = range.getBoundingClientRect();
			return { x: r.x, y: r.y, width: r.width, height: r.height };
		});
	return { x: box.x + box.width * at, y: box.y + box.height / 2 };
}

test('blocks selected: one click in the text, and what is typed goes there at once', async ({ page }) => {
	await selectFirstTwo(page);
	// In one of the selected blocks: the selection is let go of, nothing typed replaces the blocks.
	const inYi = await onText(page, '乙段落。', 0.99);
	await page.mouse.click(inYi.x, inYi.y);
	await page.keyboard.type('好');
	await expect(ranges(page)).toHaveCount(0);
	await expect(editor(page).getByText('乙段落。好', { exact: true })).toBeVisible();
	await expect(editor(page).getByText('甲段落。', { exact: true })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(ranges(page)).toHaveText(['乙段落。好']);
	const inBing = await onText(page, '丙段落。', 0.99);
	await page.mouse.click(inBing.x, inBing.y);
	await page.keyboard.type('也');
	await expect(editor(page).getByText('丙段落。也', { exact: true })).toBeVisible();
});

test('blocks selected, ⇧-click on another block takes the selection to it', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	await editor(page).getByText('甲段落。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(ranges(page)).toHaveText(['甲段落。']);
	const bing = await onText(page, '丙段落。', 0.5);
	await page.keyboard.down('Shift');
	await page.mouse.click(bing.x, bing.y);
	await page.keyboard.up('Shift');
	await expect(ranges(page)).toHaveText(['甲段落。', '乙段落。', '丙段落。']);
});

test('a drag that starts beside a short line selects text; from the margin, blocks', async ({ page }) => {
	appendToFixture('\n短的一行。\n\n下面一行。\n');
	await openStudio(page);
	await editor(page).getByText('下面一行。', { exact: true }).scrollIntoViewIfNeeded();
	const short = (await editor(page).getByText('短的一行。', { exact: true }).boundingBox())!;
	const below = await onText(page, '下面一行。', 0.5);
	await page.mouse.move(short.x + short.width - 40, short.y + short.height / 2);
	await page.mouse.down();
	await page.mouse.move(below.x, below.y, { steps: 6 });
	await page.mouse.up();
	await expect(ranges(page)).toHaveCount(0);
	expect(await page.evaluate(() => getSelection()?.toString())).toContain('下面');

	// Left of the handle (which is pressed to drag the block).
	await page.mouse.move(short.x - 80, short.y + short.height / 2);
	await page.mouse.down();
	await page.mouse.move(short.x - 80, below.y, { steps: 6 });
	await page.mouse.up();
	await expect(ranges(page)).toHaveText(['短的一行。', '下面一行。']);
});

test('a click on the handle leaves the focus in the menu it opens', async ({ page }) => {
	appendToFixture('\n一段。\n');
	await openStudio(page);
	await editor(page).getByText('一段。', { exact: true }).scrollIntoViewIfNeeded();
	const block = (await editor(page).getByText('一段。', { exact: true }).boundingBox())!;
	await page.mouse.move(block.x + 10, block.y + block.height / 2);
	const grip = page.locator('.milkdown-block-handle .operation-item').last();
	await expect.poll(async () => Math.abs(((await grip.boundingBox())?.y ?? -100) - block.y)).toBeLessThan(block.height);
	const g = (await grip.boundingBox())!;
	await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
	const menu = page.locator('.milkdown-block-menu');
	await expect(menu).toHaveAttribute('data-show', 'true');
	// A frame or two later, still there (the editor took it back before).
	await page.waitForTimeout(100);
	expect(await menu.evaluate((m) => m.contains(document.activeElement))).toBe(true);
	await expect(ranges(page)).toHaveText(['一段。']);
});
