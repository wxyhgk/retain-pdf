import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// A block dragged by its handle with the mouse, and what is left after it is let go.

test.beforeEach(() => resetFixture());

test('a block dropped elsewhere: the caret at its end, nothing left selected, no handle where it was', async ({ page }) => {
	appendToFixture('\n第一段可以拖动。\n\n第二段在这里。\n\n第三段在下面。\n');
	await openStudio(page);
	const first = editor(page).getByText('第一段可以拖动。', { exact: true });
	await editor(page).getByText('第三段在下面。', { exact: true }).scrollIntoViewIfNeeded();
	const box = (await first.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + box.height / 2);
	const handle = page.locator('.milkdown-block-handle');
	const grip = handle.locator('.operation-item').last();
	await expect.poll(async () => Math.abs(((await grip.boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
	const g = (await grip.boundingBox())!;
	const target = (await editor(page).getByText('第三段在下面。', { exact: true }).boundingBox())!;
	await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
	await page.mouse.down();
	await page.mouse.move(g.x + 10, g.y + 30, { steps: 5 });
	await page.mouse.move(target.x - 10, target.y + target.height + 2, { steps: 10 });
	await page.mouse.up();

	await expect(editor(page).locator('> p').filter({ hasText: /^第/u })).toHaveText(['第二段在这里。', '第三段在下面。', '第一段可以拖动。']);
	await expect(editor(page).locator('.ProseMirror-selectednode')).toHaveCount(0);
	await expect(handle).toHaveAttribute('data-show', 'false');
	await page.keyboard.type('接着写');
	await expect(editor(page).locator('> p').last()).toHaveText('第一段可以拖动。接着写');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/第二段在这里。\n\n第三段在下面。\n\n第一段可以拖动。接着写\n$/u);
});

test('a block dragged with the mouse to the right edge of another: the two side by side', async ({ page }) => {
	appendToFixture('\n左边这一段。\n\n拖到右边去。\n');
	await openStudio(page);
	const moving = editor(page).getByText('拖到右边去。', { exact: true });
	await moving.scrollIntoViewIfNeeded();
	const box = (await moving.boundingBox())!;
	await page.mouse.move(box.x + 20, box.y + box.height / 2);
	const grip = page.locator('.milkdown-block-handle .operation-item').last();
	await expect.poll(async () => Math.abs(((await grip.boundingBox())?.y ?? -100) - box.y)).toBeLessThan(box.height);
	const g = (await grip.boundingBox())!;
	const target = (await editor(page).getByText('左边这一段。', { exact: true }).boundingBox())!;
	await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
	await page.mouse.down();
	await page.mouse.move(g.x + 40, g.y - 10, { steps: 5 });
	await page.mouse.move(target.x + target.width - 12, target.y + target.height / 2, { steps: 12 });
	await expect(page.locator('.columns-drop-line')).toBeVisible();
	await page.mouse.up();
	await expect(editor(page).locator('.column')).toHaveText(['左边这一段。', '拖到右边去。']);
	await expect(page.locator('.columns-drop-line')).toHaveCount(0);
	await page.keyboard.type('！');
	await expect(editor(page).locator('.column').nth(1)).toHaveText('拖到右边去。！');
});

test('moving down past blocks, the handle stays shown, going from block to block, not out between them', async ({ page }) => {
	appendToFixture('\n第一段。\n\n第二段，长一点的文字。\n\n## 一个标题\n\n- 列表一\n- 列表二\n\n最后一段。\n');
	await openStudio(page);
	const first = editor(page).getByText('第一段。', { exact: true });
	await editor(page).getByText('最后一段。', { exact: true }).scrollIntoViewIfNeeded();
	const a = (await first.boundingBox())!;
	const last = (await editor(page).getByText('最后一段。', { exact: true }).boundingBox())!;
	const handle = page.locator('.milkdown-block-handle');
	await page.mouse.move(a.x + 40, a.y + 4);
	await expect(handle).toHaveAttribute('data-show', 'true');
	for (let y = a.y + 4; y <= last.y + last.height; y += 6) {
		await page.mouse.move(a.x + 40, y);
		await page.waitForTimeout(16);
		expect(await handle.getAttribute('data-show'), `at ${y}`).toBe('true');
	}
	await expect.poll(async () => Math.abs((await handle.boundingBox())!.y - last.y)).toBeLessThan(last.height);
});

test('in columns, the way from a block on the right to its handle keeps the handle there', async ({ page }) => {
	appendToFixture('\n<div class="columns">\n<div>\n\n左栏一。\n\n</div>\n<div>\n\n右栏一。\n\n</div>\n</div>\n');
	await openStudio(page);
	const right = editor(page).getByText('右栏一。', { exact: true });
	await right.scrollIntoViewIfNeeded();
	const r = (await right.boundingBox())!;
	const handle = page.locator('.milkdown-block-handle');
	await page.mouse.move(r.x + 20, r.y + r.height / 2);
	await expect.poll(async () => Math.abs((await handle.boundingBox())!.x + (await handle.boundingBox())!.width - r.x)).toBeLessThan(12);
	const there = (await handle.boundingBox())!;
	for (let x = r.x; x >= there.x + there.width / 2; x -= 4) {
		await page.mouse.move(x, r.y + r.height / 2);
		await page.waitForTimeout(16);
	}
	expect((await handle.boundingBox())!.x).toBe(there.x);
	await expect(handle).toHaveCSS('opacity', '1');
	// Pressed there, it is that block's: it is selected, its menu opens.
	await page.mouse.down();
	await page.mouse.up();
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['右栏一。']);
});

test('the handle selects as Esc does; in blocks selected already, it keeps them all', async ({ page }) => {
	appendToFixture('\n甲段。\n\n乙段。\n\n丙段。\n');
	await openStudio(page);
	const jia = editor(page).getByText('甲段。', { exact: true });
	await editor(page).getByText('丙段。', { exact: true }).scrollIntoViewIfNeeded();
	const handle = page.locator('.milkdown-block-handle');
	const grip = handle.locator('.operation-item').last();
	const pressHandleOf = async (text: string) => {
		const b = (await editor(page).getByText(text, { exact: true }).boundingBox())!;
		await page.mouse.move(b.x + 20, b.y + b.height / 2);
		await expect.poll(async () => Math.abs((await grip.boundingBox())!.y - b.y)).toBeLessThan(b.height);
		const g = (await grip.boundingBox())!;
		await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
	};
	// One kind of selected block: the same gray as Esc gives, not another.
	await pressHandleOf('乙段。');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['乙段。']);
	await expect(editor(page).locator('.ProseMirror-selectednode')).toHaveCount(0);
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
	await page.keyboard.press('Escape');

	// Two blocks selected (Esc, ⇧↓); the handle of one of them: both stay selected, the menu is for them.
	await jia.click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段。', '乙段。']);
	await pressHandleOf('乙段。');
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段。', '乙段。']);
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
});

test('blocks selected, dragged by the handle of one of them: they all move', async ({ page }) => {
	appendToFixture('\n甲段。\n\n乙段。\n\n丙段。\n');
	await openStudio(page);
	await editor(page).getByText('丙段。', { exact: true }).scrollIntoViewIfNeeded();
	await editor(page).getByText('甲段。', { exact: true }).click();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Shift+ArrowDown');
	const yi = (await editor(page).getByText('乙段。', { exact: true }).boundingBox())!;
	await page.mouse.move(yi.x + 20, yi.y + yi.height / 2);
	const grip = page.locator('.milkdown-block-handle .operation-item').last();
	await expect.poll(async () => Math.abs((await grip.boundingBox())!.y - yi.y)).toBeLessThan(yi.height);
	const g = (await grip.boundingBox())!;
	const bing = (await editor(page).getByText('丙段。', { exact: true }).boundingBox())!;
	await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
	await page.mouse.down();
	await page.mouse.move(g.x + 10, g.y + 30, { steps: 5 });
	await page.mouse.move(bing.x - 10, bing.y + bing.height + 2, { steps: 10 });
	await page.mouse.up();
	await expect(editor(page).locator('> p').filter({ hasText: /^[甲乙丙]段/u })).toHaveText(['丙段。', '甲段。', '乙段。']);
});

test('left of the handle there is room to drag and select blocks', async ({ page }) => {
	appendToFixture('\n甲段。\n\n乙段。\n\n丙段。\n');
	await openStudio(page);
	await editor(page).getByText('丙段。', { exact: true }).scrollIntoViewIfNeeded();
	const jia = (await editor(page).getByText('甲段。', { exact: true }).boundingBox())!;
	const bing = (await editor(page).getByText('丙段。', { exact: true }).boundingBox())!;
	await page.mouse.move(jia.x + 20, jia.y + jia.height / 2);
	const handle = (await page.locator('.milkdown-block-handle').boundingBox())!;
	// Left of the handle, still in the editor's margin.
	const x = handle.x - 12;
	expect(x).toBeGreaterThan((await page.locator('.editor-scroll').boundingBox())!.x + 4);
	await page.mouse.move(x, jia.y + 4);
	await page.mouse.down();
	await page.mouse.move(x, bing.y + bing.height - 4, { steps: 8 });
	await page.mouse.up();
	await expect(editor(page).locator('.pm-block-range')).toHaveText(['甲段。', '乙段。', '丙段。']);
});
