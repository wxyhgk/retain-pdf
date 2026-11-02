import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Office files in the Studio: shown in the page itself, as cards in the article, and a sheet or a CSV put into it as a table.

const fileRow = (page: Page, path: string): Locator => page.locator(`#file-tree .file-row[data-path="${path}"]`);
const viewer = (page: Page): Locator => page.locator('.office-viewer');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/office/${name}`, import.meta.url));

test.beforeEach(async ({ page }, info) => {
	resetFixture();
	if (info.title.startsWith('cards')) appendToFixture('\n[组会报告.pptx](./assets/slides.pptx)\n\n> [能量](./assets/energies.xlsx)\n');
	writeFixtureFile('assets/energies.csv', '结构,E / kcal/mol\nRC2,-0.45\nTS2,-0.21\n');
	writeFixtureFile('assets/energies.xlsx', fixture('energies.xlsx'));
	writeFixtureFile('assets/report.docx', fixture('report.docx'));
	writeFixtureFile('assets/slides.pptx', fixture('slides.pptx'));
	writeFixtureFile('assets/old.doc', 'not really a document');
	await openStudio(page);
});

async function putCaretAtEnd(page: Page): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

test('a CSV file goes into the article as a table, numbers to the right', async ({ page }) => {
	await putCaretAtEnd(page);
	await fileRow(page, 'assets/energies.csv').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '插入为表格' }).click();
	await expect(page.locator('#files-status')).toHaveText('已插入 2 行的表格');
	await expect(editor(page).locator('table td', { hasText: 'TS2' })).toBeVisible();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('| 结构 | E / kcal/mol |\n| --- | ---: |\n| RC2 | -0.45 |\n| TS2 | -0.21 |');
});

test('a workbook shows as its sheet, and its first sheet goes in as a table', async ({ page }) => {
	await fileRow(page, 'assets/energies.xlsx').dblclick();
	await expect(viewer(page)).toBeVisible();
	await expect(page.locator('#office-viewer-title')).toHaveText('energies.xlsx');
	await expect(viewer(page).locator('.office-sheet td', { hasText: 'PC2' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(viewer(page)).toBeHidden();

	await putCaretAtEnd(page);
	await fileRow(page, 'assets/energies.xlsx').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '插入为表格' }).click();
	await expect(page.locator('#files-status')).toHaveText('已插入 3 行的表格');
	await expect(editor(page).locator('table td', { hasText: 'PC2' })).toBeVisible();
});

test('a Word document shows as pages, slides one under another', async ({ page }) => {
	await fileRow(page, 'assets/report.docx').click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: '插入为表格' })).toHaveCount(0);
	await page.getByRole('menuitem', { name: '预览' }).click();
	await expect(viewer(page).locator('section.docx')).toContainText('收敛四项都达标');
	await page.keyboard.press('Escape');

	await fileRow(page, 'assets/slides.pptx').dblclick();
	await expect(viewer(page).locator('.office-viewer-body')).toContainText('水分子几何优化');
	await expect(viewer(page).locator('.office-viewer-body')).toContainText('收敛四项都达标');
	await expect(page.locator('.office-viewer-status')).toHaveText('');
});

test('an old .doc says it cannot be shown, and offers the file', async ({ page }) => {
	await fileRow(page, 'assets/old.doc').dblclick();
	await expect(viewer(page).locator('.office-note')).toContainText('旧的 Office 格式');
	await expect(viewer(page).getByRole('link', { name: '下载' })).toHaveAttribute('download', 'old.doc');
});

test('cards: a link alone to an office file is a card with the file’s start, written back as the link', async ({ page }) => {
	const cards = editor(page).locator('.office-card');
	await expect(cards).toHaveCount(2);
	await cards.last().scrollIntoViewIfNeeded();
	await expect(cards.first().locator('.office-card-thumb')).toHaveAttribute('data-state', 'drawn');
	await expect(cards.first().locator('.office-card-meta')).toHaveText(/^PowerPoint · 2 张 · \d+(\.\d)? KB$/u);
	await expect(cards.last().locator('.office-card-thumb td', { hasText: 'PC2' })).toHaveCount(1);

	await cards.first().getByRole('button', { name: '预览' }).click();
	await expect(viewer(page).locator('.office-viewer-body')).toContainText('收敛四项都达标');
	await page.keyboard.press('Escape');
	await expect(viewer(page)).toBeHidden();

	// Selected and deleted as one block; the other card stays as written.
	await cards.first().locator('.office-card-meta').click();
	await page.keyboard.press('Backspace');
	await expect(cards).toHaveCount(1);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).not.toContain('slides.pptx');
	expect(savedMarkdown()).toContain('> [能量](./assets/energies.xlsx)');
});

test('an office file dragged from the panel goes in as its card', async ({ page }) => {
	const paragraph = editor(page).locator('p', { hasText: '结尾段落' });
	await paragraph.scrollIntoViewIfNeeded();
	const box = (await paragraph.boundingBox())!;
	await page.evaluate(({ x, y }) => {
		const transfer = new DataTransfer();
		transfer.setData('application/x-studio-file', 'assets/report.docx');
		document.elementFromPoint(x, y)!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
	}, { x: box.x + box.width - 2, y: box.y + box.height / 2 });
	const card = editor(page).locator('.office-card');
	await expect(card.locator('.office-card-name')).toHaveText('report.docx');
	await expect(card.locator('.office-card-meta')).toHaveText(/^Word 文档 · 1 页 · /u);
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/结尾段落。?\n\n\[report\.docx\]\(\.\/assets\/report\.docx\)/u);
});
