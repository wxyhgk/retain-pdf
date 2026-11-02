import { expect, test, type Page } from '@playwright/test';

import { openStudio, removeArticle, resetFixture, slug, writeArticle } from './studio.ts';

// As in Notion: the pages that link to this one, under its properties; all
// the articles as a table that sorts and filters, or as a board.

const TITLE = 'Studio 测试夹具';
const LINKERS = ['linker-one', 'linker-two'];

const article = (title: string, body: string, extra = '') =>
	`---\ntitle: ${title}\ndescription: '${title}的简介'\npubDate: 2026-10-01\n${extra}---\n\n${body}\n`;

test.beforeEach(() => {
	for (const folder of LINKERS) removeArticle(folder);
	resetFixture();
});
test.afterAll(() => {
	for (const folder of LINKERS) removeArticle(folder);
	resetFixture();
});

const breadcrumb = (page: Page) => page.locator('#breadcrumb-title');

test('the articles that link here, and the words around each link; new ones as they are written', async ({ page }) => {
	writeArticle('linker-one', article('先读这篇', `开始前先看 [夹具](/blog/${slug}/) 的写法。`, 'draft: true\n'));
	await openStudio(page);
	const backlinks = page.locator('#page-backlinks');
	await expect(backlinks.locator('.backlinks-toggle')).toHaveText('↗ 1 篇文章链接到这里');
	await expect(backlinks.locator('.backlinks-list')).toBeHidden();
	await backlinks.locator('.backlinks-toggle').click();
	await expect(backlinks.locator('.backlinks-title')).toHaveText('▤先读这篇草稿');
	await expect(backlinks.locator('.backlinks-context')).toHaveText('开始前先看 夹具 的写法。');

	// Written by something else (an AI in the terminal): the list follows.
	writeArticle('linker-two', article('也提到了', `- 列表里的 [链接](https://wxyhgk.github.io/blog/${slug}/#top)`));
	await expect(backlinks.locator('.backlinks-toggle')).toHaveText('↗ 2 篇文章链接到这里');

	// Opened at the paragraph that links.
	await backlinks.locator('.backlinks-context', { hasText: '开始前先看' }).click();
	await expect(breadcrumb(page)).toHaveText('先读这篇');
	await expect(page.locator('.editor-scroll .search-flash')).toBeVisible();
	await expect(backlinks).toBeHidden();
});

test('all the articles as a table: sorted by a column, filtered, and opened', async ({ page }) => {
	writeArticle('linker-one', article('甲 草稿', '正文', 'draft: true\ntags: [甲组]\n'));
	writeArticle('linker-two', article('乙 维基', '正文', 'kind: wiki\ntags: [乙组]\n'));
	await openStudio(page);
	await page.locator('#open-table').click();
	await expect(page).toHaveURL(/[?&]pages/u);
	const view = page.locator('#table-view');
	await expect(view.locator('.table-heading')).toContainText('全部文章');
	const names = view.locator('.table-row .table-name');
	await expect(names).toHaveCount(3);

	await view.locator('th.col-title .table-sort').click();
	await expect(names).toHaveText(['甲 草稿', '乙 维基', TITLE]);
	await view.locator('th.col-title .table-sort').click();
	await expect(names).toHaveText([TITLE, '乙 维基', '甲 草稿']);
	await expect(view.locator('th.col-title')).toHaveAttribute('aria-sort', 'descending');

	await view.locator('.table-search').fill('乙');
	await expect(names).toHaveText(['乙 维基']);
	await expect(view.locator('.table-count')).toHaveText(/^1 \/ 3 篇$/u);
	await view.locator('.table-search').fill('');
	// The fixture is a draft too.
	await view.locator('.table-filter[aria-label="状态"]').selectOption('published');
	await expect(names).toHaveText(['乙 维基']);
	await view.locator('.table-filter[aria-label="状态"]').selectOption('');
	await view.locator('.table-filter[aria-label="标签"]').selectOption('甲组');
	await expect(names).toHaveText(['甲 草稿']);
	await view.locator('.table-filter[aria-label="标签"]').selectOption('');

	// The settings stay for the next visit.
	await page.reload();
	await expect(page.locator('#table-view')).toBeVisible();
	await expect(names).toHaveText([TITLE, '乙 维基', '甲 草稿']);

	await view.locator('.table-row', { hasText: '乙 维基' }).click();
	await expect(breadcrumb(page)).toHaveText('乙 维基');
	await expect(view).toBeHidden();
	await expect(page).not.toHaveURL(/[?&]pages/u);
});

test('all the articles as a board, in columns by status or by kind', async ({ page }) => {
	writeArticle('linker-one', article('甲 草稿', '正文', 'draft: true\n'));
	writeArticle('linker-two', article('乙 维基', '正文', 'kind: wiki\n'));
	await openStudio(page);
	await page.locator('#open-table').click();
	const view = page.locator('#table-view');
	await view.locator('.table-layout[data-layout="board"]').click();
	const column = (name: string) => view.locator('.board-column', { has: page.locator('.board-name', { hasText: name }) });
	// The fixture is a draft too.
	await expect(column('草稿').locator('.board-card')).toHaveCount(2);
	await expect(column('草稿')).toContainText('甲 草稿');
	await expect(column('已发布').locator('.board-card')).toHaveText([/乙 维基/u]);
	await view.locator('.table-filter[aria-label="分组"]').selectOption('kind');
	await expect(column('维基').locator('.board-card')).toHaveText([/乙 维基/u]);
	await column('维基').locator('.board-card').click();
	await expect(breadcrumb(page)).toHaveText('乙 维基');
});
