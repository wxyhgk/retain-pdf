import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Citations: `[@key]` numbered from the article's assets/refs.bib, picked with `[@`, written back as written.

const BIB = `@article{becke1993,
  author = {Becke, Axel D.},
  title = {Density-functional thermochemistry. {III}. The role of exact exchange},
  journal = {The Journal of Chemical Physics},
  year = {1993}, volume = {98}, pages = {5648--5652}
}
@article{grimme2010,
  author = {Grimme, Stefan and Antony, Jens},
  title = {A consistent and accurate ab initio parametrization},
  journal = {J. Chem. Phys.}, year = {2010}
}
`;

const chips = (page: import('@playwright/test').Page) => editor(page).locator('.citation-chip');

test.beforeEach(() => {
	resetFixture();
	writeFixtureFile('assets/refs.bib', BIB);
});

test('citations show as the blog numbers them, the work on hover, and are written back as they were', async ({ page }) => {
	appendToFixture('\nB3LYP [@becke1993] 加色散 [@grimme2010; @becke1993, p. 5649]，还有 [@nowhere]。\n');
	await openStudio(page);
	await expect(chips(page)).toHaveText(['[1]', '[1,2]', '[?]']);
	await expect(chips(page).first()).toHaveAttribute('title', /Becke, A\. D\. · 1993 · Density-functional thermochemistry\. III\./u);
	await expect(chips(page).nth(2)).toHaveClass(/is-missing/u);

	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('改了别处');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('B3LYP [@becke1993] 加色散 [@grimme2010; @becke1993, p. 5649]，还有 [@nowhere]。');
});

test('`[@` asks which work, found by author or year; it is cited where the brackets were', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('见');
	await page.keyboard.type('[@');
	const picker = page.locator('#cite-dialog');
	await expect(picker).toBeVisible();
	await expect(picker.locator('.quick-find-title')).toHaveCount(2);
	await page.keyboard.type('grimme 2010');
	await expect(picker.locator('.quick-find-title')).toHaveText(['A consistent and accurate ab initio parametrization']);
	await page.keyboard.press('Enter');
	await expect(picker).toBeHidden();
	await expect(chips(page)).toHaveText(['[1]']);
	await page.keyboard.type('。');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。见[@grimme2010]。');

	// Given up: the brackets typed stay.
	await page.keyboard.type('[@');
	await expect(picker).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(picker).toBeHidden();
	await expect(editor(page).locator('p', { hasText: '结尾段落' })).toContainText('[@');
});

test('a citation typed whole becomes one', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	// `[` then `@` would ask; typed as text it is a citation once closed.
	await page.keyboard.insertText('[@becke1993');
	await page.keyboard.type(']');
	await expect(chips(page)).toHaveText(['[1]']);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。[@becke1993]');
	expect(savedMarkdown()).not.toContain('\\[@');
});
