import { expect, test } from '@playwright/test';

import {
	appendToFixture,
	caretAfter,
	openSource,
	openStudio,
	popup,
	popupInput,
	resetFixture,
	savedMarkdown,
	saveStatus,
	scienceBlock,
	structureSheet,
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
	await expect(popup(page)).toHaveCount(0);
	await expect(structureSheet(page)).toHaveCount(0);
});

test('a 3D block double-clicked opens its source popup below the block', async ({ page }) => {
	const xyz = scienceBlock(page, 'XYZ');
	await xyz.locator('.science-block-preview').dblclick();
	await expect(popup(page)).toHaveClass(/is-molecule/);
	await expect(popupInput(page)).toBeFocused();
	await expect(popupInput(page)).toHaveValue(/^3\nwater/);
	const block = await xyz.boundingBox();
	const box = await popup(page).boundingBox();
	expect(box!.y >= block!.y + block!.height - 1 || box!.y + box!.height <= block!.y + 1).toBe(true);
	await expect(popup(page).locator('.pm-source-popup-action')).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(popup(page)).toHaveCount(0);
});

test('编辑 on SMILES opens the inline popup with a preview and 画结构', async ({ page }) => {
	const smiles = scienceBlock(page, 'SMILES');
	await smiles.hover();
	await smiles.locator('.science-block-edit').click();
	await expect(popup(page)).toHaveClass(/is-molecule-inline/);
	await expect(popupInput(page)).toHaveValue('CC(=O)Oc1ccccc1C(=O)O');
	await expect(popup(page).locator('.pm-source-popup-preview svg')).toBeVisible();
	await expect(popup(page).getByRole('button', { name: '画结构' })).toBeVisible();
	await page.keyboard.type('C');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('Escape');
	await expect(popup(page)).toHaveCount(0);
});

test('Enter on a selected block and the menu’s 编辑源码 open the popup', async ({ page }) => {
	const xyz = scienceBlock(page, 'XYZ');
	await xyz.locator('.science-block-preview').click();
	await page.keyboard.press('Enter');
	await expect(popupInput(page)).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(popup(page)).toHaveCount(0);

	const sdf = scienceBlock(page, 'SDF');
	await sdf.hover();
	await sdf.locator('.science-block-menu-button').click();
	await page.locator('.science-block-menu [data-id="edit"]').click();
	await expect(popupInput(page)).toBeFocused();
	await expect(popupInput(page)).toHaveValue(/M {2}END/);
});

test('clicking outside closes the popup; Backspace in an empty source removes the block', async ({ page }) => {
	const smiles = scienceBlock(page, 'SMILES');
	await smiles.hover();
	await smiles.locator('.science-block-edit').click();
	await page.locator('.document-header, h1').first().click();
	await expect(popup(page)).toHaveCount(0);

	await smiles.hover();
	await smiles.locator('.science-block-edit').click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.press('Backspace');
	await expect(smiles).toHaveClass(/is-empty/);
	await page.keyboard.press('Backspace');
	await expect(page.locator('.science-block')).toHaveCount(2);
	await expect(popup(page)).toHaveCount(0);
});

test('a fence typed with a chemistry language becomes a chemistry block', async ({ page }) => {
	await caretAfter(page, '结尾段落。');
	await page.keyboard.press('Enter');
	await page.keyboard.type('```xyz ');
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(2);
	await expect(page.locator('.milkdown pre[data-language="xyz"], .milkdown .milkdown-code-block')).toHaveCount(0);
});

test('an edited block keeps its fence: tildes and what follows the language', async ({ page }) => {
	const input = await openSource(page, 'mol');
	await input.fill(WATER.replace('Water', 'Water, edited'));
	await page.keyboard.press('Escape');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain(`~~~mol title="水"\n${WATER.replace('Water', 'Water, edited')}\n~~~\n`);
});
