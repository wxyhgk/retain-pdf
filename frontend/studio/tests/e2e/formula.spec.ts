import { expect, test } from '@playwright/test';

import {
	appendToFixture,
	caretAfter,
	displayFormulas,
	editor,
	inlineFormulas,
	openStudio,
	popup,
	popupInput,
	resetFixture,
	savedMarkdown,
	saveStatus,
} from './studio.ts';

test.beforeEach(async ({ page }) => {
	resetFixture();
	if (test.info().title.includes('fence')) appendToFixture('\n```latex\n\\LaTeX\n```\n\n```math\na^2 + b^2\n```\n');
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
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const markdown = savedMarkdown();
	expect(markdown).toContain('\\(a_1 * b_2\\)');
	expect(markdown).toContain('\\[\n\\int_0^1 x\\,dx\n\\]');
	expect(markdown).toContain('结尾段落。补一句。');
});

test('a ```math fence is a formula and a ```latex fence is code, as the blog draws them', async ({ page }) => {
	await expect(displayFormulas(page)).toHaveCount(3);
	await expect(displayFormulas(page).last().locator('.katex')).toBeVisible();
	const latex = editor(page).locator('.milkdown-code-block').filter({ hasText: '\\LaTeX' });
	await expect(latex.locator('.cm-content')).toBeVisible();

	// Edited, the ```latex fence stays a fence; it is not turned into $$.
	await latex.locator('.cm-content').click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('{}');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const markdown = savedMarkdown();
	expect(markdown).toContain('```latex\n\\LaTeX{}\n```');
	expect(markdown).toContain('```math\na^2 + b^2\n```');
});

test('a $$ block edited is written back as $$', async ({ page }) => {
	await displayFormulas(page).first().locator('.pm-display-math-formula').click();
	await expect(popupInput(page)).toBeFocused();
	await page.keyboard.type(' + 1');
	await page.keyboard.press('Escape');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('$$\n\\sum_i x_i + 1\n$$');
});
