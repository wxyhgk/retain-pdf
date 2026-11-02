import { expect, test, type JSHandle, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// What is left of SiYuan's drag and handle, done: ⌥ copies beside too, no drop that makes an odd
// document, an ordered item stays numbered, the line in the middle of a gap, the handle's block
// marked, a right click opens the menu, a block in a quote or a callout's first line has a handle of
// its own, and selecting from the margin scrolls while held at the edge.

test.beforeEach(() => resetFixture());

const grip = (page: Page) => page.locator('.milkdown-block-handle .operation-item').last();
const mac = process.platform === 'darwin';

/** Whether the mark of the handle's block is over the block holding `text`. */
async function marked(page: Page, text: string) {
	const mark = await page.locator('.milkdown-block-handle-target').boundingBox();
	const block = await editor(page).getByText(text, { exact: true }).boundingBox();
	return Boolean(mark && block && Math.abs(mark.y - block.y) < 2 && Math.abs(mark.height - block.height) < 2);
}

async function handleOf(page: Page, text: string) {
	const block = editor(page).getByText(text, { exact: true });
	await block.scrollIntoViewIfNeeded();
	const box = (await block.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + box.height / 2);
	await expect.poll(async () => Math.abs(((await grip(page).boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
	return box;
}

async function startDrag(page: Page, text: string): Promise<JSHandle<DataTransfer>> {
	await handleOf(page, text);
	const at = (await grip(page).boundingBox())!;
	await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
	await page.mouse.down();
	const data = await page.evaluateHandle(() => new DataTransfer());
	await grip(page).dispatchEvent('dragstart', { dataTransfer: data });
	return data;
}

async function dropAt(page: Page, data: JSHandle<DataTransfer>, x: number, y: number, copy = false) {
	const keys = copy ? (mac ? { altKey: true } : { ctrlKey: true }) : {};
	for (let step = 0; step < 3; step += 1) await editor(page).dispatchEvent('dragover', { dataTransfer: data, clientX: x, clientY: y, ...keys });
	await editor(page).dispatchEvent('drop', { dataTransfer: data, clientX: x, clientY: y, ...keys });
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.move(x, y);
	await page.mouse.up();
}

test('⌥ held, a block dropped beside another is a copy: the columns hold both, the block stays where it was', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n');
	await openStudio(page);
	const data = await startDrag(page, '甲段落。');
	const yi = (await editor(page).getByText('乙段落。', { exact: true }).boundingBox())!;
	await dropAt(page, data, yi.x + yi.width - 10, yi.y + yi.height / 2, true);
	await expect(editor(page).locator('.columns-block .column')).toHaveText(['乙段落。', '甲段落。']);
	await expect(editor(page).locator('> p', { hasText: /^甲段落。$/u })).toHaveCount(1);
});

test('a paragraph is not dropped between the rows of a table', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n| 头一 | 头二 |\n| --- | --- |\n| 一 | 二 |\n| 三 | 四 |\n');
	await openStudio(page);
	const rows = editor(page).locator('table tr');
	await expect(rows).toHaveCount(3);
	const data = await startDrag(page, '甲段落。');
	const second = (await rows.nth(1).boundingBox())!;
	await dropAt(page, data, second.x + second.width / 2, second.y + second.height - 1);
	await expect(rows).toHaveCount(3);
	await expect(editor(page).locator('table').first()).not.toContainText('甲段落');
});

test('an item of an ordered list dragged out of it stays numbered', async ({ page }) => {
	appendToFixture('\n1. 一项\n2. 二项\n\n结束段。\n');
	await openStudio(page);
	const data = await startDrag(page, '二项');
	const end = (await editor(page).getByText('结束段。', { exact: true }).boundingBox())!;
	await dropAt(page, data, end.x + end.width / 2, end.y + end.height - 1);
	await expect(editor(page).locator('ol', { hasText: '二项' })).toHaveCount(1);
	await expect(editor(page).locator('ul', { hasText: '二项' })).toHaveCount(0);
	const list = (await editor(page).locator('ol', { hasText: '二项' }).boundingBox())!;
	expect(list.y).toBeGreaterThan(end.y);
});

test('the line between two blocks is in the middle of the gap between them', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	const data = await startDrag(page, '丙段落。');
	const jia = (await editor(page).getByText('甲段落。', { exact: true }).boundingBox())!;
	const yi = (await editor(page).getByText('乙段落。', { exact: true }).boundingBox())!;
	for (let step = 0; step < 3; step += 1) await editor(page).dispatchEvent('dragover', { dataTransfer: data, clientX: jia.x + jia.width / 2, clientY: jia.y + jia.height + 1 });
	const line = page.locator('.milkdown-drop-indicator');
	await expect(line).toBeVisible();
	const middle = (jia.y + jia.height + yi.y) / 2;
	await expect.poll(async () => Math.abs(((await line.boundingBox())?.y ?? 0) - middle)).toBeLessThan(3);
	await grip(page).dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
});

test('the pointer on a handle marks its block; a right click on it opens the menu', async ({ page }) => {
	appendToFixture('\n甲段落。\n');
	await openStudio(page);
	await handleOf(page, '甲段落。');
	await grip(page).hover();
	await expect.poll(() => marked(page, '甲段落。')).toBe(true);
	await grip(page).click({ button: 'right' });
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
	await page.keyboard.press('Escape');
	await page.mouse.move(10, 10);
	await expect(page.locator('.milkdown-block-handle-target')).toHaveCount(0);
});

test('a right click on blocks selected opens their menu', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n');
	await openStudio(page);
	await editor(page).getByText('甲段落。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await editor(page).getByText('乙段落。', { exact: true }).click({ button: 'right' });
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
	await page.locator('.milkdown-block-menu [data-key="delete"]').click();
	await expect(editor(page).locator('> p', { hasText: /^[甲乙]段落。$/u })).toHaveCount(0);
});

test('a block in a quote, and the first line of a callout, have a handle of their own', async ({ page }) => {
	appendToFixture('\n> 引一\n>\n> 引二\n\n> [!TIP]\n> 提示第一行\n>\n> 提示第二行\n');
	await openStudio(page);
	const box = await handleOf(page, '引二');
	expect(Math.abs((await grip(page).boundingBox())!.y - box.y)).toBeLessThan(box.height);
	await grip(page).hover();
	await expect.poll(() => marked(page, '引二')).toBe(true);

	await handleOf(page, '提示第一行');
	await grip(page).hover();
	await expect.poll(() => marked(page, '提示第一行')).toBe(true);
});

test('selecting blocks from the margin scrolls while the pointer is held at the bottom edge', async ({ page }) => {
	appendToFixture(`\n${Array.from({ length: 40 }, (_, i) => `第${i + 1}段。`).join('\n\n')}\n`);
	await openStudio(page);
	const scroller = page.locator('.editor-scroll');
	const first = editor(page).getByText('第1段。', { exact: true });
	await first.scrollIntoViewIfNeeded();
	const at = (await first.boundingBox())!;
	const box = (await scroller.boundingBox())!;
	await page.mouse.move(at.x - 80, at.y + at.height / 2);
	await page.mouse.down();
	await page.mouse.move(at.x - 80, box.y + box.height - 4, { steps: 6 });
	const before = await scroller.evaluate((el) => el.scrollTop);
	// Held still there: it goes on scrolling, and the selection with it.
	await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 3000 }).toBeGreaterThan(before + 150);
	await page.mouse.up();
	expect(await editor(page).locator('.pm-block-range').count()).toBeGreaterThan(8);
});
