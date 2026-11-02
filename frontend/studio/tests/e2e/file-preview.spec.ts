import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { appendToFixture, blockSheet, editor, openStudio, resetFixture, sheetTab, slug, writeFixtureFile } from './studio.ts';

// A file of the article seen in the Studio (files/file-preview.ts), from a link to it: a picture to look at closely,
// a table as a table, a sound to play; what it is, its history, its program, Finder.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));

test.beforeEach(() => resetFixture());

test('a picture opened from its link: whole at first; 100% and back; its size said; its history beside it', async ({ page }) => {
	writeFixtureFile('assets/plot.png', PLOT);
	appendToFixture('\n原图见 [plot.png](./assets/plot.png)。\n');
	await openStudio(page);
	await editor(page).getByRole('link', { name: 'plot.png' }).click();
	const sheet = blockSheet(page);
	const stage = sheet.locator('.file-preview-stage');
	await expect(stage).toHaveClass(/is-fit/u);
	await expect(sheet.locator('.file-preview-bar')).toContainText('适应窗口');
	await expect(sheet.locator('.file-preview-size')).toHaveText(/^\d+ × \d+$/u);
	await sheet.getByRole('button', { name: '原始大小' }).click();
	await expect(stage).not.toHaveClass(/is-fit/u);
	await expect(sheet.locator('.file-preview-bar')).toContainText('100%');
	await sheet.getByRole('button', { name: '放大' }).click();
	await expect(sheet.locator('.file-preview-bar')).toContainText('125%');
	await stage.locator('img').dblclick();
	await expect(stage).toHaveClass(/is-fit/u);
	await sheetTab(page, '历史版本').click();
	await expect(sheet).toContainText('还没有历史版本');
	await expect(sheet.getByRole('button', { name: '用默认程序打开' })).toBeVisible();
});

test('a table file shown as a table (quotes as CSV has them); 编辑文本 opens its text', async ({ page }) => {
	writeFixtureFile('assets/energies.csv', '结构,E/Hartree,备注\nTS1,-76.4,"含 ""虚频"", 1 个"\nIM1,-76.5,\n');
	appendToFixture('\n能量表：[energies.csv](./assets/energies.csv)\n');
	await openStudio(page);
	await editor(page).getByRole('link', { name: 'energies.csv' }).click();
	const table = blockSheet(page).locator('.file-preview-table');
	await expect(table.locator('th')).toHaveText(['结构', 'E/Hartree', '备注']);
	await expect(table.locator('tbody tr')).toHaveCount(2);
	await expect(table.locator('tbody tr').first().locator('td')).toHaveText(['TS1', '-76.4', '含 "虚频", 1 个']);
	await blockSheet(page).getByRole('button', { name: '编辑文本' }).click();
	await expect(blockSheet(page).locator('.file-editor .cm-content')).toContainText('TS1,-76.4');
});

test('a sound played in the Studio; a zip, which it cannot show, goes to its program', async ({ page }) => {
	writeFixtureFile('assets/note.m4a', Buffer.from([0, 0, 0, 0]));
	writeFixtureFile('assets/run.zip', Buffer.from('PK'));
	appendToFixture('\n录音 [note.m4a](./assets/note.m4a)，打包 [run.zip](./assets/run.zip)。\n');
	await openStudio(page);
	await editor(page).getByRole('link', { name: 'note.m4a' }).click();
	await expect(blockSheet(page).locator('audio.file-preview-player')).toHaveAttribute('src', /assets\/note\.m4a/u);
	await page.keyboard.press('Escape');
	const opened = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`/api/studio/articles/${slug}/open`));
	await editor(page).getByRole('link', { name: 'run.zip' }).click();
	expect((await opened).postDataJSON().path).toBe('assets/run.zip');
	await expect(blockSheet(page)).toHaveCount(0);
});
