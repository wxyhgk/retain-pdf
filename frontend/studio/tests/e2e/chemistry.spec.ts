import { expect, test } from '@playwright/test';

import {
	appendToFixture,
	blockSheet,
	BUILT_XYZ,
	retainmolFrame,
	caretAfter,
	closeSheet,
	openSource,
	openStudio,
	resetFixture,
	savedMarkdown,
	saveStatus,
	scienceBlock,
	sheetTab,
} from './studio.ts';

const WATER = [
	'Water',
	'  ChemBlog',
	'',
	'  3  2  0  0  0  0  0  0  0  0999 V2000',
	'    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0',
	'    0.7586    0.5043    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0',
	'   -0.7586    0.5043    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0',
	'  1  2  1  0  0  0  0',
	'  1  3  1  0  0  0  0',
	'M  END',
].join('\n');

test.beforeEach(async ({ page }) => {
	resetFixture();
	if (test.info().title.includes('@file')) appendToFixture('\n```cube\n@file ../outside.cube\n```\n');
	if (test.info().title.includes('fence')) appendToFixture(`\n~~~mol title="水"\n${WATER}\n~~~\n`);
	await openStudio(page);
});

test('an article with a bad @file path still opens; that block says why', async ({ page }) => {
	await expect(scienceBlock(page, 'Cube').locator('.science-block-fallback')).toContainText('无法预览：@file 只能引用');
});

test('a click selects a chemistry block without opening anything', async ({ page }) => {
	const smiles = scienceBlock(page, 'SMILES');
	await smiles.locator('.science-block-preview').click();
	await expect(smiles).toHaveClass(/ProseMirror-selectednode/);
	await expect(blockSheet(page)).toHaveCount(0);
});

test('a 3D block double-clicked opens its sheet: the structure in RetainMol, its source beside', async ({ page }) => {
	const xyz = scienceBlock(page, 'XYZ');
	await xyz.locator('.science-block-preview').dblclick();
	await expect(blockSheet(page).locator('.block-sheet-title')).toHaveText('XYZ');
	await expect(sheetTab(page, '结构')).toHaveAttribute('aria-selected', 'true');
	await expect(retainmolFrame(page).locator('#loaded')).toHaveText('3 / water');
	// Built in RetainMol: written back in the block's own format.
	await retainmolFrame(page).locator('#build').click();
	await expect(blockSheet(page).locator('.block-sheet-note')).toHaveText('CH4O · 6 个原子，已写回块里。');
	// A 3D structure has nothing to be made 3D.
	await expect(blockSheet(page).locator('.block-sheet-action')).toHaveCount(0);
	await sheetTab(page, '源码').click();
	await expect(blockSheet(page).locator('.science-sheet-source')).toHaveValue(BUILT_XYZ);
	await closeSheet(page);
	await expect(xyz).toHaveClass(/ProseMirror-selectednode/);
});

test('编辑 on SMILES opens its sheet: drawn in the structure editor, or written, previewed as typed', async ({ page }) => {
	const smiles = scienceBlock(page, 'SMILES');
	await smiles.hover();
	await smiles.locator('.science-block-edit').click();
	await expect(blockSheet(page).locator('.science-sheet-editor .chem-app')).toBeVisible();
	await expect(blockSheet(page).locator('.block-sheet-action')).toHaveText('生成三维结构');
	await sheetTab(page, '源码').click();
	const source = blockSheet(page).locator('.science-sheet-source');
	await expect(source).toHaveValue('CC(=O)Oc1ccccc1C(=O)O');
	await expect(blockSheet(page).locator('.science-sheet-preview svg')).toBeVisible();
	await source.press('End');
	await source.pressSequentially('C');
	await expect(saveStatus(page)).toHaveText('未保存');
	await closeSheet(page);
	await expect(smiles.locator('.science-block-preview figcaption')).toContainText('CC(=O)Oc1ccccc1C(=O)OC');
});

test('Enter on a selected block opens its sheet; the menu’s 编辑源码 opens it on 源码', async ({ page }) => {
	const xyz = scienceBlock(page, 'XYZ');
	await xyz.locator('.science-block-preview').click();
	await page.keyboard.press('Enter');
	await expect(sheetTab(page, '结构')).toHaveAttribute('aria-selected', 'true');
	await closeSheet(page);

	const sdf = scienceBlock(page, 'SDF');
	await sdf.hover();
	await sdf.locator('.science-block-menu-button').click();
	await page.locator('.milkdown-block-menu [data-key="edit"]').click();
	await expect(sheetTab(page, '源码')).toHaveAttribute('aria-selected', 'true');
	await expect(blockSheet(page).locator('.science-sheet-source')).toBeFocused();
	await expect(blockSheet(page).locator('.science-sheet-source')).toHaveValue(/M {2}END/);
});

test('a block left empty when its sheet closes goes, as in Notion', async ({ page }) => {
	const source = await openSource(page, 'SMILES');
	await source.fill('');
	await expect(scienceBlock(page, 'SMILES')).toHaveClass(/is-empty/);
	await closeSheet(page);
	await expect(page.locator('.science-block')).toHaveCount(2);
	await expect(scienceBlock(page, 'SMILES')).toHaveCount(0);
});

test('a fence typed with a chemistry language becomes a chemistry block, its sheet open on 源码', async ({ page }) => {
	await caretAfter(page, '结尾段落。');
	await page.keyboard.press('Enter');
	await page.keyboard.type('```xyz ');
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(2);
	await expect(page.locator('.milkdown pre[data-language="xyz"], .milkdown .milkdown-code-block')).toHaveCount(0);
	await expect(sheetTab(page, '源码')).toHaveAttribute('aria-selected', 'true');
	await expect(blockSheet(page).locator('.science-sheet-source')).toBeFocused();
	await page.keyboard.type('1\nhelium\nHe 0 0 0');
	await closeSheet(page);
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(2);
});

test('an edited block keeps its fence: tildes and what follows the language', async ({ page }) => {
	const input = await openSource(page, 'mol');
	await input.fill(WATER.replace('Water', 'Water, edited'));
	await closeSheet(page);
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain(`~~~mol title="水"\n${WATER.replace('Water', 'Water, edited')}\n~~~\n`);
});
