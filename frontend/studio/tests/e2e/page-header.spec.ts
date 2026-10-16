import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// The top of the page as Notion has it: an icon, a cover, and the properties as rows changed where they are.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

test.beforeEach(() => resetFixture());

test('an icon is picked above the title, shown in the list, and removed again', async ({ page }) => {
	await openStudio(page);
	await page.locator('.page-head').hover();
	await page.locator('#add-icon').click();
	await page.getByRole('button', { name: '图标 🧪' }).click();
	await expect(page.locator('#page-icon')).toHaveText('🧪');
	await expect(page.locator('#add-icon')).toBeHidden();
	expect(await save(page)).toMatch(/^icon: "🧪"$/mu);
	await expect(page.locator('.page-row.active .page-icon')).toHaveText('🧪');

	await page.locator('#page-icon').click();
	await page.locator('.icon-picker').getByRole('button', { name: '移除' }).click();
	await expect(page.locator('#page-icon')).toBeHidden();
	expect(await save(page)).not.toMatch(/^icon:/mu);
});

test('a cover is one of the article’s pictures, or one uploaded, and is its heroImage', async ({ page }) => {
	writeFixtureFile('img/cover.png', PLOT);
	await openStudio(page);
	await page.locator('.page-head').hover();
	await page.locator('#add-cover').click();
	await page.getByRole('button', { name: '封面 ./img/cover.png' }).click();
	const cover = page.locator('#page-cover img');
	await expect(cover).toBeVisible();
	await expect(cover).toHaveJSProperty('complete', true);
	expect(await cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(480);
	expect(await save(page)).toMatch(/^heroImage: "\.\/img\/cover\.png"$/mu);

	await page.locator('#page-cover').hover();
	await page.locator('#change-cover').click();
	await page.locator('.cover-picker input[type=file]').setInputFiles({ name: 'New Cover.png', mimeType: 'image/png', buffer: PLOT });
	await expect(page.locator('.cover-picker')).toHaveCount(0);
	expect(await save(page)).toMatch(/^heroImage: "\.\/img\/New-Cover\.png"$/mu);

	await page.locator('#page-cover').hover();
	await page.locator('#remove-cover').click();
	await expect(page.locator('#page-cover')).toBeHidden();
	expect(await save(page)).not.toMatch(/^heroImage:/mu);
});

test('tags are chips: Enter or a comma adds one, Backspace takes the last off', async ({ page }) => {
	await openStudio(page);
	const input = page.locator('#article-tag-input');
	await input.click();
	await input.pressSequentially('DFT');
	await input.press('Enter');
	await input.pressSequentially('激发态，');
	await input.pressSequentially('TDDFT');
	await input.press('Enter');
	await expect(page.locator('#article-tags .tag-chip')).toHaveText(['DFT×', '激发态×', 'TDDFT×']);
	await input.press('Backspace');
	await expect(page.locator('#article-tags .tag-chip')).toHaveCount(2);
	expect(await save(page)).toMatch(/^tags: \["DFT", "激发态"\]$/mu);
});

test('the kind is a choice between 博客 and 维基', async ({ page }) => {
	await openStudio(page);
	await page.locator('#article-kind').selectOption('wiki');
	expect(await save(page)).toMatch(/^kind: "wiki"$/mu);
});
