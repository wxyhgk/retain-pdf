import { expect, test } from '@playwright/test';

import { openSettings, openStudio, resetFixture } from './studio.ts';

// 外观: light, dark, or the system's, followed as it changes (common/theme.ts); kept as the blog keeps it.

const theme = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.beforeEach(() => resetFixture());

test('设置 › 外观: dark at once and after a reload; the system’s followed as it changes; ⌘K switches', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await openStudio(page);
	expect(await theme(page)).toBe('light');
	const settings = await openSettings(page, 'theme');
	await settings.locator('[data-theme-choice="dark"]').click();
	expect(await theme(page)).toBe('dark');
	await expect(settings.locator('[data-theme-choice="dark"]')).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.locator('#crepe-editor .milkdown .ProseMirror')).toBeVisible();
	expect(await theme(page)).toBe('dark');

	await (await openSettings(page, 'theme')).locator('[data-theme-choice="system"]').click();
	expect(await theme(page)).toBe('light');
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect.poll(() => theme(page)).toBe('dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect.poll(() => theme(page)).toBe('light');
	await page.keyboard.press('Escape');

	await page.keyboard.press('ControlOrMeta+k');
	await page.locator('#quick-find-input').fill('>暗色');
	await page.locator('#quick-find-dialog .quick-find-item', { hasText: '切换亮色 / 暗色' }).click();
	expect(await theme(page)).toBe('dark');
	if (process.env.THEME_SHOT) {
		await page.waitForTimeout(1000);
		await page.screenshot({ path: process.env.THEME_SHOT });
	}
});
