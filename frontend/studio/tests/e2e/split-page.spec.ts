import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, slug, writeFixtureFile } from './studio.ts';

// 转成子页面, as SiYuan turns a heading into a document: a heading's section made a page under the article,
// with the pictures it shows; a link to it stays in its place.

const blog = () => process.env.STUDIO_BLOG_DIR!;
let made: string[] = [];

test.beforeEach(() => resetFixture());
test.afterEach(() => {
	for (const folder of made) removeArticle(folder);
	made = [];
});

async function menuOf(page: Page, text: string) {
	const heading = editor(page).locator('h2', { hasText: text });
	await heading.scrollIntoViewIfNeeded();
	await heading.hover();
	const handle = page.locator('.milkdown-block-handle .operation-item').last();
	await expect(handle).toBeVisible();
	await handle.click();
	await expect(page.locator('.milkdown-block-menu')).toHaveAttribute('data-show', 'true');
}

test('a heading’s section becomes a page under the article; a link to it stays in its place', async ({ page }) => {
	writeFixtureFile('img/plot.png', Buffer.from('89504e470d0a1a0a', 'hex'));
	appendToFixture('\n## 方法\n\n先算一遍。\n\n![图](./img/plot.png)\n\n### 细节\n\n细节内容。\n\n## 结果\n\n结果内容。\n');
	await openStudio(page);
	const before = new Set(readdirSync(blog()));
	await menuOf(page, '方法');
	await page.locator('.milkdown-block-menu [data-key="split"]').click();
	const link = editor(page).locator('p a', { hasText: '方法' });
	await expect(link).toHaveAttribute('href', /^\/blog\/note-\d{8}-\d{6}\/$/u);
	await expect(editor(page).getByText('先算一遍。')).toHaveCount(0);
	await expect(editor(page).getByText('细节内容。')).toHaveCount(0);
	await expect(editor(page).locator('h2', { hasText: '结果' })).toBeVisible();

	await expect.poll(() => readdirSync(blog()).filter((folder) => !before.has(folder))).toHaveLength(1);
	made = readdirSync(blog()).filter((folder) => !before.has(folder));
	const child = made[0]!;
	expect((await link.getAttribute('href'))).toBe(`/blog/${child}/`);
	const source = readFileSync(join(blog(), child, 'index.md'), 'utf8');
	expect(source).toMatch(/title: '方法'/u);
	expect(source).toMatch(new RegExp(`\\nparent: ${slug}\\n`, 'u'));
	expect(source).toMatch(/先算一遍。[\s\S]*### 细节[\s\S]*细节内容。/u);
	expect(source).not.toMatch(/结果内容/u);
	expect(readdirSync(join(blog(), child, 'img'))).toContain('plot.png');
	await expect(page.locator('.page-item', { has: page.locator('.page-title', { hasText: /^方法$/u }) })).toHaveCSS('--depth', '1');
});

test('a page merged back into the article above it: a section there again, in place of the link', async ({ page }) => {
	appendToFixture('\n## 方法\n\n先算一遍。\n\n## 结果\n\n结果内容。\n');
	await openStudio(page);
	const before = new Set(readdirSync(blog()));
	await menuOf(page, '方法');
	await page.locator('.milkdown-block-menu [data-key="split"]').click();
	await expect(editor(page).locator('p a', { hasText: '方法' })).toBeVisible();
	await expect.poll(() => readdirSync(blog()).filter((folder) => !before.has(folder))).toHaveLength(1);
	made = readdirSync(blog()).filter((folder) => !before.has(folder));
	// Saved, as the author would have it before going on.
	await page.keyboard.press('ControlOrMeta+s');

	page.once('dialog', (dialog) => void dialog.accept());
	const row = page.locator('.page-item', { has: page.locator('.page-title', { hasText: /^方法$/u }) }).locator('.page-row');
	await row.click({ button: 'right' });
	await page.getByRole('menuitem', { name: '并入上级页面…' }).click();
	await expect(editor(page).locator('h2', { hasText: '方法' })).toBeVisible();
	await expect(editor(page).getByText('先算一遍。')).toBeVisible();
	await expect(editor(page).locator('p a', { hasText: '方法' })).toHaveCount(0);
	await expect(page.locator('.page-title', { hasText: /^方法$/u })).toHaveCount(0);
	expect(readdirSync(blog())).not.toContain(made[0]);
	expect(readFileSync(join(blog(), slug, 'index.md'), 'utf8')).toMatch(/## 方法\n\n先算一遍。\n\n## 结果/u);
});

test('`[[` with a title no page has makes a page of it under the article, linked there; the writing goes on', async ({ page }) => {
	await openStudio(page);
	const before = new Set(readdirSync(blog()));
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' 见 [[');
	await page.locator('#quick-find-input').fill('新的分支');
	const create = page.locator('.quick-find-item', { hasText: '新建子页面「新的分支」' });
	await expect(create).toBeVisible();
	await create.click();
	const link = editor(page).locator('a', { hasText: '新的分支' });
	await expect(link).toHaveAttribute('href', /^\/blog\/note-\d{8}-\d{6}\/$/u);
	made = readdirSync(blog()).filter((folder) => !before.has(folder));
	expect(made).toHaveLength(1);
	expect(readFileSync(join(blog(), made[0]!, 'index.md'), 'utf8')).toMatch(new RegExp(`title: '新的分支'[\\s\\S]*\\nparent: ${slug}\\n`, 'u'));
	await expect(page).toHaveURL(new RegExp(`article=${slug}(?:&|$)`, 'u'));
	await expect(page.locator('.page-item', { has: page.locator('.page-title', { hasText: /^新的分支$/u }) })).toHaveCSS('--depth', '1');
});
