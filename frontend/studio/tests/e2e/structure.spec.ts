import { expect, test, type Page } from '@playwright/test';

import { blockSheet, BUILT_MOL, closeSheet, openSource, openStudio, resetFixture, retainmolFrame, savedMarkdown, scienceBlock, sheetTab } from './studio.ts';

// A flat structure (SMILES, a 2D SDF) is drawn in its sheet, in the structure
// editor (chem-structura); what is drawn is written back a moment later.

test.beforeEach(async ({ page }) => {
	resetFixture();
	await openStudio(page);
});

const editorIn = (page: Page) => blockSheet(page).locator('.science-sheet-editor .chem-app');

test('double-clicking a 2D structure opens its sheet with the structure editor; closing it changes nothing', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	await expect(editorIn(page)).toBeVisible();
	await expect(sheetTab(page, '结构')).toHaveAttribute('aria-selected', 'true');
	await closeSheet(page);
	await expect(await openSource(page, 'SMILES')).toHaveValue('CC(=O)Oc1ccccc1C(=O)O');
	await closeSheet(page);

	await scienceBlock(page, 'SDF').locator('.science-block-preview').dblclick();
	await expect(editorIn(page)).toBeVisible();
	await closeSheet(page);
	await expect(await openSource(page, 'SDF')).toHaveValue(/^Water\n/);
});

test('a drawn change comes back as SMILES; an SDF block gets the editor’s molfile', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	const editor = editorIn(page);
	await expect(editor).toBeVisible();
	const box = (await editor.boundingBox())!;
	// The bond tool is the default: a click on empty canvas draws an ethane.
	await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.85);
	// Written back once RDKit has turned the drawing into SMILES.
	await sheetTab(page, '源码').click();
	await expect(blockSheet(page).locator('.science-sheet-source')).toHaveValue(/^[^\n]*\.[^\n]*$/);
	await closeSheet(page);

	await scienceBlock(page, 'SDF').locator('.science-block-preview').dblclick();
	const sdfEditor = editorIn(page);
	await expect(sdfEditor).toBeVisible();
	const sdfBox = (await sdfEditor.boundingBox())!;
	await page.mouse.click(sdfBox.x + sdfBox.width * 0.3, sdfBox.y + sdfBox.height * 0.85);
	await sheetTab(page, '源码').click();
	await expect(blockSheet(page).locator('.science-sheet-source')).toHaveValue(/V2000[\s\S]*M {2}END/);
	await closeSheet(page);
	await expect(scienceBlock(page, 'SDF').locator('.chem-2d svg')).toBeVisible();
});

test('a SMILES made 3D: RetainMol is given its flat structure, and the block becomes the 3D SDF it built', async ({ page }) => {
	await scienceBlock(page, 'SMILES').locator('.science-block-preview').dblclick();
	await blockSheet(page).locator('.block-sheet-action', { hasText: '生成三维结构' }).click();
	// Given as a molfile drawn flat from the SMILES.
	await expect(retainmolFrame(page).locator('#loaded')).toContainText('RDKit');
	await expect(blockSheet(page).locator('.block-sheet-title')).toHaveText('SDF');
	await expect(blockSheet(page).locator('.block-sheet-action')).toHaveCount(0);
	await closeSheet(page);
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain(`\`\`\`sdf\n${BUILT_MOL}\n\`\`\``);
});
