import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, blockSheet, editor, openStudio, resetFixture, slug, writeFixtureFile } from './studio.ts';

// A text file of the article (a script, data) read and changed in the Studio (files/file-editor.ts): from its block in
// the article (编辑, a double-click) and from the 文件 tab; saved back to the file, its preview drawn again.

const onDisk = (path: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, slug, path), 'utf8');
const code = (page: Page) => blockSheet(page).locator('.file-editor .cm-content');

test.beforeEach(() => resetFixture());

test('a script in the article: shown as the file, 编辑 opens it, ⌘S saves it, its preview shows the change', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'def step(g):\n    return -g\n');
	appendToFixture('\n```python\n@file ./assets/opt.py\n```\n');
	await openStudio(page);
	const shown = editor(page).locator('figure.code-file[data-file-path="assets/opt.py"]');
	await expect(shown).toContainText('def step(g):');

	await shown.getByRole('button', { name: '编辑' }).click();
	await expect(blockSheet(page)).toContainText('assets/opt.py');
	await expect(code(page)).toContainText('return -g');
	// Coloured as Python.
	await expect(code(page).locator('span').first()).toBeVisible();
	await code(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('# 改过了');
	await expect(blockSheet(page).locator('.file-editor-status')).toHaveText('有改动，⌘S 保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(blockSheet(page).locator('.file-editor-status')).toHaveText('已保存');
	expect(onDisk('assets/opt.py')).toBe('def step(g):\n    return -g\n# 改过了');
	await page.keyboard.press('Escape');
	await expect(blockSheet(page)).toHaveCount(0);
	await expect(editor(page).locator('figure.code-file[data-file-path="assets/opt.py"]')).toContainText('# 改过了');
});

test('a double-click on a file’s preview opens it; closed with changes, they are kept', async ({ page }) => {
	writeFixtureFile('assets/data.csv', 'x,y\n1,2\n');
	appendToFixture('\n```csv\n@file ./assets/data.csv\n```\n');
	await openStudio(page);
	await editor(page).locator('figure.code-file[data-file-path="assets/data.csv"] pre').dblclick();
	await expect(code(page)).toContainText('1,2');
	await code(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('3,4\n');
	await blockSheet(page).locator('.block-sheet-close').click();
	await expect.poll(() => onDisk('assets/data.csv')).toBe('x,y\n1,2\n3,4\n');
	await expect(editor(page).locator('figure.code-file[data-file-path="assets/data.csv"]')).toContainText('3,4');
});

test('a text file in the 文件 tab opens in the Studio to edit, not in a browser tab', async ({ page }) => {
	writeFixtureFile('assets/run.sh', 'xtb mol.xyz --opt\n');
	await openStudio(page);
	const row = page.locator('#file-tree .file-row[data-path="assets/run.sh"]');
	await row.dblclick();
	await expect(code(page)).toContainText('xtb mol.xyz --opt');
	await page.keyboard.press('Escape');
	await row.click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: '编辑' })).toBeVisible();
	await page.keyboard.press('Escape');
});
