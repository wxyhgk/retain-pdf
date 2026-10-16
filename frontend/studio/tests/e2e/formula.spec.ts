import { expect, test } from '@playwright/test';

import {
	appendToFixture,
	caretAfter,
	displayFormulas,
	editFixture,
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
	if (test.info().title.includes('number')) {
		appendToFixture('\n见式 $\\eqref{eq:energy}$ 和 $\\eqref{eq:missing}$。\n\n$$\nE = \\Ha \\psi \\label{eq:energy}\n$$\n');
		editFixture((markdown) => markdown.replace('draft: true\n', 'draft: true\nmacros:\n  Ha: \\hat{H}\n'));
	}
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

test('the display formula’s source completes commands and pairs braces', async ({ page }) => {
	await displayFormulas(page).first().locator('.pm-display-math-formula').click();
	await expect(popupInput(page)).toBeFocused();
	await page.keyboard.type(' + \\sq');
	const menu = page.locator('.latex-completion:not([hidden])');
	await expect(menu.locator('.latex-completion-item.is-selected .latex-completion-name')).toHaveText('\\sqrt');
	await page.keyboard.press('Tab');
	await page.keyboard.type('x^{2');
	await expect(popupInput(page)).toHaveValue('\\sum_i x_i + \\sqrt{x^{2}}');
	// Esc closes the list first, then the popup.
	await page.keyboard.press('End');
	await page.keyboard.type(' \\al');
	await expect(menu).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(popup(page)).toBeVisible();
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

test('formula blocks are numbered in order; \\eqref shows the number; the article’s macros apply', async ({ page }) => {
	// The fixture's two blocks are (1) and (2); the added one is (3).
	const numbers = displayFormulas(page).locator('.katex-tag');
	await expect(numbers).toHaveText(['(1)', '(2)', '(3)']);
	const reference = inlineFormulas(page).filter({ has: page.locator('a[href="#eq-eq:energy"]') });
	await expect(reference).toHaveText('(3)');
	await expect(inlineFormulas(page).filter({ hasText: '(??)' })).toHaveCount(1);
	// \\Ha is the article's macro: no error.
	await expect(displayFormulas(page).last().locator('.katex-error, .is-error')).toHaveCount(0);
	await expect(displayFormulas(page).last()).not.toHaveClass(/is-error/);

	// A block added before it moves its number and the reference with it.
	await displayFormulas(page).first().locator('.pm-display-math-formula').click();
	await expect(popupInput(page)).toBeFocused();
	await page.keyboard.press('Escape');
	await caretAfter(page, '结尾段落。');
	await page.keyboard.press('Enter');
	await page.keyboard.type('$$');
	await page.keyboard.press('Enter');
	await expect(popupInput(page)).toBeFocused();
	await page.keyboard.type('x');
	await page.keyboard.press('Escape');
	await expect(reference).toHaveText('(4)');

	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const markdown = savedMarkdown();
	expect(markdown).toContain('$\\eqref{eq:energy}$');
	expect(markdown).toContain('E = \\Ha \\psi \\label{eq:energy}');
});

test.describe('typing an inline formula', () => {
	const newParagraph = async (page: import('@playwright/test').Page) => {
		await caretAfter(page, '结尾段落。');
		await page.keyboard.press('Enter');
	};
	const saved = async (page: import('@playwright/test').Page) => {
		await page.keyboard.press('ControlOrMeta+s');
		await expect(saveStatus(page)).toHaveText('已保存');
		return savedMarkdown();
	};

	test('Chinese in \\text{} is part of the formula', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('总能量 $E_{\\text{总}}$ 守恒');
		await expect(inlineFormulas(page)).toHaveCount(3);
		expect(await saved(page)).toContain('总能量 $E_{\\text{总}}$ 守恒');
	});

	test('$$x$$ in a line is one formula', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('a $$x^2$$ b');
		await expect(inlineFormulas(page)).toHaveCount(3);
		const markdown = await saved(page);
		expect(markdown).toMatch(/a \$\$?x\^2\$\$? b/u);
		expect(markdown).not.toContain('\\$');
	});

	test('backspace after a formula opens its source instead of deleting it', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('前 $ab$');
		await expect(inlineFormulas(page)).toHaveCount(3);
		await page.keyboard.press('Backspace');
		await expect(editor(page).locator('.pm-math-source')).toHaveText('$ab$');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Escape');
		await expect(inlineFormulas(page)).toHaveCount(3);
		expect(await saved(page)).toContain('前 $a$');
	});

	test('commands complete as they are typed; braces pair; Tab goes to the next slot', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('比值 $\\fr');
		const menu = page.locator('.latex-completion:not([hidden])');
		await expect(menu).toBeVisible();
		await expect(menu.locator('.latex-completion-item.is-selected .latex-completion-name')).toHaveText('\\frac');
		await expect(menu.locator('.latex-completion-item.is-selected .katex')).toBeVisible();
		await page.screenshot({ path: test.info().outputPath('completion.png') });
		await page.keyboard.press('Enter');
		await expect(menu).toBeHidden();
		await page.keyboard.type('a');
		await page.keyboard.press('Tab');
		await page.keyboard.type('b^{2}');
		await page.keyboard.press('Tab');
		await page.keyboard.type('$ 完');
		await expect(inlineFormulas(page)).toHaveCount(3);
		expect(await saved(page)).toContain('比值 $\\frac{a}{b^{2}}$ 完');
	});

	test('Esc closes the list and leaves the formula open', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('$\\alp');
		await expect(page.locator('.latex-completion:not([hidden])')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('.latex-completion:not([hidden])')).toBeHidden();
		await page.keyboard.type('ha$');
		await expect(inlineFormulas(page)).toHaveCount(3);
	});

	test('undo after a formula is drawn gives back the dollars as typed', async ({ page }) => {
		await newParagraph(page);
		await page.keyboard.type('前 $x$');
		await expect(inlineFormulas(page)).toHaveCount(3);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(inlineFormulas(page)).toHaveCount(2);
		await expect(editor(page).getByText('前 $x$', { exact: true })).toBeVisible();
	});
});
