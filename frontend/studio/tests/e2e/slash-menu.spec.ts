import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// The slash menu as Notion has it: opened by `、` too, found by English names and pinyin.

test.beforeEach(() => resetFixture());

const menu = (page: Page) => page.locator('.milkdown-slash-menu');
const shownItems = (page: Page) => menu(page).locator('.menu-groups [data-index] .menu-item-label');

/** A new empty block after the fixture's last paragraph. */
async function newBlock(page: Page): Promise<void> {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

/** Picks the first item shown. */
async function pick(page: Page): Promise<void> {
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
}

test('`、` opens the slash menu, as the `/` key types it under a Chinese input method', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.insertText('、');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type('bt2');
	await expect(shownItems(page)).toHaveText(['标题 2']);
	await pick(page);
	await page.keyboard.type('第二节');
	await expect(editor(page).locator('h2', { hasText: '第二节' })).toBeVisible();
});

test('a block is found by its English name and its pinyin', async ({ page }) => {
	await newBlock(page);
	for (const [typed, found] of [
		['/todo', '待办'],
		['/table', '表格'],
		['/daima', '代码'],
		['/dai ma', '代码'],
		['/callout', '提示块'],
		['/zdk', '折叠块'],
		['/smiles', '化学 SMILES'],
	]) {
		await page.keyboard.type(typed);
		await expect(shownItems(page).first(), typed).toHaveText(found);
		for (let index = 0; index < typed.length; index += 1) await page.keyboard.press('Backspace');
		await expect(menu(page)).toBeHidden();
	}
	await page.keyboard.type('/todo');
	await pick(page);
	await page.keyboard.type('写结论');
	await expect(editor(page).locator('li[data-item-type="task"], li.list-item', { hasText: '写结论' })).toBeVisible();
});

test('`、` inside a sentence is a comma, not the menu', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('甲');
	await page.keyboard.insertText('、');
	await page.keyboard.type('乙');
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();
});

// As SiYuan has it: the menu opens where the trigger is typed, and nowhere else; Esc closes it till the
// trigger is typed again; keys pressed out of the editor are not its.

test('Esc closes the menu till the trigger is typed again', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu(page)).toBeHidden();
	await page.keyboard.type('bt');
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();
	// Enter is a new line, not an item.
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('p', { hasText: /^\/bt$/u })).toHaveCount(1);
	await page.keyboard.type('/bt');
	await expect(menu(page)).toBeVisible();
});

test('a block that begins with `/` is not the menu when the caret comes to it, nor after undo', async ({ page }) => {
	appendToFixture('\n/abc\n');
	await openStudio(page);
	await editor(page).locator('p', { hasText: '/abc' }).click();
	await page.keyboard.press('End');
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();

	await page.keyboard.press('Enter');
	await page.keyboard.type('/bt');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.press('Escape');
	// Apart in time, the typing and the deleting are two steps to undo.
	await page.waitForTimeout(700);
	for (let index = 0; index < 3; index += 1) await page.keyboard.press('Backspace');
	await page.waitForTimeout(700);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page).locator('p', { hasText: /^\/bt$/u })).toHaveCount(1);
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();
});

test('`/` then a space is text', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type(' ');
	await expect(menu(page)).toBeHidden();
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('p', { hasText: /^\/\s$/u })).toHaveCount(1);
});

test('what is typed, or the menu opened again, puts the highlight on the item that answers it, not where the arrows were', async ({ page }) => {
	await newBlock(page);
	const hovered = () => menu(page).locator('.menu-groups li.hover .menu-item-label');
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	const first = await shownItems(page).first().textContent();
	for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Backspace');
	await page.keyboard.type('/');
	await expect(hovered()).toHaveText(first!);
	for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowDown');
	// `bt` is 标题's initials: the first heading, before the items that only have the letters.
	await page.keyboard.type('bt');
	await expect(hovered()).toHaveText('标题 1');
	await page.keyboard.press('Escape');
	for (let index = 0; index < 3; index += 1) await page.keyboard.press('Backspace');
	await page.keyboard.type('/table');
	await expect(hovered()).toHaveText('表格');
});

test('the menu closes when the focus leaves the editor, and takes no key typed there', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	await page.evaluate(() => {
		const input = document.createElement('input');
		input.id = 'elsewhere';
		document.body.append(input);
		input.focus();
	});
	await expect(menu(page)).toBeHidden();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await expect(editor(page).locator('p', { hasText: /^\/$/u })).toHaveCount(1);
	await expect(editor(page).locator('h1, h2, h3, ul, ol, pre').filter({ hasText: /^$/u })).toHaveCount(0);
});

// As Notion has it: `/` in a line too, after a space or a Chinese character (not a letter or a digit), as often as
// wanted; what is picked takes the line (a heading, a list), or goes on a line of its own below it (a divider), the
// words written kept.

test('`/` inside a line opens the menu; a heading picked there is the line, its words kept', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('看这个');
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type('bt2');
	await expect(shownItems(page)).toHaveText(['标题 2']);
	await pick(page);
	await expect(editor(page).locator('h2', { hasText: /^看这个$/u })).toBeVisible();
});

test('`/` after a letter or a digit is text: 1/2, and/or', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('1/2 and/or');
	await page.waitForTimeout(100);
	await expect(menu(page)).toBeHidden();
	await expect(editor(page).locator('p', { hasText: /^1\/2 and\/or$/u })).toHaveCount(1);
});

test('`/` as often as wanted in a line; a divider picked there goes under it, the line as it was', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('甲 /');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu(page)).toBeHidden();
	await page.keyboard.type('乙 /');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type('fgx');
	await expect(shownItems(page)).toHaveText(['分割线']);
	await pick(page);
	const line = editor(page).locator('p', { hasText: '甲 /乙' });
	await expect(line).toHaveText('甲 /乙 ');
	await expect(editor(page).locator('p:has-text("甲 /乙") + hr')).toHaveCount(1);
});

test('`/` where the caret is in the middle of a line; what follows stays', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('前半句后半句');
	for (let index = 0; index < 3; index += 1) await page.keyboard.press('ArrowLeft');
	await page.keyboard.type('/');
	await expect(menu(page)).toBeVisible();
	await page.keyboard.type('yy');
	await expect(shownItems(page).first()).toHaveText('引用');
	await pick(page);
	await expect(editor(page).locator('blockquote', { hasText: /^前半句后半句$/u })).toBeVisible();
});

test('each block says what it is for, and what in Markdown makes it', async ({ page }) => {
	await newBlock(page);
	await page.keyboard.type('/bt1');
	const row = menu(page).locator('.menu-groups li', { hasText: '标题 1' });
	await expect(row.locator('.menu-item-description')).toHaveText('大标题');
	await expect(row.locator('.menu-item-hint')).toHaveText('#');
	await expect(menu(page).locator('.tab-group')).toHaveCount(0);
});
