import { expect, test } from '@playwright/test';

import { resetFixture } from './studio.ts';

// The blog's pages (「博客首页」, 在博客上打开) are the notes' own blog's, on its own server (serve.mjs, blogPreview): notes
// without one (as the tests' are: no astro.config.mjs) are told so, not left waiting.

test.beforeEach(() => resetFixture());

test('the blog asked of notes that have none says so', async ({ page }) => {
	const answer = await page.goto('/blog/');
	expect(answer?.status()).toBe(503);
	await expect(page.locator('body')).toHaveText('笔记文件夹里没有博客（astro.config.mjs）');
});
