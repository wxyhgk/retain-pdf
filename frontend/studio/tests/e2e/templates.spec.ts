import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, removeArticle, resetFixture } from './studio.ts';

// Page templates (templates/, here the tests' .studio-templates beside their blog/): a page from one, a page
// kept as one, one put in a page (/模板).

const blog = () => process.env.STUDIO_BLOG_DIR!;
const templates = () => join(blog(), '.studio-templates');
const title = (page: Page) => page.locator('#breadcrumb-title');
const two = (number: number) => String(number).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
/** The articles there are now; those made by a test are taken away after it. */
let before: string[] = [];
const titleOf = (folder: string) => /^title: ['"]?(.*?)['"]?$/mu.exec(readFileSync(join(blog(), folder, 'index.md'), 'utf8'))?.[1] ?? '';
const made = () => readdirSync(blog()).filter((folder) => !folder.startsWith('.') && !before.includes(folder));

test.beforeEach(() => {
	resetFixture();
	rmSync(templates(), { recursive: true, force: true });
	mkdirSync(templates(), { recursive: true });
	writeFileSync(join(templates(), 'journal.md'), "---\nname: 日志\ntitle: '{{date}}'\n---\n\n## 今天做了什么\n\n- 写于 {{date}}\n");
	writeFileSync(join(templates(), 'calculation.md'), "---\nname: 计算记录\ntitle: '{{date}} 计算记录'\n---\n\n## 体系\n\n《{{title}}》\n");
	before = readdirSync(blog());
});
test.afterEach(() => {
	for (const folder of made()) removeArticle(folder);
	rmSync(templates(), { recursive: true, force: true });
});

test('⌘K > 新建：计算记录 makes a page from the template, its title and its text filled in', async ({ page }) => {
	await openStudio(page);
	await page.keyboard.press('ControlOrMeta+k');
	await page.locator('#quick-find-input').fill('>计算记录');
	await page.locator('#quick-find-dialog .quick-find-item', { hasText: '新建：计算记录' }).click();
	await expect(title(page)).toHaveText(`${today} 计算记录`);
	await expect(editor(page).locator('h2')).toHaveText('体系');
	await expect(editor(page)).toContainText(`《${today} 计算记录》`);
});

test('a page kept as a template (⋯ › 存为模板…), then put in another page with /模板', async ({ page }) => {
	await openStudio(page);
	page.once('dialog', (dialog) => void dialog.accept('我的模板'));
	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '存为模板…' }).click();
	await expect(page.locator('.studio-toast')).toContainText('已存为模板「我的模板」');
	const kept = readdirSync(templates()).find((file) => readFileSync(join(templates(), file), 'utf8').includes('name: 我的模板'));
	expect(kept).toBeTruthy();
	expect(readFileSync(join(templates(), kept!), 'utf8')).toContain('结尾段落');

	writeFileSync(join(templates(), 'calculation.md'), '---\nname: 计算记录\n---\n\n放进来的一段。\n');
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/模板');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('模板');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await page.getByRole('menuitem', { name: '计算记录' }).click();
	await expect(editor(page).locator('p', { hasText: '放进来的一段。' })).toBeVisible();
});
