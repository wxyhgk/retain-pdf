import { expect, test } from '@playwright/test';

import { openStudio, removeArticle, resetFixture, writeArticle } from './studio.ts';

// The notes open, a tab each over the note (wiring/note-tabs.ts), as SiYuan's documents.

test.beforeEach(() => {
	resetFixture();
	writeArticle('tab-two', '---\ntitle: 第二篇\npubDate: 2026-10-01\ndraft: true\n---\n\n第二篇的字。\n');
	writeArticle('tab-three', '---\ntitle: 第三篇\nicon: 🧪\npubDate: 2026-10-01\ndraft: true\n---\n\n第三篇的字。\n');
});
test.afterEach(() => {
	removeArticle('tab-two');
	removeArticle('tab-three');
});

test('a page opened comes in as a tab after the one shown; a tab clicked shows its note; × lets it go; kept when the Studio is opened again', async ({ page }) => {
	await openStudio(page);
	const tabs = page.locator('#note-tabs .note-tab-name');
	await expect(tabs).toHaveText(['Studio 测试夹具']);
	// The only one: no × (there is always the note shown).
	await expect(page.locator('#note-tabs .note-tab-close')).toHaveCount(0);

	await page.locator('#article-list .page-row', { hasText: '第三篇' }).click();
	await expect(page.locator('#breadcrumb-title')).toHaveText('第三篇');
	await expect(tabs).toHaveText(['Studio 测试夹具', '🧪 第三篇']);
	// Opened from the first tab: after it, not at the end.
	await tabs.first().click();
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');
	await page.locator('#article-list .page-row', { hasText: '第二篇' }).click();
	await expect(tabs).toHaveText(['Studio 测试夹具', '第二篇', '🧪 第三篇']);
	await expect(page.locator('#note-tabs [aria-selected="true"]')).toHaveText('第二篇');

	// Again a tab of one open: no tab more, it shown.
	await page.locator('#article-list .page-row', { hasText: '第三篇' }).click();
	await expect(tabs).toHaveCount(3);
	await expect(page.locator('#note-tabs [aria-selected="true"]')).toHaveText('🧪 第三篇');

	// Named anew: its tab too.
	await page.locator('#article-list .page-row', { hasText: '第二篇' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('第二篇');
	await page.locator('#article-title-input').fill('第二篇（改）');
	await page.locator('#article-title-input').press('Enter');
	await expect(tabs.nth(1)).toHaveText('第二篇（改）');

	// The shown one let go: the one after it shown.
	await page.locator('#note-tabs .note-tab', { hasText: '第二篇（改）' }).locator('.note-tab-close').click();
	await expect(tabs).toHaveText(['Studio 测试夹具', '🧪 第三篇']);
	await expect(page.locator('#breadcrumb-title')).toHaveText('第三篇');

	// Kept for the next time.
	await page.reload();
	await expect(tabs).toHaveText(['Studio 测试夹具', '🧪 第三篇']);
});
