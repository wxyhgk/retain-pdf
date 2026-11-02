import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Reading and layout as in Notion: an outline at the edge, a page menu, when it was edited.

test.beforeEach(() => resetFixture());

test('the outline lists the headings and takes the editor to one', async ({ page }) => {
	appendToFixture(`\n## 第一节\n\n${'段落。\n\n'.repeat(30)}## 第二节\n\n${'更多段落。\n\n'.repeat(30)}### 小节\n\n结尾。\n`);
	await openStudio(page);
	const outline = page.locator('#editor-outline');
	await expect(outline.locator('.outline-marks i')).toHaveCount(3);
	await outline.locator('.outline-marks').hover();
	await expect(outline.locator('ol a')).toHaveText(['第一节', '第二节', '小节']);
	await expect(outline.locator('ol li').nth(2)).toHaveClass(/child/);
	await outline.locator('ol a', { hasText: '第二节' }).click();
	await expect(editor(page).locator('h2', { hasText: '第二节' })).toBeInViewport();
	await expect(outline.locator('ol a[aria-current]')).toHaveText('第二节');

	// A heading typed in is in the outline a moment later.
	await editor(page).locator('p', { hasText: /^结尾。$/u }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('## 新的一节');
	await expect(outline.locator('.outline-marks i')).toHaveCount(4);
});

test('the page menu makes the page full width, on the blog too, and says when it was edited', async ({ page }) => {
	await openStudio(page);
	await expect(page.locator('#edited-at')).toHaveText(/^编辑于/u);
	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '全宽' }).click();
	await expect(page.locator('.editor-panel')).toHaveClass(/is-wide/);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/^wide: true$/mu);
	await expect(page.locator('#edited-at')).toHaveText('编辑于刚刚');

	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '全宽 ✓' }).click();
	await expect(page.locator('.editor-panel')).not.toHaveClass(/is-wide/);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).not.toMatch(/^wide:/mu);
});
