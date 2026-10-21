import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { openStudio, removeArticle, resetFixture, slug, writeArticle } from './studio.ts';

// Pages under pages, as Notion and SiYuan show them: a tree in the sidebar made from `parent:` (each page
// still a folder of its own in blog/), folded and unfolded, made under a page, moved by dragging, and on
// the blog the pages above in the path and the pages under at the end.

const TITLE = 'Studio 测试夹具';
const PAGES = ['tree-method', 'tree-results', 'tree-ai', 'tree-made', 'tree-top', 'tree-under'];
const item = (page: Page, title: string) => page.locator('.page-item', { has: page.locator('.page-title', { hasText: new RegExp(`^${title}$`, 'u') }) });
const source = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');

/**
 * Drags the page `from` onto `onto` (a page's title, or the list's room below the pages), as the browser does it:
 * its drag events, sent here (the browser's own drag, driven by the mouse, at times takes no dragover at all).
 */
async function drag(tab: Page, from: string, onto: string | 'below') {
	const data = await tab.evaluateHandle(() => new DataTransfer());
	const source = item(tab, from);
	const target = onto === 'below' ? tab.locator('#article-list') : item(tab, onto).locator('.page-row');
	await source.dispatchEvent('dragstart', { dataTransfer: data });
	await target.dispatchEvent('dragover', { dataTransfer: data });
	await target.dispatchEvent('drop', { dataTransfer: data });
	await source.dispatchEvent('dragend', { dataTransfer: data });
}

function page(title: string, extra = '', draft = true): string {
	return `---\ntitle: '${title}'\ndescription: '${title}的简介'\npubDate: '2026-10-21'\ntags: []\ndraft: ${draft}\n${extra}---\n\n${title}的正文。\n`;
}

test.beforeEach(() => {
	for (const folder of PAGES) removeArticle(folder);
	resetFixture();
});
test.afterAll(() => {
	for (const folder of PAGES) removeArticle(folder);
});

test('the pages under a page show under it, folded and unfolded; one an AI writes shows there at once', async ({ page: tab }) => {
	writeArticle('tree-method', page('方法', `parent: ${slug}\n`));
	writeArticle('tree-results', page('结果', 'parent: tree-method\n'));
	await openStudio(tab);
	await expect(item(tab, '方法')).toHaveCSS('--depth', '1');
	await expect(item(tab, '结果')).toHaveCSS('--depth', '2');
	const toggle = item(tab, TITLE).locator('.page-toggle');
	await toggle.click();
	await expect(item(tab, '方法')).toHaveCount(0);
	// Folded still, the next time.
	await tab.reload();
	await expect(item(tab, TITLE)).toBeVisible();
	await expect(item(tab, '方法')).toHaveCount(0);
	await item(tab, TITLE).locator('.page-toggle').click();
	await expect(item(tab, '结果')).toBeVisible();

	// Written into blog/ while the Studio is open (by the AI in the terminal).
	writeArticle('tree-ai', page('AI 写的子页面', `parent: ${slug}\n`));
	await expect(item(tab, 'AI 写的子页面')).toHaveCSS('--depth', '1', { timeout: 10_000 });
});

test('the ＋ beside a page makes a page under it at once: no dialog, no folder name, its title to type', async ({ page: tab }) => {
	await openStudio(tab);
	const before = new Set(readdirSync(process.env.STUDIO_BLOG_DIR!));
	await item(tab, TITLE).hover();
	await item(tab, TITLE).locator('.page-add').click();
	await expect(tab.locator('#article-title-input')).toBeFocused();
	await tab.keyboard.type('新的子页面');
	await tab.keyboard.press('Enter');
	await expect(item(tab, '新的子页面')).toHaveCSS('--depth', '1');
	const made = readdirSync(process.env.STUDIO_BLOG_DIR!).filter((folder) => !before.has(folder));
	expect(made).toHaveLength(1);
	expect(made[0]).toMatch(/^note-\d{8}-\d{6}$/u);
	PAGES.push(made[0]!);
	expect(source(made[0]!)).toMatch(new RegExp(`\\nparent: ${slug}\\n`, 'u'));
	// Above its title, the page it is under; a click opens that one.
	await tab.locator('.page-path-link', { hasText: TITLE }).click();
	await expect(tab).toHaveURL(new RegExp(`article=${slug}`, 'u'));
});

test('published, a page made so gets its address from its title', async ({ page: tab }) => {
	await openStudio(tab);
	const before = new Set(readdirSync(process.env.STUDIO_BLOG_DIR!));
	await tab.locator('#new-article').click();
	await expect(tab.locator('#article-title-input')).toBeFocused();
	await tab.keyboard.type('基组的选择');
	await tab.keyboard.press('Enter');
	const made = readdirSync(process.env.STUDIO_BLOG_DIR!).filter((folder) => !before.has(folder))[0]!;
	PAGES.push(made, 'ji-zu-de-xuan-ze');
	await tab.locator('#publish-article').click();
	await expect(tab).toHaveURL(/article=ji-zu-de-xuan-ze/u);
	expect(readdirSync(process.env.STUDIO_BLOG_DIR!)).not.toContain(made);
	expect(source('ji-zu-de-xuan-ze')).toMatch(/draft: false/u);
});

test('a page dragged onto another goes under it; dragged below the pages, to the top; never under itself', async ({ page: tab }) => {
	writeArticle('tree-top', page('顶层一页'));
	writeArticle('tree-under', page('下面一页', 'parent: tree-top\n'));
	await openStudio(tab);
	await drag(tab, '顶层一页', '下面一页');
	// Under a page under it: refused, nothing changes.
	expect(source('tree-top')).not.toMatch(/parent/u);
	await drag(tab, '下面一页', TITLE);
	await expect(item(tab, '下面一页')).toHaveCSS('--depth', '1');
	await expect.poll(() => source('tree-under')).toMatch(new RegExp(`parent: "?${slug}"?`, 'u'));
	await drag(tab, '下面一页', 'below');
	await expect(item(tab, '下面一页')).toHaveCSS('--depth', '0');
	await expect.poll(() => source('tree-under')).not.toMatch(/parent/u);
});

test('the open page dragged under another is put there as an edit of it, saved', async ({ page: tab }) => {
	writeArticle('tree-top', page('顶层一页'));
	await openStudio(tab);
	await drag(tab, TITLE, '顶层一页');
	await expect(item(tab, TITLE)).toHaveCSS('--depth', '1');
	await expect.poll(() => source(slug)).toMatch(/parent: "?tree-top"?/u);
});
