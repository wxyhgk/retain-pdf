import { expect, test } from '@playwright/test';

import { openStudio, resetFixture } from './studio.ts';

// 常用: pages starred (☆ in the bar, a page's menu), at the top of the left column; kept on this machine.

test.beforeEach(() => resetFixture());

test('a page starred from the bar is in 常用, opened from there, and unstarred from its menu or the tree’s', async ({ page }) => {
	await openStudio(page);
	const favorites = page.locator('#favorites');
	await expect(favorites).toHaveCount(0);
	const star = page.locator('#page-favorite');
	await expect(star).toHaveAttribute('aria-pressed', 'false');
	await star.click();
	await expect(star).toHaveAttribute('aria-pressed', 'true');
	await expect(favorites.getByRole('button')).toHaveText(['Studio 测试夹具']);

	// Kept across a reload; opened from there.
	await page.reload();
	await expect(page.locator('#favorites').getByRole('button')).toHaveText(['Studio 测试夹具']);
	await page.locator('#favorites').getByRole('button', { name: 'Studio 测试夹具' }).click();
	await expect(page.locator('#breadcrumb-title')).toHaveText('Studio 测试夹具');

	// Unstarred from its own menu (the right button there).
	await page.locator('#favorites').getByRole('button', { name: 'Studio 测试夹具' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: '移出常用' }).click();
	await expect(page.locator('#favorites')).toHaveCount(0);
	await expect(page.locator('#page-favorite')).toHaveAttribute('aria-pressed', 'false');

	// And starred from the tree's menu.
	await page.locator('#article-list .page-row', { hasText: 'Studio 测试夹具' }).click({ button: 'right' });
	await page.getByRole('menuitem', { name: '加入常用' }).click();
	await expect(page.locator('#favorites').getByRole('button')).toHaveText(['Studio 测试夹具']);
});
