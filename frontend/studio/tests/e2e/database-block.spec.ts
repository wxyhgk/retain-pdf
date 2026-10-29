import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, removeArticle, resetFixture, savedMarkdown, writeArticle } from './studio.ts';

// 数据库 (editor/database/, server/articles/databases.mjs): the pages under the page as rows; columns of kinds; values
// in the rows' own pages; sorted, filtered; a board by a choice, a card dragged to another list taking it.

const page = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');
const ROW_A = '---\ntitle: TS1 优化\npubDate: 2026-10-01\ndraft: true\nparent: studio-fixture\nprops: { "能量": -76.4 }\n---\n\n正文。\n';
const ROW_B = '---\ntitle: IM1 优化\npubDate: 2026-10-01\ndraft: true\nparent: studio-fixture\n---\n\n正文。\n';

test.beforeEach(() => resetFixture());

async function insertDatabase(p: Page): Promise<void> {
	await editor(p).locator('p', { hasText: '结尾段落' }).click();
	await p.keyboard.press('End');
	await p.keyboard.press('Enter');
	await p.keyboard.type('/数据库');
	await expect(p.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('数据库');
	await p.waitForTimeout(100);
	await p.keyboard.press('Enter');
}

async function addColumn(p: Page, name: string, type: string): Promise<void> {
	await p.locator('[data-database-add-column]').click();
	await p.locator('[data-database-column-name]').fill(name);
	await p.locator(`[data-database-column-type="${type}"]`).click();
	await p.getByRole('button', { name: '加上' }).click();
}

test('/数据库: the pages under this one as rows; columns added; a value set lands in its page; a row made', async ({ page: p }) => {
	writeArticle('db-row-a', ROW_A);
	writeArticle('db-row-b', ROW_B);
	try {
		await openStudio(p);
		await insertDatabase(p);
		const block = editor(p).locator('.database-block');
		await expect(block.locator('.database-row')).toHaveCount(2);
		await addColumn(p, '能量', 'number');
		await addColumn(p, '方法', 'select');
		// The value already in the row's page shows.
		await expect(block.locator('[data-row="db-row-a"] [data-column="能量"]')).toHaveText('-76.4');

		await block.locator('[data-row="db-row-b"] [data-column="能量"] [data-database-cell]').click();
		await p.keyboard.type('-76.52');
		await p.keyboard.press('Enter');
		await expect.poll(() => page('db-row-b')).toContain('props: { "能量": -76.52 }');
		await block.locator('[data-row="db-row-b"] [data-column="方法"] [data-database-choices]').click();
		await p.locator('[data-database-new-option]').fill('PBE0');
		await p.keyboard.press('Enter');
		await expect.poll(() => page('db-row-b')).toContain('"方法": "PBE0"');
		// One choice made: its popover gone.
		await expect(p.locator('[data-database-new-option]')).toHaveCount(0);

		// Sorted by 能量, low first.
		await block.locator('[data-column-head="能量"]').click();
		await p.getByRole('menuitem', { name: '升序' }).click();
		await expect(block.locator('.database-row').first()).toHaveAttribute('data-row', 'db-row-b');

		// A row made: a page under this one, its title typed in the table.
		await block.locator('[data-database-add-row]').click();
		await expect(block.locator('.database-row')).toHaveCount(3);
		// Its title taking the keys once it is made.
		await expect(block.locator('[data-database-input]')).toBeFocused();
		await p.keyboard.type('TS2 频率');
		await p.keyboard.press('Enter');
		await expect(block.locator('.database-title', { hasText: 'TS2 频率' })).toBeVisible();

		// The settings are the block's, in the article.
		await p.keyboard.press('ControlOrMeta+s');
		await expect.poll(savedMarkdown).toMatch(/```database\n\{\n {2}"columns": \[[\s\S]*"name": "能量",[\s\S]*"sort": \{\n {4}"column": "能量",\n {4}"dir": "asc"/u);
	} finally {
		removeArticle('db-row-a');
		removeArticle('db-row-b');
		for (const folder of readdirSync(process.env.STUDIO_BLOG_DIR!)) if (folder.startsWith('note-')) removeArticle(folder);
	}
});

test('the board: lists by a choice; a card dragged to another list takes its choice', async ({ page: p }) => {
	writeArticle('db-row-a', ROW_A.replace('props: { "能量": -76.4 }', 'props: { "状态": "在算" }'));
	writeArticle('db-row-b', ROW_B);
	try {
		await openStudio(p);
		await insertDatabase(p);
		await addColumn(p, '状态', 'select');
		const block = editor(p).locator('.database-block');
		// The choices known so far: one typed in a row.
		await block.locator('[data-row="db-row-b"] [data-column="状态"] [data-database-choices]').click();
		await p.locator('[data-database-new-option]').fill('完成');
		await p.keyboard.press('Enter');
		await expect(p.locator('[data-database-new-option]')).toHaveCount(0);
		await block.locator('[data-row="db-row-a"] [data-column="状态"] [data-database-choices]').click();
		await p.locator('[data-database-new-option]').fill('在算');
		await p.keyboard.press('Enter');
		await expect(p.locator('[data-database-new-option]')).toHaveCount(0);

		await block.locator('[data-database-view="board"]').click();
		await expect(block.locator('[data-board-list="在算"] [data-board-card]')).toHaveCount(1);
		await block.locator('[data-board-card="db-row-a"]').dragTo(block.locator('[data-board-list="完成"]'));
		await expect(block.locator('[data-board-list="完成"] [data-board-card]')).toHaveCount(2);
		await expect.poll(() => page('db-row-a')).toContain('"状态": "完成"');
	} finally {
		removeArticle('db-row-a');
		removeArticle('db-row-b');
	}
});

