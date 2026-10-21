import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Selecting blocks from the margin, as SiYuan has it: the blocks are looked for at the inner edge of
// the box the drag spans, so a drag that stays in one callout or one column selects the blocks in it.

test.beforeEach(() => resetFixture());

const ranges = (page: Page) => editor(page).locator('.pm-block-range');

async function boxOf(page: Page, text: string) {
	const block = editor(page).getByText(text, { exact: true });
	await block.scrollIntoViewIfNeeded();
	return (await block.boundingBox())!;
}

/** Presses in the margin left of `from`, and drags to `x` of the way across `to`. */
async function dragFromMargin(page: Page, from: string, to: string, x = 0.3) {
	const start = await boxOf(page, from);
	const end = await boxOf(page, to);
	const margin = (await editor(page).boundingBox())!.x + 4;
	await page.mouse.move(margin, start.y + start.height / 2);
	await page.mouse.down();
	await page.mouse.move(end.x + end.width * x, end.y + end.height / 2, { steps: 8 });
	await page.mouse.up();
}

test('a drag from the margin that stays in a callout selects the blocks in it', async ({ page }) => {
	appendToFixture('\n上面的段落。\n\n> [!TIP]\n> 提示一\n>\n> 提示二\n>\n> 提示三\n');
	await openStudio(page);
	await dragFromMargin(page, '提示一', '提示二');
	await expect(ranges(page)).toHaveText(['提示一', '提示二']);
	// From outside it: the callout whole.
	await dragFromMargin(page, '上面的段落。', '提示二');
	await expect(ranges(page)).toHaveCount(2);
	await expect(ranges(page).last()).toContainText('提示三');
});

test('a drag that stays in a column selects the blocks in it; into the next column, the columns whole', async ({ page }) => {
	appendToFixture('\n<div class="columns">\n<div>\n\n左一\n\n左二\n\n</div>\n<div>\n\n右一\n\n右二\n\n</div>\n</div>\n');
	await openStudio(page);
	await dragFromMargin(page, '左一', '左二');
	await expect(ranges(page)).toHaveText(['左一', '左二']);
	await dragFromMargin(page, '左一', '右二');
	await expect(ranges(page)).toHaveCount(1);
	await expect(ranges(page)).toContainText('右二');
	await expect(ranges(page)).toContainText('左一');
});
