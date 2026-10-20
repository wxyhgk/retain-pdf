import { expect, test, type Page } from '@playwright/test';

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
	await page.keyboard.type('/两栏');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index]').first()).toHaveText('两栏');
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
