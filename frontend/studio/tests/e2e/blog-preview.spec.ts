import { expect, test } from '@playwright/test';

import { resetFixture } from './studio.ts';

// The Studio on its own server (serve.mjs): the blog's pages (「博客首页」, 在博客上打开) on the blog's own, started for them.

test.skip(process.env.E2E_ASTRO === '1', 'only the Studio on its own server sends the blog elsewhere');
test.beforeEach(() => resetFixture());

test('the blog asked of the Studio’s server is shown by the blog’s own, started for it', async ({ page, baseURL }) => {
	test.setTimeout(150_000);
	await page.goto('/blog/', { timeout: 120_000 });
	const shown = new URL(page.url());
	expect(shown.port).not.toBe(new URL(baseURL!).port);
	expect(shown.pathname).toBe('/blog/');
	// The blog's own page (its articles are blog/'s, here the test root's: none).
	await expect(page.locator('body')).toContainText('按时间记下的推导、计算和实验');
});
