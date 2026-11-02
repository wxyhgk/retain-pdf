import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, writeArticle } from './studio.ts';

// 查找替换: ⌘F in the article (find-in-article.ts), ⌘⇧F in all of them (ReplaceDialog). Never in code or formulas.

const article = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');

test.beforeEach(() => resetFixture());

test('⌘F finds in the article, not in its code; ↩ goes to the next; one replaced, then all; Esc closes', async ({ page }) => {
	appendToFixture('\nQQXYZ 算一次，再 QQXYZ 一次，最后 qqxyz。\n\n```text\nQQXYZ\n```\n');
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('ControlOrMeta+f');
	const bar = page.locator('.find-bar');
	await expect(bar).toBeVisible();
	await expect(page.locator('#find-query')).toBeFocused();
	await page.keyboard.type('QQXYZ');
	await expect(bar.locator('.find-count')).toHaveText('1/3');
	await expect(editor(page).locator('.pm-find-match')).toHaveCount(3);
	await page.keyboard.press('Enter');
	await expect(bar.locator('.find-count')).toHaveText('2/3');
	await bar.getByRole('button', { name: '区分大小写' }).click();
	await expect(bar.locator('.find-count')).toHaveText('1/2');

	await page.locator('#find-replacement').fill('PBE0');
	await bar.getByRole('button', { name: '替换这一处' }).click();
	await expect(bar.locator('.find-count')).toHaveText('1/1');
	await bar.getByRole('button', { name: '替换这篇里的每一处' }).click();
	await expect(bar.locator('.find-count')).toHaveText('没有');
	await expect(editor(page).locator('p', { hasText: '算一次' })).toHaveText('PBE0 算一次，再 PBE0 一次，最后 qqxyz。');
	await page.keyboard.press('Escape');
	await expect(bar).toBeHidden();
	await expect(editor(page).locator('.pm-find-match')).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain('PBE0 算一次，再 PBE0 一次，最后 qqxyz。\n\n```text\nQQXYZ\n```');
});

test('⌘⇧F: every place in every article listed first; only those ticked changed, each article kept as a version first', async ({ page }) => {
	appendToFixture('\n用 QQXYZ-D3 优化。\n');
	writeArticle('find-other', '---\ntitle: 另一篇\npubDate: 2026-10-01\ndraft: true\n---\n\nQQXYZ-D3 算能量，QQXYZ-D3 算频率。\n\n$QQXYZ-D3$\n');
	try {
		await openStudio(page);
		await page.keyboard.press('ControlOrMeta+Shift+f');
		const dialog = page.locator('#replace-dialog');
		await expect(dialog).toBeVisible();
		await page.locator('#replace-find').fill('QQXYZ-D3');
		await page.locator('#replace-with').fill('QQXYZ-D3(BJ)');
		await page.locator('#replace-find').press('Enter');
		await expect(dialog.locator('.replace-article')).toHaveCount(2);
		await expect(dialog.locator('.replace-place')).toHaveCount(3);
		await expect(page.locator('#replace-status')).toHaveText('2 篇文章里有 3 处');
		// The second place of 另一篇 left as it is.
		const other = dialog.locator('.replace-article', { hasText: '另一篇' });
		await other.locator('.replace-place').nth(1).locator('input').uncheck();
		await expect(page.locator('#replace-apply')).toHaveText('替换勾选的 2 处');
		await page.locator('#replace-apply').click();
		await expect(page.locator('#replace-status')).toContainText('已替换 2 篇文章里的 2 处');
		// Looked for again: the words are still in what they became (QQXYZ-D3(BJ)), and in the one not ticked.
		await expect(dialog.locator('.replace-place')).toHaveCount(3);

		expect(article('find-other')).toContain('QQXYZ-D3(BJ) 算能量，QQXYZ-D3 算频率。\n\n$QQXYZ-D3$');
		expect(readdirSync(join(process.env.STUDIO_BLOG_DIR!, 'find-other', 'ai', 'history')).some((name) => name.endsWith('-before-change.md'))).toBe(true);
		// The article open: changed on disk, shown so (chosen in the dialog: not reviewed again).
		await expect.poll(savedMarkdown).toContain('用 QQXYZ-D3(BJ) 优化。');
		await page.keyboard.press('Escape');
		await expect(editor(page).locator('p', { hasText: '优化' })).toHaveText('用 QQXYZ-D3(BJ) 优化。');
		expect(existsSync(join(process.env.STUDIO_BLOG_DIR!, 'find-other', 'index.md'))).toBe(true);
	} finally {
		removeArticle('find-other');
	}
});
