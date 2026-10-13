import { expect, test } from '@playwright/test';

import { openSource, openStudio, resetFixture, scienceBlock, sheetClosed, structureSheet } from './studio.ts';

test.beforeEach(async ({ page }) => {
	resetFixture();
	await openStudio(page);
});

test('double-clicking a 2D structure opens the structure editor; 取消 and Esc leave it alone', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	await expect(structureSheet(page)).toBeVisible();
	await expect(page.locator('.pm-source-popup')).toHaveCount(0);
	await structureSheet(page).getByRole('button', { name: '取消' }).click();
	await sheetClosed(page);

	await scienceBlock(page, 'SDF').locator('.science-block-preview').dblclick();
	await expect(structureSheet(page)).toBeVisible();
	await structureSheet(page).getByRole('button', { name: '取消' }).focus();
	await page.keyboard.press('Escape');
	await sheetClosed(page);
	await expect(await openSource(page, 'SDF')).toHaveValue(/^Water\n/);
});

test('saving an unchanged SMILES structure keeps the author’s SMILES', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	await expect(structureSheet(page).locator('canvas, svg').first()).toBeVisible();
	await structureSheet(page).getByRole('button', { name: '保存' }).click();
	await sheetClosed(page);
	await expect(await openSource(page, 'SMILES')).toHaveValue('CC(=O)Oc1ccccc1C(=O)O');
});

test('a drawn change comes back as SMILES, and an SDF block gets the editor’s molfile', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	const canvas = structureSheet(page).locator('.chem-sheet-editor');
	await expect(canvas).toBeVisible();
	const box = (await canvas.boundingBox())!;
	// The bond tool is the default: a click on empty canvas draws an ethane.
	await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.8);
	await structureSheet(page).getByRole('button', { name: '保存' }).click();
	await sheetClosed(page);
	// The drawing comes back once RDKit has turned it into SMILES; the open popup follows.
	await expect(await openSource(page, 'SMILES')).toHaveValue(/^[^\n]*\.[^\n]*$/);
	await page.keyboard.press('Escape');

	await scienceBlock(page, 'SDF').locator('.science-block-preview').dblclick();
	await expect(structureSheet(page)).toBeVisible();
	await structureSheet(page).getByRole('button', { name: '保存' }).click();
	await sheetClosed(page);
	await expect(await openSource(page, 'SDF')).toHaveValue(/V2000[\s\S]*M {2}END/);
	await page.keyboard.press('Escape');
	await expect(scienceBlock(page, 'SDF').locator('.chem-2d svg')).toBeVisible();
});
