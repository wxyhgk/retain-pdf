import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, slug } from './studio.ts';

// 页面 (/page), as Notion's: a page made under the article, a line linking to it where the slash was, and the
// editor goes into it, its title to type. The line is a Markdown link (`[标题](/blog/<folder>/)`) that follows
// the page's title (the server changes it as the page is retitled), and shows as a page that opens with a click.

const made: string[] = [];
const blog = () => process.env.STUDIO_BLOG_DIR!;
const source = (folder: string) => readFileSync(join(blog(), folder, 'index.md'), 'utf8');

test.beforeEach(() => resetFixture());
test.afterEach(() => {
	for (const folder of made.splice(0)) removeArticle(folder);
});

test('/页面 makes a page under the article, linked on its own line, and goes into it; the line follows its title and opens it', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	const before = new Set(readdirSync(blog()));
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/页面');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('页面');
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');

	// In the new page, its title to type.
	await expect(page.locator('#article-title-input')).toBeFocused();
	const folder = readdirSync(blog()).find((name) => !before.has(name))!;
	made.push(folder);
	expect(source(folder)).toMatch(new RegExp(`\\nparent: ${slug}\\n`, 'u'));
	await expect(page).toHaveURL(new RegExp(`article=${folder}`, 'u'));
	// The article it is under saved first, with the line linking to it.
	expect(savedMarkdown()).toMatch(new RegExp(`结尾段落。\\n\\n\\[无标题\\]\\(/blog/${folder}/\\)\\n`, 'u'));

	await page.keyboard.type('量子化学笔记');
	await page.keyboard.press('Enter');
	await expect.poll(savedMarkdown).toContain(`[量子化学笔记](/blog/${folder}/)`);

	// Back in the article above, the line is a page; a click goes into it.
	await page.locator('#article-list').getByText('Studio 测试夹具', { exact: true }).click();
	const line = editor(page).locator('p.pm-page-link', { hasText: '量子化学笔记' });
	await expect(line).toBeVisible();
	await expect(editor(page).locator('p.pm-page-link')).toHaveCount(1);
	await line.locator('a').click();
	await expect(page).toHaveURL(new RegExp(`article=${folder}`, 'u'));
	await expect(page.locator('#article-title-input')).toHaveValue('量子化学笔记');
});

test('page lines stay pages when a line is written under them', async ({ page }) => {
	appendToFixture('\n[测试计算](/blog/test-calc/)\n\n[公式测试](/blog/test-formula/)\n');
	await openStudio(page);
	const pages = editor(page).locator('p.pm-page-link');
	await expect(pages).toHaveText(['测试计算', '公式测试']);
	await editor(page).locator('p', { hasText: '公式测试' }).evaluate((line) => {
		const range = document.createRange();
		range.selectNodeContents(line);
		range.collapse(false);
		getSelection()!.removeAllRanges();
		getSelection()!.addRange(range);
	});
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('打字后');
	await expect(editor(page).locator('p', { hasText: /^打字后$/u })).toHaveCount(1);
	await expect(pages).toHaveText(['测试计算', '公式测试']);
});
