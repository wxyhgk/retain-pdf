import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, saveStatus, savedMarkdown, writeArticle } from './studio.ts';

// As Notion has them: a link opens with a click (a web address in the browser, a page here) and, pointed at, says
// where it goes with 编辑 beside it; a table's columns are made wider or narrower by dragging their edges, the widths
// kept in a comment before the table (`<!-- colwidths: … -->`).

test.beforeEach(() => resetFixture());

const preview = (page: Page) => page.locator('.milkdown-link-preview[data-show="true"]');

test('a link opens with a click: a web address in a new window (the browser), an article here', async ({ page }) => {
	await page.context().route(/example\.com/u, (route) => route.fulfill({ body: 'example' }));
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-01-01\n---\n\n另一篇的正文。\n');
	appendToFixture('\n去 [示例网站](https://example.com/page) 看看，或者 [另一篇](/blog/other-note/)。\n');
	await openStudio(page);
	const web = editor(page).locator('a', { hasText: '示例网站' });
	await web.scrollIntoViewIfNeeded();

	// Pointed at: the hand, and where it goes, copy, 编辑.
	await expect(web).toHaveCSS('cursor', 'pointer');
	await web.hover();
	await expect(preview(page).locator('.link-display')).toHaveText('https://example.com/page');
	await expect(preview(page).locator('.link-copy-button')).toBeVisible();
	await expect(preview(page).locator('.link-edit-button')).toHaveText('编辑');

	const opened = page.waitForEvent('popup');
	await web.click();
	expect((await opened).url()).toBe('https://example.com/page');

	await page.mouse.move(5, 500);
	await editor(page).locator('a', { hasText: '另一篇' }).click();
	await expect(page).toHaveURL(/article=other-note/u);
});

test('编辑 in the link preview changes where it goes', async ({ page }) => {
	appendToFixture('\n去 [示例网站](https://example.com/page) 看看。\n');
	await openStudio(page);
	const web = editor(page).locator('a', { hasText: '示例网站' });
	await web.scrollIntoViewIfNeeded();
	await web.hover();
	await preview(page).locator('.link-edit-button').click();
	const field = page.locator('.milkdown-link-edit[data-show="true"] input');
	await expect(field).toHaveValue('https://example.com/page');
	await field.fill('https://example.org/');
	await field.press('Enter');
	await expect(web).toHaveAttribute('href', 'https://example.org/');
	// Back in the article, to go on writing.
	await expect(editor(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('[示例网站](https://example.org/)');
});

const TABLE = '| 名字 | 说明 | 数 |\n| --- | --- | --- |\n| 甲 | 很长很长很长很长很长的说明文字 | 1 |\n| 乙 | 短 | 2 |\n';

test('a column dragged at its edge is made narrower; the widths are saved before the table and kept when it is opened again', async ({ page }) => {
	appendToFixture(`\n${TABLE}`);
	await openStudio(page);
	const table = editor(page).locator('.milkdown-table-block table.children');
	await table.scrollIntoViewIfNeeded();
	const second = table.locator('th').nth(1);
	const box = (await second.boundingBox())!;
	// Near the right edge of 说明, below the header (the column's handle shows there).
	await page.mouse.move(box.x + box.width - 20, box.y + box.height + 20, { steps: 3 });
	await page.mouse.move(box.x + box.width - 2, box.y + box.height + 20, { steps: 3 });
	const handle = page.locator('.column-width-handle[data-show="true"]');
	await expect(handle).toBeVisible();
	const at = (await handle.boundingBox())!;
	await page.mouse.move(at.x + at.width / 2, at.y + 20);
	await page.mouse.down();
	await page.mouse.move(at.x + at.width / 2 - 100, at.y + 20, { steps: 6 });
	await page.mouse.up();
	const narrowed = Math.round((await second.boundingBox())!.width);
	expect(Math.abs(narrowed - (Math.round(box.width) - 100))).toBeLessThanOrEqual(2);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const saved = savedMarkdown();
	const widths = /<!-- colwidths: (\d+) (\d+) (\d+) -->\n+\| 名字 \| 说明 \| 数 \|/u.exec(saved);
	expect(widths).not.toBeNull();
	expect(Math.abs(Number(widths![2]) - narrowed)).toBeLessThanOrEqual(2);

	// Opened again: the same widths.
	await page.reload();
	await expect(table.locator('col')).toHaveCount(3);
	expect(Math.abs(Math.round((await table.locator('th').nth(1).boundingBox())!.width) - narrowed)).toBeLessThanOrEqual(2);
});

test('a table with widths written before it shows its columns so, the comment not shown', async ({ page }) => {
	appendToFixture(`\n<!-- colwidths: 100 200 80 -->\n${TABLE}`);
	await openStudio(page);
	const table = editor(page).locator('.milkdown-table-block table.children');
	await table.scrollIntoViewIfNeeded();
	const widths = await table.locator('th').evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().width)));
	expect(widths).toEqual([100, 200, 80]);
	await expect(editor(page)).not.toContainText('colwidths');
});
