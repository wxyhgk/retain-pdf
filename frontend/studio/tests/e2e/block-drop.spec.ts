import { expect, test, type JSHandle, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// A drag from a block's handle, as SiYuan has it: the handle out of the way while dragging, the box scrolled
// near its edges, a line only where a drop does something, and nothing of the drag left after it.

test.beforeEach(() => resetFixture());

const grip = (page: Page) => page.locator('.milkdown-block-handle .operation-item').last();

/** Starts dragging the block holding `text` by its handle, as the browser does (dragstart on the handle). */
async function startDrag(page: Page, text: string): Promise<JSHandle<DataTransfer>> {
	const block = editor(page).getByText(text, { exact: true });
	await block.scrollIntoViewIfNeeded();
	const box = (await block.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + box.height / 2);
	await expect.poll(async () => Math.abs(((await grip(page).boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
	const at = (await grip(page).boundingBox())!;
	await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
	await page.mouse.down();
	const data = await page.evaluateHandle(() => new DataTransfer());
	await grip(page).dispatchEvent('dragstart', { dataTransfer: data });
	return data;
}

async function dragOver(page: Page, data: JSHandle<DataTransfer>, x: number, y: number) {
	for (let step = 0; step < 3; step += 1) await editor(page).dispatchEvent('dragover', { dataTransfer: data, clientX: x, clientY: y });
}

async function dropAt(page: Page, data: JSHandle<DataTransfer>, x: number, y: number) {
	await dragOver(page, data, x, y);
	await editor(page).dispatchEvent('drop', { dataTransfer: data, clientX: x, clientY: y });
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	// Let go where the drop was: a drag ends in no click (on the handle, it would open its menu).
	await page.mouse.move(x, y);
	await page.mouse.up();
}

test('while a block is dragged its handle is out of the way; a drag let go of nowhere leaves nothing to move later', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	const data = await startDrag(page, '甲段落。');
	await expect(page.locator('.milkdown-block-handle')).toHaveAttribute('data-show', 'false');
	// Esc, or let go outside the editor: only the end of the drag.
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
	await page.waitForTimeout(100);

	// Text dropped in from elsewhere afterwards is that text, not the blocks of the drag given up.
	const bing = (await editor(page).getByText('丙段落。', { exact: true }).boundingBox())!;
	const text = await page.evaluateHandle(() => {
		const transfer = new DataTransfer();
		transfer.setData('text/plain', '外来的字');
		return transfer;
	});
	await editor(page).dispatchEvent('drop', { dataTransfer: text, clientX: bing.x + bing.width - 4, clientY: bing.y + bing.height / 2 });
	await expect(editor(page).getByText('外来的字')).toHaveCount(1);
	await expect(editor(page).locator('> p').filter({ hasText: /^[甲乙]段落/u })).toHaveText(['甲段落。', '乙段落。']);
});

test('blocks dropped: the caret after them, none of their text left highlighted', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	await editor(page).getByText('丙段落。', { exact: true }).scrollIntoViewIfNeeded();
	await editor(page).getByText('甲段落。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	const data = await startDrag(page, '乙段落。');
	const bing = (await editor(page).getByText('丙段落。', { exact: true }).boundingBox())!;
	await dropAt(page, data, bing.x - 20, bing.y + bing.height - 2);
	await expect(editor(page).locator('> p').filter({ hasText: /^[甲乙丙]段落/u })).toHaveText(['丙段落。', '甲段落。', '乙段落。']);
	expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(true);
	await page.keyboard.type('续');
	await expect(editor(page).getByText('乙段落。续', { exact: true })).toBeVisible();
});

test('no upright line beside the block dragged, nor beside columns full already', async ({ page }) => {
	const five = Array.from({ length: 5 }, (_, i) => `<div>\n\n栏${i + 1}\n\n</div>`).join('\n');
	appendToFixture(`\n甲段落。\n\n<div class="columns">\n${five}\n</div>\n\n乙段落。\n`);
	await openStudio(page);
	const data = await startDrag(page, '甲段落。');
	const jia = (await editor(page).getByText('甲段落。', { exact: true }).boundingBox())!;
	await dragOver(page, data, jia.x + jia.width - 10, jia.y + jia.height / 2);
	await expect(page.locator('.columns-drop-line')).toHaveCount(0);
	const last = (await editor(page).getByText('栏5', { exact: true }).boundingBox())!;
	await dragOver(page, data, last.x + last.width - 6, last.y + last.height / 2);
	await expect(page.locator('.columns-drop-line')).toHaveCount(0);
	// Beside a block that can have it: the line.
	const yi = (await editor(page).getByText('乙段落。', { exact: true }).boundingBox())!;
	await dragOver(page, data, yi.x + yi.width - 10, yi.y + yi.height / 2);
	await expect(page.locator('.columns-drop-line')).toBeVisible();
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
});

test('a drag held near the bottom of the editor scrolls it, and stops when it ends', async ({ page }) => {
	appendToFixture(`\n${Array.from({ length: 40 }, (_, i) => `第${i + 1}段。`).join('\n\n')}\n`);
	await openStudio(page);
	const scroller = page.locator('.editor-scroll');
	await editor(page).getByText('第1段。', { exact: true }).scrollIntoViewIfNeeded();
	const data = await startDrag(page, '第1段。');
	const box = (await scroller.boundingBox())!;
	const before = await scroller.evaluate((el) => el.scrollTop);
	await dragOver(page, data, box.x + box.width / 2, box.y + box.height - 6);
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 3000 }).toBeGreaterThan(before + 60);
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
	const stopped = await scroller.evaluate((el) => el.scrollTop);
	await page.waitForTimeout(300);
	expect(await scroller.evaluate((el) => el.scrollTop)).toBe(stopped);
});
