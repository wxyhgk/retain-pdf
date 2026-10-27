import { expect, test, type Locator, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Columns, as Notion has them: made from the slash menu, written as `<div class="columns">` around Markdown.

test.beforeEach(() => resetFixture());

const columns = (page: Page) => editor(page).locator('.columns');
const column = (page: Page, index: number) => columns(page).first().locator('> .column').nth(index);

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

const TWO = '<div class="columns">\n<div>\n\n左栏\n\n</div>\n<div>\n\n右栏\n\n- 一\n- 二\n\n</div>\n</div>\n';

test('两栏 from the slash menu: two columns side by side, the caret in the first; written as HTML around Markdown', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	// Found by what one calls it: 双栏 too.
	await page.keyboard.type('/双栏');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('两栏');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await expect(columns(page)).toHaveCount(1);
	await page.keyboard.type('左边');
	await expect(column(page, 0)).toHaveText('左边');
	await column(page, 1).click();
	await page.keyboard.type('## 右边');
	await expect(column(page, 1).locator('h2')).toHaveText('右边');
	// Side by side: the second column starts where the first does, to its right.
	const [left, right] = [(await column(page, 0).boundingBox())!, (await column(page, 1).boundingBox())!];
	expect(Math.abs(left.y - right.y)).toBeLessThan(2);
	expect(right.x).toBeGreaterThan(left.x + left.width);
	// The handle of a block in the right column fits in the gap, over none of the left column.
	await page.mouse.move(right.x + 30, right.y + right.height / 2);
	const handle = page.locator('.milkdown-block-handle');
	await expect.poll(async () => Math.abs(((await handle.boundingBox())?.y ?? -100) - right.y)).toBeLessThan(right.height);
	expect((await handle.boundingBox())!.x).toBeGreaterThanOrEqual(left.x + left.width);
	expect(await save(page)).toMatch(/结尾段落。\n\n<div class="columns">\n<div>\n\n左边\n\n<\/div>\n<div>\n\n## 右边\n\n<\/div>\n<\/div>\n$/u);
});

test('columns in the file are drawn as columns; an edit in one leaves the rest of the file as it was', async ({ page }) => {
	appendToFixture(`\n${TWO}`);
	await openStudio(page);
	await expect(column(page, 1).locator('li')).toHaveCount(2);
	await column(page, 0).getByText('左栏').click();
	await page.keyboard.press('End');
	await page.keyboard.type('（改）');
	expect(await save(page)).toContain(TWO.replace('左栏', '左栏（改）'));
});

test('⌫ in an empty column takes it away; with one left, its blocks are back in the article', async ({ page }) => {
	appendToFixture('\n<div class="columns">\n<div>\n\n甲\n\n</div>\n<div>\n\n</div>\n<div>\n\n丙\n\n</div>\n</div>\n');
	await openStudio(page);
	await expect(columns(page).locator('> .column')).toHaveCount(3);
	await column(page, 1).click();
	await page.keyboard.press('Backspace');
	await expect(columns(page).locator('> .column')).toHaveCount(2);
	// The caret went to the end of the column before.
	await page.keyboard.type('乙');
	await expect(column(page, 0)).toHaveText('甲乙');

	await column(page, 1).getByText('丙').click();
	await page.keyboard.press('End');
	for (let i = 0; i < 2; i += 1) await page.keyboard.press('Backspace');
	await expect(columns(page)).toHaveCount(0);
	const saved = await save(page);
	expect(saved).toMatch(/结尾段落。\n\n甲乙\n$/u);
});

/** Drags the block holding `text` by its handle and drops it at (x, y) of the page, as the browser would, step by step. */
async function dragBlock(page: Page, text: string, to: () => Promise<{ x: number; y: number }>, beforeDrop?: () => Promise<void>) {
	const block = editor(page).getByText(text, { exact: true });
	await block.scrollIntoViewIfNeeded();
	const box = (await block.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + box.height / 2);
	const grip = page.locator('.milkdown-block-handle .operation-item').last();
	// The handle comes to the block a moment after the pointer.
	await expect.poll(async () => Math.abs(((await grip.boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
	// The handle selects its block when pressed, before the drag starts.
	const at = (await grip.boundingBox())!;
	await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
	await page.mouse.down();
	const data = await page.evaluateHandle(() => new DataTransfer());
	await grip.dispatchEvent('dragstart', { dataTransfer: data });
	const { x, y } = await to();
	for (let step = 0; step < 3; step += 1) await editor(page).dispatchEvent('dragover', { dataTransfer: data, clientX: x, clientY: y });
	await beforeDrop?.();
	await editor(page).dispatchEvent('drop', { dataTransfer: data, clientX: x, clientY: y });
	await grip.dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
}

/** Near the right edge of the block holding `text`, at its middle. */
const rightEdgeOf = (page: Page, text: string) => async () => {
	const box = (await editor(page).locator('p', { hasText: text }).first().boundingBox())!;
	return { x: box.x + box.width - 10, y: box.y + box.height / 2 };
};

test('a block dropped on the right edge of another goes beside it: two columns, an upright line showing where', async ({ page }) => {
	appendToFixture('\n甲段落。\n\n乙段落。\n');
	await openStudio(page);
	await dragBlock(page, '乙段落。', rightEdgeOf(page, '甲段落'), async () => {
		await expect(page.locator('.columns-drop-line')).toBeVisible();
		// Not the line between blocks as well.
		await expect(page.locator('.crepe-drop-cursor')).toBeHidden();
	});
	await expect(page.locator('.columns-drop-line')).toHaveCount(0);
	await expect(column(page, 0)).toHaveText('甲段落。');
	await expect(column(page, 1)).toHaveText('乙段落。');
	expect(await save(page)).toMatch(/结尾段落。\n\n<div class="columns">\n<div>\n\n甲段落。\n\n<\/div>\n<div>\n\n乙段落。\n\n<\/div>\n<\/div>\n$/u);

	// Dropped beside a block in the columns: a third column there.
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await dragBlock(page, '结尾段落。', rightEdgeOf(page, '甲段落'));
	await expect(columns(page).locator('> .column')).toHaveText(['甲段落。', '结尾段落。', '乙段落。']);
});

test('the block of a column dragged out leaves no empty column behind', async ({ page }) => {
	appendToFixture('\n<div class="columns">\n<div>\n\n甲\n\n</div>\n<div>\n\n乙\n\n</div>\n</div>\n\n尾段。\n');
	await openStudio(page);
	await dragBlock(page, '甲', async () => {
		const box = (await editor(page).getByText('尾段。', { exact: true }).boundingBox())!;
		// In the margin left of the blocks, where a drag from the handle is.
		return { x: box.x - 20, y: box.y + box.height - 2 };
	});
	await expect(columns(page)).toHaveCount(0);
	expect(await save(page)).toMatch(/结尾段落。\n\n乙\n\n尾段。\n\n甲\n$/u);
});

test('the gap between two columns is dragged to make one wider; ＋ adds a column', async ({ page }) => {
	appendToFixture(`\n${TWO}`);
	await openStudio(page);
	await columns(page).scrollIntoViewIfNeeded();
	const left = (await column(page, 0).boundingBox())!;
	const right = (await column(page, 1).boundingBox())!;
	// The strip at the gap's left resizes; the rest of the gap is for the handle of the block on the right.
	const gap = { x: left.x + left.width + 4, y: left.y + 10 };
	await page.mouse.move(gap.x, gap.y);
	await expect(editor(page).locator('.columns-block')).toHaveClass(/is-over-gap/u);
	await page.mouse.down();
	await page.mouse.move(gap.x + 120, gap.y, { steps: 6 });
	await page.mouse.up();
	const wider = (await column(page, 0).boundingBox())!;
	expect(wider.width).toBeGreaterThan(left.width + 100);
	const saved = await save(page);
	expect(saved).toMatch(/<div class="columns">\n<div style="flex: 1\.\d+">\n\n左栏\n\n<\/div>\n<div style="flex: 0\.\d+">\n\n右栏/u);

	await editor(page).locator('.columns-block').hover();
	await editor(page).locator('.columns-add').click();
	await expect(columns(page).locator('> .column')).toHaveCount(3);
	await page.keyboard.type('第三栏');
	await expect(column(page, 2)).toHaveText('第三栏');
	// The new column is as wide as they are on average: a share of one, which is not written.
	expect(await save(page)).toMatch(/<\/div>\n<div>\n\n第三栏\n\n<\/div>\n<\/div>\n$/u);
});

// Blocks that take their own events (code, a widget's frame, a chemistry block) go into columns as any other: the drag
// is followed over them, the events where the browser sends them (on what is under the pointer).

/** Drags `block` by its handle and drops it at (x, y), the events at the element there, as the browser sends them. */
async function dragAt(page: Page, block: Locator, to: () => Promise<{ x: number; y: number }>) {
	await block.scrollIntoViewIfNeeded();
	const box = (await block.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + Math.min(20, box.height / 2));
	const grip = page.locator('.milkdown-block-handle .operation-item').last();
	await expect.poll(async () => Math.abs(((await grip.boundingBox())?.y ?? -1000) - box.y)).toBeLessThan(Math.max(40, box.height));
	const at = (await grip.boundingBox())!;
	await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
	await page.mouse.down();
	const data = await page.evaluateHandle(() => new DataTransfer());
	await grip.dispatchEvent('dragstart', { dataTransfer: data });
	const { x, y } = await to();
	const fire = (type: string) => page.evaluate(([type, x, y, data]) => {
		const target = document.elementFromPoint(x as number, y as number)!;
		const event = new DragEvent(type as string, { bubbles: true, cancelable: true, clientX: x as number, clientY: y as number, dataTransfer: data as DataTransfer });
		target.dispatchEvent(event);
		return target.className;
	}, [type, x, y, data] as const);
	let over = '';
	for (let step = 0; step < 3; step += 1) over = await fire('dragover');
	const line = await page.locator('.columns-drop-line').isVisible();
	await fire('drop');
	await grip.dispatchEvent('dragend', { dataTransfer: data });
	await page.mouse.up();
	return { over, line };
}
const right = (locator: Locator) => async () => {
	await locator.scrollIntoViewIfNeeded();
	const box = (await locator.boundingBox())!;
	return { x: box.x + box.width - 10, y: box.y + Math.min(30, box.height / 2) };
};

test('code, a widget and a chemistry block go beside a line, and a line beside them', async ({ page }) => {
	appendToFixture('\n```python\nprint(1)\n```\n\n```widget title="小" height=160\n<p>hi</p>\n```\n\n乙段落。\n\n丙段落。\n');
	await openStudio(page);
	const code = editor(page).locator('.milkdown-code-block').filter({ hasText: 'print(1)' });
	const widget = editor(page).locator('.milkdown-code-block').filter({ has: page.locator('.note-widget, iframe') }).last();
	const line = (text: string) => editor(page).getByText(text, { exact: true });
	// A line onto the right edge of code: beside it.
	expect((await dragAt(page, line('乙段落。'), right(code))).line).toBe(true);
	await expect(columns(page)).toHaveCount(1);
	await expect(columns(page).locator('> .column').last()).toHaveText('乙段落。');
	// A line onto the right edge of a widget: beside it.
	expect((await dragAt(page, line('丙段落。'), right(widget))).line).toBe(true);
	await expect(columns(page)).toHaveCount(2);
	// A chemistry block's edge too.
	expect((await dragAt(page, line('结尾段落。'), right(editor(page).locator('.science-block').first()))).line).toBe(true);
	await expect(columns(page)).toHaveCount(3);
});
