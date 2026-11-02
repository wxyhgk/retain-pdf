import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug } from './studio.ts';

// 历史版本, as Notion's page history: what is written is kept every ten minutes as it is saved (the article as it
// was before the save), besides the versions kept before changes on disk; any of them is compared with the article
// and brought back, through review.

test.beforeEach(() => {
	resetFixture();
	rmSync(join(process.env.STUDIO_BLOG_DIR!, slug, 'ai', 'history'), { recursive: true, force: true });
});

test('a save keeps the article as it was before; saved again soon, nothing more; it comes back through review', async ({ page }) => {
	await openStudio(page);
	const before = savedMarkdown();
	await editor(page).getByText('结尾段落。').click();
	await page.keyboard.press('End');
	await page.keyboard.type('第一次写的');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	await page.keyboard.type('，又写的');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');

	await page.locator('#page-menu').click();
	await page.getByText('历史版本…').click();
	const history = page.locator('#history-dialog');
	await expect(history.locator('.trash-day')).toHaveText(['今天']);
	await expect(history.locator('.trash-name')).toHaveText(['自动存档']);
	await history.locator('.trash-item').getByRole('button', { name: '对比并恢复' }).click();
	await expect(page.locator('#review-count')).toHaveText(/^这个历史版本和现在有 \d+ 处不同$/u);
	await page.locator('#review-bar').getByRole('button', { name: '全部接受' }).click();
	await expect(editor(page)).not.toContainText('第一次写的');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toBe(before);
});
