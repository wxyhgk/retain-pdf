import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { openSettings, openStudio, resetFixture } from './studio.ts';

// 语言: the Studio's, chosen in its settings (or the system's); the page and what the server says are in it.

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');
const savedLocale = () => {
	try {
		return JSON.parse(readFileSync(settingsFile(), 'utf8')).locale;
	} catch {
		return undefined;
	}
};

test.beforeEach(() => resetFixture());

test('语言 is chosen in the settings, kept there, and the page loads again in it', async ({ page }) => {
	await openStudio(page);
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
	// Every request says the page's language, for the server to answer in it.
	expect((await page.context().cookies()).find((cookie) => cookie.name === 'studio-locale')?.value).toBe('zh-CN');

	await openSettings(page, 'locale');
	const select = page.locator('#studio-locale');
	await expect(select).toHaveValue('system');
	await expect(select.locator('option')).toHaveText(['跟随系统', '中文']);
	await select.selectOption('zh-CN');
	await Promise.all([page.waitForEvent('load'), page.locator('#settings-locale').getByRole('button', { name: '保存' }).click()]);
	expect(savedLocale()).toBe('zh-CN');
	await expect(page.locator('html')).toHaveAttribute('data-studio-locale', 'zh-CN');

	await openSettings(page, 'locale');
	await expect(page.locator('#studio-locale')).toHaveValue('zh-CN');
	await page.locator('#studio-locale').selectOption('system');
	await Promise.all([page.waitForEvent('load'), page.locator('#settings-locale').getByRole('button', { name: '保存' }).click()]);
	expect(savedLocale()).toBeUndefined();
});

test('the server says why it cannot, in the language asked', async ({ page }) => {
	await openStudio(page);
	const answer = await page.evaluate(async () => {
		const response = await fetch('/api/studio/settings/locale', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: 'xx' }) });
		return { status: response.status, body: await response.json() };
	});
	expect(answer).toEqual({ status: 400, body: { error: '没有这种语言' } });
});
