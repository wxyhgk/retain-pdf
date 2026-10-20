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
