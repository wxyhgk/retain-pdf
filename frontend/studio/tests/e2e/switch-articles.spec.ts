import { expect, test } from '@playwright/test';

import { appendToFixture, caretAfter, editor, inlineFormulas, openStudio, removeArticle, resetFixture, saveStatus, scienceBlock, writeArticle } from './studio.ts';

// One editor shows one article after another (studio-editor.ts showDocument): it is made once, not again at each
// article opened from the list, its menus and toolbar with it. What the article before had is not carried over: its
// undo, where it was scrolled to.

const OTHER = 'switch-other';

test.beforeEach(() => {
	resetFixture();
	writeArticle(OTHER, "---\ntitle: '另一篇'\ndescription: ''\npubDate: '2026-10-24'\ntags: []\nkind: wiki\ndraft: true\n---\n\n另一篇的正文。\n\n公式 $x^2$。\n");
});
test.afterEach(() => removeArticle(OTHER));

const open = (page: import('@playwright/test').Page, title: string) => page.locator('#article-list').getByText(title, { exact: true }).click();

test('the next article is shown in the same editor, without the undo or the scroll of the one before', async ({ page }) => {
	appendToFixture(`\n${Array.from({ length: 80 }, (_, index) => `第 ${index + 1} 段。`).join('\n\n')}\n`);
	await openStudio(page);
	await editor(page).evaluate((element) => ((element as HTMLElement & { made?: boolean }).made = true));
	await caretAfter(page, '第 80 段。');
	await page.keyboard.type('夹具里打的字');
	const scroller = page.locator('.editor-scroll');
	expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

	await open(page, '另一篇');
	await expect(editor(page)).toContainText('另一篇的正文');
	await expect(inlineFormulas(page).locator('.katex')).toHaveCount(1);
	await expect(saveStatus(page)).toHaveText(/已载入|已保存/u);
	// The same editor, from the top.
	expect(await editor(page).evaluate((element) => (element as HTMLElement & { made?: boolean }).made)).toBe(true);
	expect(await scroller.evaluate((element) => element.scrollTop)).toBe(0);
	// Undo here takes back nothing of the fixture's.
	await caretAfter(page, '另一篇的正文。');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page)).not.toContainText('第 80 段');
	await expect(editor(page)).toContainText('另一篇的正文');

	// And back: the fixture as saved, its molecules drawn again.
	await open(page, 'Studio 测试夹具');
	await expect(editor(page)).toContainText('第 80 段。夹具里打的字');
	await expect(scienceBlock(page, 'SMILES').locator('.science-block-preview svg')).toBeVisible();
	await expect(editor(page)).not.toContainText('另一篇的正文');
});
