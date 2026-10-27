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
 * `zone`: let go of on the page's top (just above it), middle (under it) or bottom (just below it).
 */
async function drag(tab: Page, from: string, onto: string | 'below', zone: 'before' | 'into' | 'after' = 'into') {
	const data = await tab.evaluateHandle(() => new DataTransfer());
	const source = item(tab, from);
	const target = onto === 'below' ? tab.locator('#article-list') : item(tab, onto);
	const box = (await target.boundingBox())!;
	const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height * { before: 0.1, into: 0.5, after: 0.9 }[zone] };
	await source.dispatchEvent('dragstart', { dataTransfer: data });
	await target.dispatchEvent('dragover', { dataTransfer: data, ...at });
	await target.dispatchEvent('drop', { dataTransfer: data, ...at });
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
	// In the bar, the page it is under; a click opens that one.
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
	// As Notion has it: a page block at the end of the page it went under (open here: shown at once, not as a change
	// to review), and none left in the page it came from.
	await expect(tab.locator('#crepe-editor .milkdown .ProseMirror p.pm-page-link').last()).toHaveText('下面一页');
	await expect(tab.locator('#review-bar')).toBeHidden();
	expect(source(slug)).toMatch(/\n\[下面一页\]\(\/blog\/tree-under\/\)\n$/u);
	expect(source('tree-top')).not.toContain('/blog/tree-under/');
	await drag(tab, '下面一页', 'below');
	await expect(item(tab, '下面一页')).toHaveCSS('--depth', '0');
	await expect.poll(() => source('tree-under')).not.toMatch(/parent/u);
	await expect.poll(() => source(slug)).not.toContain('/blog/tree-under/');
	await expect(tab.locator('#crepe-editor .milkdown .ProseMirror p.pm-page-link', { hasText: '下面一页' })).toHaveCount(0);
	await expect(tab.locator('#review-bar')).toBeHidden();
});

test('the open page dragged under another is put there as an edit of it, saved', async ({ page: tab }) => {
	writeArticle('tree-top', page('顶层一页'));
	await openStudio(tab);
	await drag(tab, TITLE, '顶层一页');
	await expect(item(tab, TITLE)).toHaveCSS('--depth', '1');
	await expect.poll(() => source(slug)).toMatch(/parent: "?tree-top"?/u);
});

test('a page let go of on the top or bottom of another goes just above or below it; the order is kept', async ({ page: tab }) => {
	writeArticle('tree-top', page('项目'));
	writeArticle('tree-method', page('第1章', 'parent: tree-top\n'));
	writeArticle('tree-results', page('第2章', 'parent: tree-top\n'));
	writeArticle('tree-ai', page('第10章', 'parent: tree-top\n'));
	await openStudio(tab);
	const under = () => tab.locator('.page-item').filter({ has: tab.locator('.page-title', { hasText: /^第\d+章$/u }) }).locator('.page-title').allTextContents();
	// Numbers in titles read as numbers.
	await expect.poll(under).toEqual(['第1章', '第2章', '第10章']);
	await drag(tab, '第10章', '第1章', 'before');
	await expect.poll(under).toEqual(['第10章', '第1章', '第2章']);
	await drag(tab, '第1章', '第2章', 'after');
	await expect.poll(under).toEqual(['第10章', '第2章', '第1章']);
	await tab.reload();
	await expect.poll(under).toEqual(['第10章', '第2章', '第1章']);
	expect(source('tree-ai')).toMatch(/\norder: 10\n/u);
	// Just below a page at the top: at the top too.
	await drag(tab, '第2章', '项目', 'after');
	await expect(item(tab, '第2章')).toHaveCSS('--depth', '0');
	await expect.poll(() => source('tree-results')).not.toMatch(/parent/u);
});

test('a page with pages under it is deleted with them, or alone, those under it going up; one 撤销 brings back all', async ({ page: tab }) => {
	writeArticle('tree-top', page('项目'));
	writeArticle('tree-method', page('方法', 'parent: tree-top\n'));
	writeArticle('tree-results', page('结果', 'parent: tree-method\n'));
	writeArticle('tree-ai', page('提到项目的页', '').replace('的正文。', '的正文，见 [项目](/blog/tree-top/)。'));
	await openStudio(tab);
	await item(tab, '项目').locator('.page-row').click({ button: 'right' });
	await tab.getByRole('menuitem', { name: '移到回收站' }).click();
	const dialog = tab.locator('#delete-page-dialog');
	await expect(dialog).toContainText('它下面有 2 个页面');
	await expect(dialog).toContainText('「提到项目的页」');
	await tab.locator('#delete-page-all').click();
	await expect(item(tab, '项目')).toHaveCount(0);
	await expect(item(tab, '结果')).toHaveCount(0);
	await tab.locator('.studio-toast-action', { hasText: '撤销' }).click();
	await expect(item(tab, '结果')).toHaveCSS('--depth', '2');

	// Alone: those under it go up to where it was.
	await item(tab, '方法').locator('.page-row').click({ button: 'right' });
	await tab.getByRole('menuitem', { name: '移到回收站' }).click();
	await tab.locator('#delete-page-lift').click();
	await expect(item(tab, '方法')).toHaveCount(0);
	await expect(item(tab, '结果')).toHaveCSS('--depth', '1');
	expect(source('tree-results')).toMatch(/parent: "?tree-top"?/u);
});

test('the tree from the keyboard; a folded page says how many are under it; the path above the title lists a page’s pages', async ({ page: tab }) => {
	writeArticle('tree-top', page('项目'));
	writeArticle('tree-method', page('方法', 'parent: tree-top\n'));
	writeArticle('tree-results', page('结果', 'parent: tree-top\n'));
	await openStudio(tab);
	const row = (title: string) => item(tab, title).locator('.page-row');
	await row('项目').focus();
	await tab.keyboard.press('ArrowLeft');
	await expect(item(tab, '方法')).toHaveCount(0);
	await expect(item(tab, '项目').locator('.page-count')).toHaveText('2');
	await tab.keyboard.press('ArrowRight');
	await expect(item(tab, '方法')).toBeVisible();
	await tab.keyboard.press('ArrowRight');
	await expect(row('方法')).toBeFocused();
	await tab.keyboard.press('ArrowDown');
	await expect(row('结果')).toBeFocused();
	await tab.keyboard.press('ArrowLeft');
	await expect(row('项目')).toBeFocused();

	await row('方法').click();
	await expect(tab.locator('.page-path-link')).toHaveText(['项目']);
	await tab.locator('.page-path-separator').click();
	await expect(tab.getByRole('menuitem')).toHaveText(['方法', '结果']);
	await tab.getByRole('menuitem', { name: '结果' }).click();
	await expect(tab).toHaveURL(/article=tree-results/u);
});

test('pages chosen with ⌘ or ⇧ move together (by 移到…, or dragged) and go to the trash together', async ({ page: tab }) => {
	writeArticle('tree-top', page('项目'));
	writeArticle('tree-method', page('甲页'));
	writeArticle('tree-results', page('乙页'));
	writeArticle('tree-ai', page('丙页'));
	await openStudio(tab);
	const row = (title: string) => item(tab, title).locator('.page-row');
	await row('甲页').click({ modifiers: ['ControlOrMeta'] });
	await row('乙页').click({ modifiers: ['ControlOrMeta'] });
	await expect(tab.locator('.page-item.is-chosen')).toHaveCount(3);
	await row('甲页').click({ modifiers: ['ControlOrMeta'] });
	await expect(tab.locator('.page-item.is-chosen')).toHaveCount(2);
	await row('甲页').click({ modifiers: ['ControlOrMeta'] });
	// The open page was chosen with the first ⌘-click: let go of it.
	await item(tab, TITLE).locator('.page-row').click({ modifiers: ['ControlOrMeta'] });
	await expect(tab.locator('.page-item.is-chosen .page-title')).toHaveText(['甲页', '乙页']);

	await row('乙页').click({ button: 'right' });
	await tab.getByRole('menuitem', { name: '移到…（2 篇）' }).click();
	// Not offered: the pages moved.
	await expect(tab.locator('.quick-find-item', { hasText: '甲页' })).toHaveCount(0);
	await tab.locator('#quick-find-input').fill('项目');
	await tab.keyboard.press('Enter');
	await expect(item(tab, '甲页')).toHaveCSS('--depth', '1');
	await expect(item(tab, '乙页')).toHaveCSS('--depth', '1');

	// ⇧-click: a run of them; dragged together onto another page.
	await row('甲页').click();
	await row('乙页').click({ modifiers: ['Shift'] });
	await expect(tab.locator('.page-item.is-chosen .page-title')).toHaveText(['甲页', '乙页']);
	await drag(tab, '甲页', '丙页');
	await expect(item(tab, '甲页')).toHaveCSS('--depth', '1');
	await expect(item(tab, '乙页')).toHaveCSS('--depth', '1');
	await expect.poll(() => source('tree-results')).toMatch(/parent: "?tree-ai"?/u);

	// To the trash together, and back with one 撤销.
	await row('甲页').click();
	await row('乙页').click({ modifiers: ['Shift'] });
	await row('乙页').click({ button: 'right' });
	await tab.getByRole('menuitem', { name: '移到回收站（2 篇）' }).click();
	await tab.locator('#delete-page-all').click();
	await expect(item(tab, '甲页')).toHaveCount(0);
	await expect(item(tab, '乙页')).toHaveCount(0);
	await tab.locator('.studio-toast-action', { hasText: '撤销' }).click();
	await expect(item(tab, '甲页')).toHaveCSS('--depth', '1');
	await expect(item(tab, '乙页')).toHaveCSS('--depth', '1');
});
