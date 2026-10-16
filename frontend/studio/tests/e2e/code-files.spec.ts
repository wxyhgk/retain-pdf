import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Program input and output in code blocks: coloured as on the blog, a block
// that shows a file of the article previews it, and a block saves as a file.

const codeBlock = (page: Page, text: string) => editor(page).locator('.milkdown-code-block').filter({ hasText: text });

test.beforeEach(async ({ page }) => {
	resetFixture();
	const log = Array.from({ length: 50 }, (_, index) => ` cycle ${index + 1}`).join('\n');
	writeFixtureFile('assets/run.log', `${log}\n Normal termination of Gaussian 16\n`);
	appendToFixture('\n```incar\nENCUT = 520\nISMEAR = 0\n```\n\n```output\n@file ./assets/run.log\n```\n');
	await openStudio(page);
});

test('an INCAR block is coloured by the parser the blog uses', async ({ page }) => {
	const incar = codeBlock(page, 'ENCUT');
	await expect(incar.locator('.cm-content')).toBeVisible();
	const encut = incar.locator('.cm-line span', { hasText: 'ENCUT' });
	await expect(encut).toHaveCount(1);
	const number = incar.locator('.cm-line span', { hasText: '520' });
	const colours = await Promise.all([encut, number].map((span) => span.evaluate((node) => getComputedStyle(node).color)));
	expect(colours[0]).not.toEqual(colours[1]);
});

test('a block showing a file of the article previews the file, numbered and folded', async ({ page }) => {
	const figure = editor(page).locator('figure.code-file');
	await expect(figure.locator('.code-file-name')).toHaveText('run.log');
	await expect(figure.locator('.code-file-size')).toHaveText('51 行');
	await expect(figure.locator('[data-line="51"]')).toContainText('Normal termination');
	await expect(figure.locator('.code-file-unfold')).toHaveText('展开全部 51 行');
	await figure.locator('.code-file-unfold').click();
	await expect(figure.locator('.code-file-unfold')).toHaveText('收起');
	await expect(figure).not.toHaveClass(/is-folded/);
});

test('the block menu saves a code block as a file, and the block then shows it', async ({ page }) => {
	await codeBlock(page, 'ENCUT').locator('.cm-content').hover();
	const handle = page.locator('.milkdown-block-handle .operation-item').last();
	await expect(handle).toBeVisible();
	await handle.click();
	await page.locator('.milkdown-block-menu [data-key="save-file"]').click();

	const figure = editor(page).locator('figure.code-file', { has: page.locator('.code-file-name', { hasText: 'INCAR' }) });
	await expect(figure).toBeVisible();
	expect(fixtureHas('assets/INCAR')).toBe(true);

	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('```incar\n@file ./assets/INCAR\n```');
});
