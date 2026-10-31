import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, writeArticle } from './studio.ts';

// 数据库 (editor/database/, server/articles/databases.mjs), as Notion's: a page of its own, the pages under it its rows,
// shown in another page by a block naming it; columns of kinds, named in their menu; values in the rows' own pages;
// sorted, filtered, searched; columns renamed, of another kind, hidden, taken away (the rows with them); a board by a
// choice; rows dragged, deleted.

const page = (folder: string) => readFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, 'index.md'), 'utf8');
/** The database the tests' rows are of (its page, under the fixture). */
const DB = 'db-table';
/** A row of it; with `parent` null, a page under the fixture. */
const row = (slug: string, title: string, props = '', order = 0, parent: string | null = DB) =>
	writeArticle(slug, `---\ntitle: ${title}\npubDate: 2026-10-01\ndraft: true\nparent: ${parent ?? 'studio-fixture'}\n${order ? `order: ${order}\n` : ''}${props ? `props: ${props}\n` : ''}---\n\n正文。\n`);
/** The database, of these settings, shown at the end of the fixture. */
const database = (config: object) => {
	writeArticle(DB, `---\ntitle: ''\npubDate: 2026-10-01\ndraft: true\ntype: database\nparent: studio-fixture\n---\n\n\`\`\`database\n${JSON.stringify(config, null, 2)}\n\`\`\`\n`);
	appendToFixture(`\n\`\`\`database\n{"source":"${DB}"}\n\`\`\`\n`);
};
const ROWS = ['db-row-a', 'db-row-b', 'db-row-c', DB];

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

test('/数据库: a database of its own made under this page, shown here; columns added and named; rows made under it, their values in their pages; sorted; its whole page', async ({ page: p }) => {
	row('db-row-a', '一个子页面', '', 0, null);
	await openStudio(p);
	await insertDatabase(p);
	await expect(block(p)).toHaveAttribute('data-database', /^note-/u);
	const made = (await block(p).getAttribute('data-database'))!;
	expect(page(made)).toMatch(/^type: database$/mu);
	expect(page(made)).toMatch(/^parent: studio-fixture$/mu);
	await expect(block(p).locator('.database-row')).toHaveCount(0);
	await addColumn(p, '能量', 'number');
	await addColumn(p, '方法', 'select');

	// Rows made: pages under it, their titles typed in the table.
	for (const title of ['TS1 优化', 'IM1 优化']) {
		await block(p).locator('[data-database-add-row]').click();
		await expect(block(p).locator('[data-database-input]')).toBeFocused();
		await p.keyboard.type(title);
		await p.keyboard.press('Enter');
		await expect(block(p).locator('.database-title', { hasText: title })).toBeVisible();
	}
	await expect(block(p).locator('.database-row')).toHaveCount(2);
	const second = (await block(p).locator('.database-row').nth(1).getAttribute('data-row'))!;
	expect(page(second)).toMatch(new RegExp(`^parent: "?${made}"?$`, 'mu'));

	await block(p).locator(`[data-row="${second}"] [data-column="能量"] [data-database-cell]`).click();
	await expect(p.locator('[data-database-input]')).toBeFocused();
	await p.keyboard.type('-76.52');
	await p.keyboard.press('Enter');
	await expect.poll(() => page(second)).toContain('props: { "能量": -76.52 }');

	// A choice typed: made, chosen, the picker gone (one choice).
	await block(p).locator(`[data-row="${second}"] [data-column="方法"] [data-database-choices]`).click();
	await p.keyboard.type('PBE0');
	await expect(p.locator('[data-database-create-option]')).toBeVisible();
	await p.keyboard.press('Enter');
	await expect.poll(() => page(second)).toContain('"方法": "PBE0"');
	await expect(p.locator('[data-database-new-option]')).toHaveCount(0);
	await expect(block(p).locator(`[data-row="${second}"] [data-column="方法"] .db-pill`)).toHaveText('PBE0');

	// Sorted by 能量 from its menu: the row with none last; the order a chip under the toolbar; its settings its page's.
	await block(p).locator('[data-column-head="能量"]').click();
	await p.locator('[data-database-sort-asc]').click();
	await expect(block(p).locator('.database-row').first()).toHaveAttribute('data-row', second);
	await expect(block(p).locator('[data-database-sort-chip]')).toContainText('能量');
	await expect.poll(() => page(made)).toMatch(/```database\n\{\n {2}"columns": \[[\s\S]*"name": "能量",[\s\S]*"sorts": \[\n {4}\{\n {6}"column": "能量",\n {6}"dir": "asc"/u);

	// Its name typed above it: its page's title. This page: a block naming it, nothing more.
	await block(p).locator('[data-database-title]').fill('计算记录');
	await p.keyboard.press('Enter');
	await expect.poll(() => page(made)).toContain("title: '计算记录'");
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain(`\`\`\`database\n{"source":"${made}"}\n\`\`\``);
	// In the tree: the page under this one that is no row a page still; the database a page, its rows under it, folded.
	await expect(p.locator('#article-list .page-item[data-slug="db-row-a"]')).toBeVisible();
	await expect(p.locator(`#article-list .page-item[data-slug="${second}"]`)).toHaveCount(0);
	const node = p.locator(`#article-list .page-item.is-database[data-slug="${made}"]`);
	await expect(node).toContainText('计算记录');
	await expect(node.locator('.page-count')).toHaveText('2');
	await node.hover();
	await node.locator('.page-toggle').click();
	await expect(p.locator(`#article-list .page-item[data-slug="${second}"]`)).toBeVisible();

	// Its whole page: the database the page, its name the page's title (none above it).
	await block(p).locator('[data-database-open-page]').click();
	await expect(p.locator('#article-title-input')).toHaveValue('计算记录');
	const own = editor(p).locator('.database-block.is-own');
	await expect(own.locator('.database-row')).toHaveCount(2);
	await expect(own.locator('[data-database-title]')).toHaveCount(0);
	await expect(own.locator('[data-database-sort-chip]')).toContainText('能量');
});

test('a block from before databases were pages: made one as it is shown (a page under this one), its rows under it, the block naming it', async ({ page: p }) => {
	const legacy = (slug: string, title: string, props: string, order: number) =>
		writeArticle(slug, `---\ntitle: ${title}\npubDate: 2026-10-01\ndraft: true\nparent: studio-fixture\norder: ${order}\ndatabase: olddb001\n${props ? `props: ${props}\n` : ''}---\n\n正文。\n`);
	legacy('db-row-a', 'A', '{ "能量": -1 }', 10);
	legacy('db-row-b', 'B', '', 20);
	row('db-row-c', '普通页面', '', 0, null);
	appendToFixture('\n```database\n' + JSON.stringify({ id: 'olddb001', title: '旧的', columns: [{ name: '能量', type: 'number' }], view: 'table' }, null, 2) + '\n```\n');
	await openStudio(p, { settled: false });
	await expect(block(p).locator('.database-row')).toHaveCount(2);
	await expect(block(p).locator('[data-row="db-row-a"] [data-column="能量"]')).toHaveText('-1');
	const made = (await block(p).getAttribute('data-database'))!;
	expect(made).toMatch(/^note-/u);
	expect(page(made)).toContain("title: '旧的'");
	expect(page('db-row-a')).toMatch(new RegExp(`^parent: "?${made}"?$`, 'mu'));
	expect(page('db-row-a')).not.toMatch(/^database:/mu);
	expect(page('db-row-c')).toMatch(/^parent: studio-fixture$/mu);
	await expect(block(p).locator('[data-database-title]')).toHaveValue('旧的');
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain(`{"source":"${made}"}`);
	await expect(p.locator(`#article-list .page-item.is-database[data-slug="${made}"]`)).toContainText('旧的');
});

test('a whole-page database made from the tree: its columns and rows made in it, its settings an edit of its page; a block naming one gone says so', async ({ page: p }) => {
	await openStudio(p);
	const fixture = p.locator('#article-list .page-item[data-slug="studio-fixture"]');
	await fixture.hover();
	await fixture.locator('.page-more').click();
	await p.getByRole('menuitem', { name: '在下面新建数据库' }).click();
	// Opened, its title to type; the database the page.
	await expect(p.locator('#article-title-input')).toBeFocused();
	await p.keyboard.type('文献');
	const own = editor(p).locator('.database-block.is-own');
	await expect(own).toBeVisible();
	const made = (await own.getAttribute('data-database'))!;
	expect(page(made)).toMatch(/^type: database$/mu);
	await own.locator('[data-database-add-column]').click();
	await p.locator('[data-database-column-type="number"]').click();
	await p.locator('[data-database-column-name]').fill('年份');
	await p.keyboard.press('Enter');
	await own.locator('[data-database-add-row]').click();
	await expect(own.locator('[data-database-input]')).toBeFocused();
	await p.keyboard.type('Hartree–Fock 综述');
	await p.keyboard.press('Enter');
	await expect(own.locator('.database-row')).toHaveCount(1);
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page(made)).toMatch(/^title: ["']文献["']$/mu);
	expect(page(made)).toMatch(/^type: database$/mu);
	await expect.poll(() => page(made)).toMatch(/"name": "年份",\n\s+"type": "number"/u);
	// Not shown in the page it is under: only in the tree, there.
	expect(page('studio-fixture')).not.toContain(made);
	await expect(p.locator(`#article-list .page-item.is-database[data-slug="${made}"]`)).toContainText('文献');

	// A block naming a database not there.
	appendToFixture('\n```database\n{"source":"no-such-db"}\n```\n');
	await openStudio(p);
	await expect(block(p).locator('[data-database-missing]')).toContainText('no-such-db');
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
	await expect(block(p).locator('[data-database-count]')).toHaveText(/^计数\s*1$/u);
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
	return ROWS.filter((slug) => slug !== DB).sort((a, b) => orderOf(a) - orderOf(b));
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
	// Beside the table first (its side peek); its whole page from there.
	await p.locator('[data-database-peek-page]').click();
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
	// The new choice is the database's: in its page.
	await expect.poll(() => page(DB)).toMatch(/"options": \[\n\s+"B3LYP",\n\s+"PBE0"\n\s+\]/u);
});

test('the title column and a column made wider by their right edge dragged, kept in the settings', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "备注": "x" }');
	database({ columns: [{ name: '备注', type: 'text' }], view: 'table' });
	await openStudio(p);
	const drag = async (name: string, by: number) => {
		const cell = block(p).locator(`[data-row="db-row-a"] [data-column="${name}"]`);
		const before = (await cell.boundingBox())!.width;
		const handle = block(p).locator(`[data-database-resize="${name}"]`);
		await handle.scrollIntoViewIfNeeded();
		const box = (await handle.boundingBox())!;
		await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await p.mouse.down();
		await p.mouse.move(box.x + box.width / 2 + by / 2, box.y + box.height / 2, { steps: 4 });
		await p.mouse.move(box.x + box.width / 2 + by, box.y + box.height / 2, { steps: 4 });
		await p.mouse.up();
		await expect.poll(async () => Math.round((await cell.boundingBox())!.width)).toBe(Math.round(before + by));
	};
	await drag('标题', 120);
	await expect.poll(() => page(DB)).toContain('"titleWidth": 400');
	await drag('备注', -60);
	await expect.poll(() => page(DB)).toMatch(/"name": "备注",\n\s+"type": "text",\n\s+"width": 120/u);
	// Narrower than the least: the least.
	await drag('标题', -400 + 80);
	await expect.poll(() => page(DB)).toContain('"titleWidth": 80');
});

test('a column on as many lines as its values take, from its menu; the titles too', async ({ page: p }) => {
	row('db-row-a', '一个很长很长的标题，长到一行放不下，看它是不是换行显示出来', '{ "备注": "也很长的一段备注文字，一行放不下，要换行才能看全" }');
	database({ columns: [{ name: '备注', type: 'text' }], view: 'table' });
	await openStudio(p);
	const cell = block(p).locator('[data-row="db-row-a"] [data-column="备注"]');
	const before = (await cell.boundingBox())!.height;
	await block(p).locator('[data-column-head="备注"]').click();
	await p.locator('[data-database-wrap="备注"]').click();
	await p.keyboard.press('Escape');
	await expect.poll(async () => (await cell.boundingBox())!.height).toBeGreaterThan(before + 10);
	await block(p).locator('[data-column-head="标题"]').click();
	await p.locator('[data-database-wrap="标题"]').click();
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page(DB)).toMatch(/"name": "备注",\n\s+"type": "text",\n\s+"wrap": true[\s\S]*"titleWrap": true/u);
});

test('the table from the keys, as a spreadsheet: moved through, typed in, a box ticked, a block copied, a block pasted (rows made)', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "能量": -1 }', 10);
	row('db-row-b', 'B', '', 20);
	database({ columns: [{ name: '能量', type: 'number' }, { name: '收敛', type: 'checkbox' }, { name: '方法', type: 'select', options: ['PBE0'] }], view: 'table' });
	await openStudio(p);
	const cell = (slug: string, column: string) => block(p).locator(`[data-row="${slug}"] > [data-column="${column}"]`);
	// A cell clicked: typed in; Esc: chosen, the keys the table's.
	await cell('db-row-a', '能量').locator('[data-database-cell]').click();
	await expect(p.locator('[data-database-input]')).toBeFocused();
	await p.keyboard.press('Escape');
	await expect(cell('db-row-a', '能量')).toHaveClass(/is-cursor/u);
	await expect(block(p).locator('.db-table')).toBeFocused();
	// ↓ and a digit: the cell below typed in, beginning with it.
	await p.keyboard.press('ArrowDown');
	await expect(cell('db-row-b', '能量')).toHaveClass(/is-cursor/u);
	await p.keyboard.type('7');
	await expect(p.locator('[data-database-input]')).toHaveValue('7');
	await p.keyboard.type('.5');
	await p.keyboard.press('Enter');
	await expect.poll(() => page('db-row-b')).toContain('"能量": 7.5');
	await expect(block(p).locator('.db-table')).toBeFocused();
	// → and Space: the box ticked.
	await p.keyboard.press('ArrowRight');
	await p.keyboard.press(' ');
	await expect.poll(() => page('db-row-b')).toContain('"收敛": true');
	// Enter on a choice: its picker.
	await p.keyboard.press('ArrowRight');
	await p.keyboard.press('Enter');
	await expect(p.locator('[data-database-option="PBE0"]')).toBeVisible();
	await p.keyboard.press('Escape');
	await expect(p.locator('[data-database-option="PBE0"]')).toBeHidden();

	// A block chosen (a click, ⇧ and a click), copied as a spreadsheet's cells.
	await cell('db-row-a', '标题').click({ position: { x: 4, y: 10 } });
	await cell('db-row-b', '能量').click({ modifiers: ['Shift'] });
	await expect(block(p).locator('.is-in-range')).toHaveCount(4);
	const copied = await block(p).locator('.db-table').evaluate((table) => {
		const data = new DataTransfer();
		table.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
		return data.getData('text/plain');
	});
	expect(copied).toBe('A\t-1\nB\t7.5');

	// A spreadsheet's block pasted from the cell chosen: the rows there changed, one more made; a choice new, added.
	await cell('db-row-a', '能量').click({ position: { x: 4, y: 10 } });
	await p.keyboard.press('Escape');
	await block(p).locator('.db-table').evaluate((table) => {
		const data = new DataTransfer();
		data.setData('text/plain', '-76.41\tyes\tB3LYP\r\n-76.52\tno\tPBE0\r\n-1.5\t✓\tB3LYP\r\n');
		table.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
	});
	await expect.poll(() => page('db-row-a')).toContain('props: { "能量": -76.41, "收敛": true, "方法": "B3LYP" }');
	await expect.poll(() => page('db-row-b')).toContain('props: { "能量": -76.52, "方法": "PBE0" }');
	await expect(block(p).locator('.database-row')).toHaveCount(3);
	await expect(block(p).locator('.database-row').nth(2).locator('[data-column="能量"]')).toHaveText('-1.5');
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page(DB)).toMatch(/"options": \[\n\s+"PBE0",\n\s+"B3LYP"\n\s+\]/u);
});

test('under each column, what is worked out of it: chosen from its kind’s, kept in the block, as the rows filtered', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "能量": -76.4, "方法": "PBE0" }', 10);
	row('db-row-b', 'B', '{ "能量": -76.6, "方法": "B3LYP" }', 20);
	database({ columns: [{ name: '能量', type: 'number' }, { name: '方法', type: 'select', options: ['PBE0', 'B3LYP'] }], view: 'table' });
	await openStudio(p);
	await expect(block(p).locator('[data-database-count]')).toHaveText(/^计数\s*2$/u);
	await block(p).locator('[data-database-calc="能量"]').click();
	await expect(p.locator('[data-database-calc-kind]')).toHaveText(['不计算', '计数', '已填', '为空', '不重复', '已填占比', '为空占比', '求和', '平均', '中位数', '最小', '最大', '范围']);
	await p.locator('[data-database-calc-kind="sum"]').click();
	await expect(block(p).locator('[data-database-calc="能量"]')).toHaveText(/^求和\s*-153$/u);
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page(DB)).toMatch(/"calcs": \{\n\s+"能量": "sum"\n\s+\}/u);
});

test('rows chosen by their boxes (⇧, a run of them): a value set in all, deleted together', async ({ page: p }) => {
	row('db-row-a', 'A', '', 10);
	row('db-row-b', 'B', '', 20);
	row('db-row-c', 'C', '', 30);
	database({ columns: [{ name: '方法', type: 'select', options: ['PBE0', 'B3LYP'] }, { name: '备注', type: 'text' }], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-row="db-row-a"]').hover();
	await block(p).locator('[data-database-choose-row="db-row-a"]').click();
	await block(p).locator('[data-database-choose-row="db-row-c"]').click({ modifiers: ['Shift'] });
	await expect(block(p).locator('.database-row.is-chosen')).toHaveCount(3);
	await block(p).locator('[data-database-choose-row="db-row-b"]').click();
	await expect(block(p).locator('[data-database-chosen]')).toContainText('已选 2 行');

	await block(p).locator('[data-database-chosen-edit]').click();
	await p.locator('[data-database-chosen-column="方法"]').click();
	await p.locator('[data-database-chosen-value="B3LYP"]').click();
	await expect.poll(() => page('db-row-a')).toContain('"方法": "B3LYP"');
	await expect.poll(() => page('db-row-c')).toContain('"方法": "B3LYP"');
	expect(page('db-row-b')).not.toContain('方法');

	await block(p).locator('[data-database-chosen-delete]').click();
	await p.locator('#delete-page-all').click();
	await expect(block(p).locator('.database-row')).toHaveCount(1);
	await expect(block(p).locator('[data-database-chosen]')).toHaveCount(0);
	// The box at the head: all the rows.
	await block(p).locator('[data-database-choose-all]').click();
	await expect(block(p).locator('.database-row.is-chosen')).toHaveCount(1);
	await p.keyboard.press('Escape');
});

test('the table grouped by a choice: each group its rows, folded, its 新建 with its choice', async ({ page: p }) => {
	row('db-row-a', 'A', '{ "状态": "完成" }', 10);
	row('db-row-b', 'B', '{ "状态": "进行中" }', 20);
	row('db-row-c', 'C', '{ "状态": "完成" }', 30);
	database({ columns: [{ name: '状态', type: 'select', options: ['进行中', '完成'] }], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-database-settings]').click();
	await p.locator('[data-database-table-group-menu]').click();
	await p.locator('[data-database-table-group="状态"]').click();
	await p.keyboard.press('Escape');
	const group = (value: string) => block(p).locator(`[data-database-group="${value}"]`);
	await expect(group('进行中').locator('.database-row')).toHaveCount(1);
	await expect(group('完成').locator('.database-row')).toHaveCount(2);
	await expect(group('完成').locator('.db-group-count')).toHaveText('2');
	await group('完成').locator('[data-database-group-toggle="完成"]').click();
	await expect(group('完成').locator('.database-row')).toHaveCount(0);
	await group('进行中').locator('[data-database-group-add="进行中"]').click();
	await expect(p.locator('[data-database-input]')).toBeFocused();
	await p.keyboard.type('D');
	await p.keyboard.press('Enter');
	await expect(group('进行中').locator('.database-row')).toHaveCount(2);
	await p.keyboard.press('ControlOrMeta+s');
	await expect.poll(() => page(DB)).toContain('"tableGroup": "状态"');
});

test('a row opened beside the table: its title, its values changed as in the table, its text; the next row; closed; its whole page instead, as set', async ({ page: p }) => {
	writeArticle('db-row-a', '---\ntitle: TS1 优化\npubDate: 2026-10-01\ndraft: true\nparent: db-table\norder: 10\nprops: { "能量": -76.4 }\n---\n\n用 **B3LYP** 优化，$E = -76.4$。\n');
	row('db-row-b', 'IM1 优化', '', 20);
	database({ columns: [{ name: '能量', type: 'number' }, { name: '收敛', type: 'checkbox' }], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-row="db-row-a"]').hover();
	await block(p).locator('[data-row="db-row-a"] [data-database-open]').click();
	const peek = p.locator('[data-database-peek="db-row-a"]');
	await expect(peek.locator('[data-database-peek-title]')).toHaveValue('TS1 优化');
	await expect(peek.locator('[data-database-peek-text] strong')).toHaveText('B3LYP');
	await expect(peek.locator('[data-database-peek-text] .katex')).toBeVisible();
	// A value changed there: in its page, and in the table.
	await peek.locator('[data-column="收敛"] [data-database-checkbox]').click();
	await expect.poll(() => page('db-row-a')).toContain('"收敛": true');
	await expect(block(p).locator('[data-row="db-row-a"] [data-column="收敛"] [data-database-checkbox]')).toHaveAttribute('aria-checked', 'true');
	await peek.locator('[data-database-peek-title]').fill('TS1 再优化');
	await peek.locator('[data-database-peek-title]').press('Enter');
	await expect.poll(() => page('db-row-a')).toContain("title: 'TS1 再优化'");
	// ↓: the next row; Esc: closed, the article still open.
	await peek.locator('[data-database-peek-next]').click();
	await expect(p.locator('[data-database-peek="db-row-b"] [data-database-peek-title]')).toHaveValue('IM1 优化');
	await p.keyboard.press('Escape');
	await expect(p.locator('[data-database-peek]')).toHaveCount(0);
	await expect(p.locator('#article-title-input')).toHaveValue('Studio 测试夹具');
	// Set to open as a whole page.
	await block(p).locator('[data-database-settings]').click();
	await p.locator('[data-database-open-as-menu]').click();
	await p.locator('[data-database-open-as="page"]').click();
	await p.keyboard.press('Escape');
	await block(p).locator('[data-row="db-row-b"]').hover();
	await block(p).locator('[data-row="db-row-b"] [data-database-open]').click();
	await expect(p.locator('#article-title-input')).toHaveValue('IM1 优化');
});

test('a long row beside the table: shown at once, its formulas drawn as they come on the screen; its picture from its own folder, as wide as written', async ({ page: p }) => {
	const formulas = Array.from({ length: 80 }, (_, at) => `第 ${at + 1} 段：\n\n$$\n\\sum_{i=1}^{${at + 2}} \\frac{1}{i^2} = S_{${at}}\n$$`).join('\n\n');
	writeArticle('db-row-a', `---\ntitle: 长的\npubDate: 2026-10-01\ndraft: true\nparent: db-table\n---\n\n![图](./img/a.png){width=50%}\n\n${formulas}\n`);
	database({ columns: [], view: 'table' });
	await openStudio(p);
	await block(p).locator('[data-row="db-row-a"]').hover();
	await block(p).locator('[data-row="db-row-a"] [data-database-open]').click();
	const text = p.locator('[data-database-peek-text]');
	await expect(text.locator('.ai-math-display')).toHaveCount(80);
	// Far below: its LaTeX till scrolled to.
	await expect(text.locator('.ai-math-display').last()).toHaveClass(/is-waiting/u);
	await p.locator('.db-peek-scroll').evaluate((scroller) => scroller.scrollTo(0, scroller.scrollHeight));
	await expect(text.locator('.ai-math-display').last().locator('.katex')).toBeVisible();
	const picture = text.locator('img');
	await expect(picture).toHaveAttribute('src', /\/db-row-a\/files\/img\/a\.png$/u);
	await expect(picture).toHaveAttribute('style', /width: 50%/u);
	await expect(text).not.toContainText('{width');
});

