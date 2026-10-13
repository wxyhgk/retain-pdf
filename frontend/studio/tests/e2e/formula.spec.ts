import { expect, test } from '@playwright/test';

import { caretAfter, displayFormulas, editor, inlineFormulas, openStudio, popup, popupInput, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

test.beforeEach(async ({ page }) => {
	resetFixture();
	await openStudio(page);
});

test('the article opens clean, with every formula drawn', async ({ page }) => {
	await expect(inlineFormulas(page)).toHaveCount(2);
	await expect(displayFormulas(page)).toHaveCount(2);
	await expect(editor(page)).not.toContainText('\\(');
	await expect(editor(page)).not.toContainText('\\[');
	await expect(saveStatus(page)).toHaveText('已载入');
});

test('a display formula opens its popup with the caret in it; Esc closes it', async ({ page }) => {
	await displayFormulas(page).first().locator('.pm-display-math-formula').click();
	await expect(popup(page)).toBeVisible();
	await expect(popupInput(page)).toBeFocused();
	await expect(popupInput(page)).toHaveValue('\\sum_i x_i');
	await page.keyboard.type(' + 1');
	await expect(popup(page).locator('.pm-source-popup-preview .katex')).toBeVisible();
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('Escape');
	await expect(popup(page)).toBeHidden();
});

test('saving keeps \\( \\) and \\[ \\] in paragraphs that were not edited', async ({ page }) => {
	await caretAfter(page, '结尾段落。');
	await page.keyboard.type('补一句。');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.locator('#save-button').click();
	await expect(saveStatus(page)).toHaveText('已保存');
	const markdown = savedMarkdown();
	expect(markdown).toContain('\\(a_1 * b_2\\)');
	expect(markdown).toContain('\\[\n\\int_0^1 x\\,dx\n\\]');
	expect(markdown).toContain('结尾段落。补一句。');
});
