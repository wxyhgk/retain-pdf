import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, blockSheet, editor, openSettings, openStudio, resetFixture, slug, writeFixtureFile } from './studio.ts';

// A text file of the article (a script, data) read and changed in the Studio (files/file-editor.ts): from its block in
// the article (编辑, a double-click) and from the 文件 tab; saved back to the file, its preview drawn again.

const onDisk = (path: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, slug, path), 'utf8');
const code = (page: Page) => blockSheet(page).locator('.file-editor .cm-content');
/** The Studio asked to open a file with its program (`open`), or to show it in Finder (`reveal`): what it named. */
const asked = (page: Page, action: 'open' | 'reveal') =>
	page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/api/studio/articles/${slug}/${action}`)).then((request) => request.postDataJSON().path as string);

test.beforeEach(() => resetFixture());

test('a script in the article is a link; a click on it opens it to read and edit, ⌘S saves it to the file', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'def step(g):\n    return -g\n');
	appendToFixture('\n优化器见 [opt.py](./assets/opt.py)。\n');
	await openStudio(page);
	await editor(page).getByRole('link', { name: 'opt.py' }).click();
	await expect(blockSheet(page)).toContainText('assets/opt.py');
	await expect(code(page)).toContainText('return -g');
	await code(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('# 改过了');
	await expect(blockSheet(page).locator('.file-editor-status')).toHaveText('有改动，⌘S 保存');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(blockSheet(page).locator('.file-editor-status')).toHaveText('已保存');
	expect(onDisk('assets/opt.py')).toBe('def step(g):\n    return -g\n# 改过了');
	await page.keyboard.press('Escape');
	await expect(blockSheet(page)).toHaveCount(0);
	// The article is as it was: the link, nothing put in it.
	await expect(editor(page).getByRole('link', { name: 'opt.py' })).toBeVisible();
	await expect(editor(page).locator('figure.code-file')).toHaveCount(0);
	// Opened again: as saved; and from it, in its own program.
	await editor(page).getByRole('link', { name: 'opt.py' }).click();
	await expect(code(page)).toContainText('# 改过了');
	const opened = asked(page, 'open');
	await blockSheet(page).getByRole('button', { name: '用默认程序打开' }).click();
	expect(await opened).toBe('assets/opt.py');
});

test('how a link to a file opens is chosen for each click: ⌘ with its program, ⌥ in Finder; set in 设置 › 打开文件', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	writeFixtureFile('assets/paper.pdf', '%PDF-1.4\n');
	appendToFixture('\n优化器见 [opt.py](./assets/opt.py)，论文见 [paper.pdf](./assets/paper.pdf)。\n');
	await openStudio(page);
	const script = editor(page).getByRole('link', { name: 'opt.py' });
	let opened = asked(page, 'open');
	await script.click({ modifiers: ['ControlOrMeta'] });
	expect(await opened).toBe('assets/opt.py');
	const shown = asked(page, 'reveal');
	await script.click({ modifiers: ['Alt'] });
	expect(await shown).toBe('assets/opt.py');
	// A PDF, which the Studio has no editor for: its program.
	opened = asked(page, 'open');
	await editor(page).getByRole('link', { name: 'paper.pdf' }).click();
	expect(await opened).toBe('assets/paper.pdf');
	await expect(blockSheet(page)).toHaveCount(0);

	// A click chosen to open with the program: so it does, at once.
	const settings = await openSettings(page, 'files');
	await settings.locator('#file-open-click').selectOption('app');
	await page.keyboard.press('Escape');
	opened = asked(page, 'open');
	await script.click();
	expect(await opened).toBe('assets/opt.py');
	await expect(blockSheet(page)).toHaveCount(0);
});

test('closed with changes, they are kept', async ({ page }) => {
	writeFixtureFile('assets/data.csv', 'x,y\n1,2\n');
	appendToFixture('\n数据：[data.csv](./assets/data.csv)。\n');
	await openStudio(page);
	await editor(page).getByRole('link', { name: 'data.csv' }).click();
	await expect(code(page)).toContainText('1,2');
	await code(page).click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('3,4\n');
	await blockSheet(page).locator('.block-sheet-close').click();
	await expect.poll(() => onDisk('assets/data.csv')).toBe('x,y\n1,2\n3,4\n');
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
	const opened = asked(page, 'open');
	await page.getByRole('menuitem', { name: '用默认程序打开' }).click();
	expect(await opened).toBe('assets/run.sh');
});
