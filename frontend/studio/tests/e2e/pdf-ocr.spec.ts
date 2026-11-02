import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, writeFixtureFile } from './studio.ts';

// OCR 成子页面: a PDF of the article read by PaddleOCR's online service (a stand-in here: fake-agents/paddleocr,
// which writes what the service gave for a page) into a page under the article, linked under the line linking to the PDF.

const pdf = readFileSync(fileURLToPath(new URL('./fixtures/office/report.pdf', import.meta.url)));
let made = '';

test.beforeEach(() => {
	resetFixture();
	writeFixtureFile('assets/report.pdf', pdf);
	appendToFixture('\n[report.pdf](./assets/report.pdf)\n');
});
test.afterEach(() => made && removeArticle(made));

test('a line linking to a PDF reads it into a page under the article, linked under that line; the page has its text, formula and picture', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	// A PDF dropped in is a line linking to it.
	await editor(page).locator('p', { hasText: 'report.pdf' }).hover();
	await page.locator('.milkdown-block-handle .operation-item').last().click();
	await page.locator('.milkdown-block-menu [data-key="ocr"]').click();

	// The page at once, linked under the card.
	const line = editor(page).locator('p.pm-page-link', { hasText: 'report' });
	await expect(line).toBeVisible();
	made = /\/blog\/([^/]+)\//u.exec((await line.locator('a').getAttribute('href')) ?? '')![1]!;
	await expect(page.locator('#task-tray .task-item', { hasText: 'PaddleOCR：report' })).toHaveAttribute('data-state', 'done');
	await expect.poll(savedMarkdown).toContain(`[report](/blog/${made}/)`);

	// Read: opened from what says so.
	await page.locator('.studio-toast', { hasText: '已识别成子页面「report」' }).getByRole('button', { name: '打开' }).click();
	await expect(page).toHaveURL(new RegExp(`article=${made}`, 'u'));
	await expect(editor(page).locator('h2')).toHaveText('势能面上的过渡态');
	await expect(editor(page).locator('.pm-display-math .katex')).toHaveCount(1);
	await expect(editor(page).locator('img[src*="img_in_image_box_6_343_832_762.jpg"]')).toHaveCount(1);
	await expect(editor(page).locator('table td', { hasText: '-188.40' })).toHaveCount(1);
	await expect(page.locator('.page-path-link', { hasText: 'Studio 测试夹具' })).toBeVisible();
});
