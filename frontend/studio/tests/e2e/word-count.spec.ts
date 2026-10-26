import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, workspaceMenu, writeArticle } from './studio.ts';

// 字数统计 (plugins/word-count): a tab that counts the open article as it is typed in, and a command that writes the count as a line.

const OTHER = 'word-count-other';

test.beforeEach(() => {
	resetFixture();
	writeArticle(OTHER, "---\ntitle: '另一篇'\ndescription: ''\npubDate: '2026-10-20'\ntags: []\nkind: wiki\n---\n\n# 小标题\n\n五个汉字啊。Two words\n\n![图](img/a.png)\n\n```job program=xtb\nx\n```\n");
});
test.afterAll(() => removeArticle(OTHER));

const pane = (page: Page) => page.locator('#side-plugin-word-count');
const stat = (page: Page, key: string) => pane(page).locator(`[data-stat="${key}"]`);
const main = (page: Page) => pane(page).locator('.word-count-card strong');

async function openTab(page: Page): Promise<void> {
	await page.locator('#plugin-commands button', { hasText: '字数统计' }).click();
	await expect(page.locator('.side-tabs [role="tab"][aria-label="字数"]')).toHaveAttribute('aria-selected', 'true');
}

async function caretAtEnd(page: Page): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
}

test('the tab counts the open article, follows the typing and the next article', async ({ page }) => {
	appendToFixture('\n[另一篇](/wiki/word-count-other/)\n');
	await openStudio(page);
	await expect(page.locator('#plugin-commands')).toBeVisible();
	await openTab(page);

	// The fixture: 开头段落 行内公式 和 结尾段落 另一篇, two display formulas (one in \[…\]), three code blocks.
	await expect(main(page)).toHaveText(['16', '0', '1 分钟']);
	await expect(stat(page, 'headings')).toHaveText('0');
	await expect(stat(page, 'formulas')).toHaveText('2');
	await expect(stat(page, 'images')).toHaveText('0');
	await expect(stat(page, 'codeBlocks')).toHaveText('3');

	// Typed, unsaved: counted as it comes.
	await caretAtEnd(page);
	await page.keyboard.type(' 你好 hello world');
	await expect(main(page)).toHaveText(['18', '2', '1 分钟']);
	await expect(stat(page, 'headings')).toHaveText('0');

	// Another article, opened in the same page.
	await editor(page).locator('a', { hasText: '另一篇' }).click({ modifiers: ['ControlOrMeta'] });
	await expect(page).toHaveURL(/article=word-count-other/u);
	await expect(editor(page)).toContainText('五个汉字啊');
	await expect(main(page)).toHaveText(['8', '2', '1 分钟']);
	await expect(stat(page, 'headings')).toHaveText('1');
	await expect(stat(page, 'images')).toHaveText('1');
	await expect(stat(page, 'codeBlocks')).toContainText('1');
	await expect(stat(page, 'codeBlocks')).toContainText('其中计算块 1');
});

const counts = async (page: Page) => ((await editor(page).textContent()) ?? '').match(/全文 \d+ 字/gu)?.length ?? 0;

test('the command types the count in where the caret is: by its keys, from the slash menu and the ⋯ menu', async ({ page }) => {
	await openStudio(page);

	await caretAtEnd(page);
	await page.keyboard.press('Control+Alt+KeyW');
	// In the line, after what is there.
	await expect(editor(page).locator('p', { hasText: '结尾段落' })).toContainText(/结尾段落.*全文 \d+ 字 · 约 1 分钟/u);

	await caretAtEnd(page);
	await page.keyboard.press('Enter');
	await page.keyboard.insertText('、');
	await page.keyboard.insertText('zishu');
	await page.waitForTimeout(100);
	await expect(page.locator('.milkdown-slash-menu')).toContainText('插入字数统计');
	await page.keyboard.press('Enter');
	await expect.poll(() => counts(page)).toBe(2);
	await expect(editor(page)).not.toContainText('、zishu');

	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '插入字数统计' }).click();
	await expect.poll(() => counts(page)).toBe(3);
});

test('the plugins dialog says what it is, and turning it off takes the tab and the button away', async ({ page }) => {
	await openStudio(page);
	await workspaceMenu(page, 'open-plugins');
	const row = page.locator('#plugins-dialog .plugin-row[data-plugin="word-count"]');
	await expect(row).toContainText('字数统计');
	await expect(row.locator('.plugin-state')).toHaveText('运行中');
	await row.getByRole('switch').click({ force: true });
	await expect(row.locator('.plugin-state')).toHaveText('已关闭');
	await page.keyboard.press('Escape');
	await expect(page.locator('.side-tabs [role="tab"][aria-label="字数"]')).toHaveCount(0);
	await expect(page.locator('#plugin-commands')).toBeHidden();
	// Turned on again, so that the settings file is as it was.
	await workspaceMenu(page, 'open-plugins');
	await row.getByRole('switch').click({ force: true });
	await expect(row.locator('.plugin-state')).toHaveText('运行中');
});
