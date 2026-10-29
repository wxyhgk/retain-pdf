import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, writeArticle } from './studio.ts';

// 数据库 (editor/database/, server/articles/databases.mjs), as Notion's: the pages under the page as rows; columns of
// kinds, named in their menu; values in the rows' own pages; sorted, filtered, searched; columns renamed, of another
// kind, hidden, taken away (the rows with them); a board by a choice; rows dragged, deleted.

const page = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');
const row = (slug: string, title: string, props = '', order = 0) =>
	writeArticle(slug, `---\ntitle: ${title}\npubDate: 2026-10-01\ndraft: true\nparent: studio-fixture\n${order ? `order: ${order}\n` : ''}${props ? `props: ${props}\n` : ''}---\n\n正文。\n`);
const database = (config: object) => appendToFixture('\n```database\n' + JSON.stringify(config, null, 2) + '\n```\n');
const ROWS = ['db-row-a', 'db-row-b', 'db-row-c'];

test.beforeEach(() => resetFixture());
test.afterEach(() => {
	for (const folder of readdirSync(process.env.STUDIO_BLOG_DIR!)) if (ROWS.includes(folder) || folder.startsWith('note-')) removeArticle(folder);
});

const block = (p: Page) => editor(p).locator('.database-block');

async function insertDatabase(p: Page): Promise<void> {
	await editor(p).locator('p', { hasText: '结尾段落' }).click();
	await p.keyboard.press('End');
	await p.keyboard.press('Enter');
	await p.keyboard.type('/数据库');
	await expect(p.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('数据库');
	await p.waitForTimeout(100);
	await p.keyboard.press('Enter');
}

/** A column added by +: its kind picked, then named in the menu it opens with. */
async function addColumn(p: Page, name: string, type: string): Promise<void> {
	await block(p).locator('[data-database-add-column]').click();
	await p.locator(`[data-database-column-type="${type}"]`).click();
	const field = p.locator('[data-database-column-name]');
	await expect(field).toBeFocused();
	await field.fill(name);
	await p.keyboard.press('Enter');
	await expect(block(p).locator(`[data-column-head="${name}"]`)).toBeVisible();
}

test('/数据库: the pages under this one as rows; columns added and named; values set in their pages; sorted; a row made', async ({ page: p }) => {
	row('db-row-a', 'TS1 优化', '{ "能量": -76.4 }');
	row('db-row-b', 'IM1 优化');
	await openStudio(p);
	await insertDatabase(p);
	await expect(block(p).locator('.database-row')).toHaveCount(2);
	await addColumn(p, '能量', 'number');
	await addColumn(p, '方法', 'select');
	// The value already in the row's page shows.
	await expect(block(p).locator('[data-row="db-row-a"] [data-column="能量"]')).toHaveText('-76.4');

	await block(p).locator('[data-row="db-row-b"] [data-column="能量"] [data-database-cell]').click();
	await expect(p.locator('[data-database-input]')).toBeFocused();
	await p.keyboard.type('-76.52');
	await p.keyboard.press('Enter');
	await expect.poll(() => page('db-row-b')).toContain('props: { "能量": -76.52 }');

	// A choice typed: made, chosen, the picker gone (one choice).
	await block(p).locator('[data-row="db-row-b"] [data-column="方法"] [data-database-choices]').click();
	await p.keyboard.type('PBE0');
	await expect(p.locator('[data-database-create-option]')).toBeVisible();
	await p.keyboard.press('Enter');
	await expect.poll(() => page('db-row-b')).toContain('"方法": "PBE0"');
	await expect(p.locator('[data-database-new-option]')).toHaveCount(0);
	await expect(block(p).locator('[data-row="db-row-b"] [data-column="方法"] .db-pill')).toHaveText('PBE0');

	// Sorted by 能量, low first, from its menu; the order a chip under the toolbar.
	await block(p).locator('[data-column-head="能量"]').click();
	await p.locator('[data-database-sort-asc]').click();
	await expect(block(p).locator('.database-row').first()).toHaveAttribute('data-row', 'db-row-b');
	await expect(block(p).locator('[data-database-sort-chip]')).toContainText('能量');

	// A row made: a page under this one, its title typed in the table.
	await block(p).locator('[data-database-add-row]').click();
	await expect(block(p).locator('.database-row')).toHaveCount(3);
	await expect(block(p).locator('[data-database-input]')).toBeFocused();
	await p.keyboard.type('TS2 频率');
	await p.keyboard.press('Enter');
	await expect(block(p).locator('.database-title', { hasText: 'TS2 频率' })).toBeVisible();

	// Its name typed above it; the settings the block's, in the article.
	await block(p).locator('[data-database-title]').fill('计算记录');
	await p.keyboard.press('Enter');
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toMatch(/```database\n\{\n {2}"title": "计算记录",\n {2}"columns": \[[\s\S]*"name": "能量",[\s\S]*"sorts": \[\n {4}\{\n {6}"column": "能量",\n {6}"dir": "asc"/u);
});

test('a column renamed, of another kind, a choice renamed, hidden, taken away: the rows’ pages with it', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "方法": "PBE0", "能量": "-1.5", "备注": "x" }');
	row('db-row-b', 'B', '{ "方法": "B3LYP", "能量": "很低" }');
	database({ columns: [{ name: '方法', type: 'select', options: ['PBE0', 'B3LYP'] }, { name: '能量', type: 'text' }, { name: '备注', type: 'text' }], view: 'table' });
	await openStudio(p);
	await expect(block(p).locator('.database-row')).toHaveCount(2);

	await block(p).locator('[data-column-head="方法"]').click();
	await p.locator('[data-database-column-name]').fill('泛函');
	await p.keyboard.press('Enter');
	await expect.poll(() => page('db-row-a')).toContain('"泛函": "PBE0"');
	await expect(block(p).locator('[data-column-head="泛函"]')).toBeVisible();

	// 文字 → 数字: what is a number kept as one, the rest gone.
	await block(p).locator('[data-column-head="能量"]').click();
	await p.locator('[data-database-column-type-menu]').click();
	await p.locator('[data-database-column-type="number"]').click();
	await p.keyboard.press('Escape');
	await expect.poll(() => page('db-row-a')).toContain('"能量": -1.5');
	await expect.poll(() => page('db-row-b')).not.toContain('能量');

	// A choice renamed in its ⋯: in the rows that have it.
	await block(p).locator('[data-row="db-row-a"] [data-column="泛函"] [data-database-choices]').click();
	const option = p.locator('.db-option-row', { has: p.locator('[data-database-option="PBE0"]') });
	await option.hover();
	await option.locator('.db-option-more').click();
	await p.locator('[data-database-option-name]').fill('PBE0-D3');
	await p.keyboard.press('Enter');
	await expect.poll(() => page('db-row-a')).toContain('"泛函": "PBE0-D3"');
	await p.keyboard.press('Escape');

	// Hidden from ⋯, then taken away from its menu (asked first).
	await block(p).locator('[data-database-settings]').click();
	await p.locator('[data-database-shown="能量"]').click();
	await p.keyboard.press('Escape');
	await expect(block(p).locator('[data-column-head="能量"]')).toHaveCount(0);
	await block(p).locator('[data-column-head="备注"]').click();
	await p.locator('[data-database-delete-column]').click();
	await p.locator('[data-database-confirm-delete]').click();
	await expect(block(p).locator('[data-column-head="备注"]')).toHaveCount(0);
	await expect.poll(() => page('db-row-a')).not.toContain('备注');
});

test('filtered by a chip (a choice, a number), searched', async ({ page: p }) => {
	row('db-row-a', 'TS1', '{ "方法": "B3LYP", "能量": -76.4 }');
	row('db-row-b', 'IM1', '{ "方法": "PBE0", "能量": -76.5 }');
	row('db-row-c', 'TS2', '{ "方法": "B3LYP" }');
	database({ columns: [{ name: '方法', type: 'select', options: ['B3LYP', 'PBE0'] }, { name: '能量', type: 'number' }], view: 'table' });
	await openStudio(p);
	await expect(block(p).locator('.database-row')).toHaveCount(3);

	await block(p).locator('[data-database-filter]').click();
	await p.locator('[data-database-property="方法"]').click();
	await p.locator('[data-database-filter-option="B3LYP"]').click();
	await expect(block(p).locator('.database-row')).toHaveCount(2);
	await expect(block(p).locator('[data-database-filter-chip="方法"]')).toContainText('B3LYP');
	await p.keyboard.press('Escape');

	await block(p).locator('[data-database-add-filter]').click();
	await p.locator('[data-database-property="能量"]').click();
	await p.locator('[data-database-filter-op]').selectOption('lt');
	await p.locator('[data-database-filter-value]').fill('-76');
	await expect(block(p).locator('.database-row')).toHaveCount(1);
	await p.keyboard.press('Escape');
	await expect(block(p).locator('[data-database-filter-chip="能量"]')).toContainText('< -76');

	// The chips taken away, then searched.
	for (const column of ['能量', '方法']) {
		await block(p).locator(`[data-database-filter-chip="${column}"]`).click();
		await p.locator('[data-database-remove-filter]').click();
	}
	await expect(block(p).locator('.database-row')).toHaveCount(3);
	await block(p).locator('[data-database-search]').click();
	await p.keyboard.type('pbe');
	await expect(block(p).locator('.database-row')).toHaveCount(1);
	await expect(block(p).locator('[data-database-count]')).toHaveText('计数 1');
});

test('the board: lists by a choice; a card dragged to another list takes its choice; a list added', async ({ page: p }) => {
	row('db-row-a', 'TS1', '{ "状态": "在算" }');
	row('db-row-b', 'IM1', '{ "状态": "完成" }');
	database({ columns: [{ name: '状态', type: 'select', options: ['在算', '完成'] }], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-database-view="board"]').click();
	await expect(block(p).locator('[data-board-list="在算"] [data-board-card]')).toHaveCount(1);
	await block(p).locator('[data-board-card="db-row-a"]').dragTo(block(p).locator('[data-board-list="完成"]'));
	await expect(block(p).locator('[data-board-list="完成"] [data-board-card]')).toHaveCount(2);
	await expect.poll(() => page('db-row-a')).toContain('"状态": "完成"');

	await block(p).locator('[data-database-new-group]').click();
	await p.keyboard.type('排队');
	await p.keyboard.press('Enter');
	await expect(block(p).locator('[data-board-list="排队"]')).toBeVisible();
});

test('a row dragged by its ⋮⋮ to another place; deleted from its menu', async ({ page: p }) => {
	row('db-row-a', 'A', '', 10);
	row('db-row-b', 'B', '', 20);
	row('db-row-c', 'C', '', 30);
	database({ columns: [], view: 'table' });
	await openStudio(p);
	const order = () => block(p).locator('.database-row').evaluateAll((rows) => rows.map((each) => each.getAttribute('data-row')));
	await expect.poll(order).toEqual(['db-row-a', 'db-row-b', 'db-row-c']);
	await block(p).locator('[data-row="db-row-c"]').hover();
	await block(p).locator('[data-row="db-row-c"] [data-database-row-handle]').dragTo(block(p).locator('[data-row="db-row-a"]'), { targetPosition: { x: 40, y: 4 } });
	await expect.poll(order).toEqual(['db-row-c', 'db-row-a', 'db-row-b']);
	// The tree's order too, kept in the pages.
	await expect.poll(pagesOrder).toEqual(['db-row-c', 'db-row-a', 'db-row-b']);

	await block(p).locator('[data-row="db-row-b"]').hover();
	await block(p).locator('[data-row="db-row-b"] [data-database-row-handle]').click();
	await p.locator('[data-database-delete-row]').click();
	await p.locator('#delete-page-all').click();
	await expect(block(p).locator('.database-row')).toHaveCount(2);
});

/** The rows in the order their pages say (`order:`). */
function pagesOrder(): string[] {
	const orderOf = (slug: string) => Number(/^order: (\S+)$/mu.exec(page(slug))?.[1] ?? Infinity);
	return [...ROWS].sort((a, b) => orderOf(a) - orderOf(b));
}

test('a press in the database leaves the page where it is (the editor not focused, not scrolled back to its caret)', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "状态": "在算" }');
	database({ columns: [{ name: '状态', type: 'select', options: ['在算'] }], view: 'board', group: '状态' });
	await openStudio(p);
	await editor(p).locator('p', { hasText: '开头段落' }).click();
	const card = block(p).locator('[data-board-card="db-row-a"]');
	await card.scrollIntoViewIfNeeded();
	const scroll = p.locator('.editor-scroll');
	const before = await scroll.evaluate((element) => element.scrollTop);
	const box = (await card.boundingBox())!;
	await p.mouse.move(box.x + 20, box.y + 10);
	await p.mouse.down();
	await p.waitForTimeout(300);
	expect(await scroll.evaluate((element) => element.scrollTop)).toBe(before);
	await p.mouse.up();
});

test('a row’s own page: the database’s columns under its title, a value changed there saved with the page, a choice added to the database', async ({ page: p }) => {
	row('db-row-a', 'TS1 优化', '{ "方法": "B3LYP", "能量": -76.4, "收敛": true }');
	database({ columns: [{ name: '方法', type: 'select', options: ['B3LYP'] }, { name: '能量', type: 'number' }, { name: '收敛', type: 'checkbox' }, { name: '藏起来', type: 'text', hidden: true }], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-row="db-row-a"]').hover();
	await block(p).locator('[data-row="db-row-a"] [data-database-open]').click();
	await expect(p.locator('#article-title-input')).toHaveValue('TS1 优化');
	const properties = p.locator('[data-database-properties]');
	await expect(properties.locator('[data-row-property]')).toHaveText(['方法', '能量', '收敛']);
	await expect(properties.locator('[data-row-value="能量"]')).toHaveValue('-76.4');
	await expect(properties.locator('[data-row-value="收敛"] [role="checkbox"]')).toHaveAttribute('aria-checked', 'true');

	await properties.locator('[data-row-value="能量"]').fill('-76.41');
	await p.keyboard.press('Enter');
	await properties.locator('[data-row-value="收敛"] [role="checkbox"]').click();
	await properties.locator('[data-row-value="方法"]').click();
	await p.keyboard.type('PBE0');
	await p.keyboard.press('Enter');
	await expect(properties.locator('[data-row-value="方法"] .db-pill')).toHaveText('PBE0');
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page('db-row-a')).toContain('props: { "方法": "PBE0", "能量": -76.41 }');
	// The new choice is the database's: in its block, in the page it is in.
	await expect.poll(savedMarkdown).toMatch(/"options": \[\n\s+"B3LYP",\n\s+"PBE0"\n\s+\]/u);
});
