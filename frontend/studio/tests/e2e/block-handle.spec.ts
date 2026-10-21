import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Where the block handle is as the pointer goes about, as SiYuan has it: in the room around blocks it
// stays where it is, with a button held there is none, with blocks selected it is only theirs.

test.beforeEach(() => resetFixture());

const handle = (page: Page) => page.locator('.milkdown-block-handle');
const grip = (page: Page) => handle(page).locator('.operation-item').last();

/** The handle is shown level with `box` (the block it is on). */
async function expectHandleAt(page: Page, box: { y: number; height: number }) {
	await expect(handle(page)).toHaveAttribute('data-show', 'true');
	await expect.poll(async () => Math.abs(((await grip(page).boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
}

test('in the gap between columns, and beside the items of a list, the handle stays on the block it was on', async ({ page }) => {
	appendToFixture('\n<div class="columns">\n<div>\n\n左栏甲\n\n左栏乙\n\n</div>\n<div>\n\n右栏\n\n</div>\n</div>\n\n- 第一项\n- 第二项\n');
	await openStudio(page);
	const left = editor(page).getByText('左栏乙', { exact: true });
	await left.scrollIntoViewIfNeeded();
	const leftBox = (await left.boundingBox())!;
	const right = (await editor(page).getByText('右栏', { exact: true }).boundingBox())!;
	await page.mouse.move(leftBox.x + 20, leftBox.y + leftBox.height / 2);
	await expectHandleAt(page, leftBox);
	// Into the gap at the second line's height (not the strip that makes a column wider): no block there, the handle stays.
	await page.mouse.move(right.x - 20, leftBox.y + leftBox.height / 2, { steps: 4 });
	await expectHandleAt(page, leftBox);
	await expect(editor(page).locator('.columns-block')).not.toHaveClass(/is-over-gap/u);

	// The marker of a list's first item: that item, not the whole list.
	const first = (await editor(page).locator('li', { hasText: '第一项' }).boundingBox())!;
	await page.mouse.move(first.x + 4, first.y + first.height / 2);
	await expectHandleAt(page, first);
	const item = (await editor(page).getByText('第一项', { exact: true }).boundingBox())!;
	await page.mouse.move(item.x + 20, item.y + item.height / 2);
	await expectHandleAt(page, first);
});

test('with the button held (text being selected) there is no handle; let go, it is back at once', async ({ page }) => {
	appendToFixture('\n一段可以选中的文字。\n\n下一段。\n');
	await openStudio(page);
	const text = editor(page).getByText('一段可以选中的文字。', { exact: true });
	await text.scrollIntoViewIfNeeded();
	const box = (await text.boundingBox())!;
	await page.mouse.move(box.x + 10, box.y + box.height / 2);
	await expectHandleAt(page, box);
	await page.mouse.down();
	await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 4 });
	await expect(handle(page)).toHaveAttribute('data-show', 'false');
	await page.mouse.up();
	await expectHandleAt(page, box);
});

test('with blocks selected, the handle is only on them', async ({ page }) => {
	appendToFixture('\n甲段。\n\n乙段。\n\n丙段。\n');
	await openStudio(page);
	await editor(page).getByText('丙段。', { exact: true }).scrollIntoViewIfNeeded();
	await editor(page).getByText('甲段。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段。', '乙段。']);
	const yi = (await editor(page).getByText('乙段。', { exact: true }).boundingBox())!;
	await page.mouse.move(yi.x + 20, yi.y + yi.height / 2);
	await expectHandleAt(page, yi);
	const bing = (await editor(page).getByText('丙段。', { exact: true }).boundingBox())!;
	await page.mouse.move(bing.x + 20, bing.y + bing.height / 2);
	await expect(handle(page)).toHaveAttribute('data-show', 'false');
});
