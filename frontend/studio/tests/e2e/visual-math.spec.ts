import { expect, test } from '@playwright/test';

import { appendToFixture, caretAfter, displayFormulas, editor, openStudio, popupInput, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// A display formula edited as it looks (MathLive, as cortexjs.io has it): in place, the caret in the drawn formula;
// its LaTeX written back only when changed, its \tag kept; what MathLive does not know, edited as LaTeX.

test.beforeEach(() => resetFixture());

const save = async (page: import('@playwright/test').Page) => {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
};

test('a display formula is edited in place, as it looks; a fraction typed has its empty places, written as {}', async ({ page }) => {
	appendToFixture('\n$$\nx = \\frac{-b}{2a} \\tag{2}\n$$\n');
	await openStudio(page);
	const formula = displayFormulas(page).last();
	await formula.locator('.pm-display-math-formula').click();
	const field = formula.locator('math-field');
	await expect(field).toBeFocused();
	await expect(formula.locator('.pm-display-math-formula')).toBeHidden();
	await page.keyboard.type('+');
	await page.keyboard.type('/');
	await page.keyboard.press('Escape');
	await expect(field).toHaveCount(0);
	const markdown = await save(page);
	expect(markdown).not.toContain('placeholder');
	expect(markdown).toMatch(/\\frac\{-b\}\{2a\}\s*\+\s*\\frac\{\}\{\}\s*\\tag\{2\}/u);
});

test('opened and left as it was, a formula keeps its source as written', async ({ page }) => {
	appendToFixture('\n$$\n\\frac12 + x \\tag{2}\n$$\n');
	await openStudio(page);
	await displayFormulas(page).last().locator('.pm-display-math-formula').click();
	await expect(displayFormulas(page).last().locator('math-field')).toBeFocused();
	await page.keyboard.press('Escape');
	await caretAfter(page, '结尾段落。');
	await page.keyboard.type('补一句。');
	expect(await save(page)).toContain('$$\n\\frac12 + x \\tag{2}\n$$');
});

test('what MathLive does not know is edited as LaTeX; 源码 turns one to it', async ({ page }) => {
	appendToFixture('\n$$\nE = mc^2 \\label{eq:e}\n$$\n');
	await openStudio(page);
	await displayFormulas(page).last().locator('.pm-display-math-formula').click();
	await expect(popupInput(page)).toBeFocused();
	await expect(popupInput(page)).toHaveValue('E = mc^2 \\label{eq:e}');
	await page.keyboard.press('Escape');

	await displayFormulas(page).first().locator('.pm-display-math-formula').click();
	await expect(displayFormulas(page).first().locator('math-field')).toBeFocused();
	await page.locator('.pm-visual-math-source').click();
	await expect(popupInput(page)).toBeFocused();
	await expect(displayFormulas(page).first().locator('math-field')).toHaveCount(0);
	await expect(editor(page)).toBeVisible();
});
