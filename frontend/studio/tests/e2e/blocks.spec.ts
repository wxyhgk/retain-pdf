import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, savedMarkdown, saveStatus, writeArticle } from './studio.ts';

// Notion's blocks in Markdown: callouts (`> [!TIP]`), toggles (`<details>`), links to other articles.

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

const OTHER = 'second-note';

test.beforeEach(() => {
	resetFixture();
	writeArticle(OTHER, "---\ntitle: '第二篇笔记'\ndescription: ''\npubDate: '2026-10-17'\ntags: []\nkind: wiki\n---\n\n第二篇的正文。\n");
});
test.afterAll(() => removeArticle(OTHER));

test('a callout shows as a box with its icon; a click on the icon changes its kind', async ({ page }) => {
	appendToFixture('\n> [!TIP]\n> 先用小基组跑通。\n\n> [!WARNING]\n> 不动的提示块原样保留。\n');
	await openStudio(page);
	const tip = editor(page).locator('aside.callout').first();
	await expect(tip).toHaveClass(/callout-tip/);
	await expect(tip.locator('.callout-icon')).toHaveText('💡');
	await expect(tip.locator('.callout-body')).toHaveText('先用小基组跑通。');

	await tip.locator('.callout-icon').click();
	await expect(tip).toHaveClass(/callout-important/);
	const saved = await save(page);
	expect(saved).toContain('> [!IMPORTANT]\n> 先用小基组跑通。\n');
	expect(saved).toContain('> [!WARNING]\n> 不动的提示块原样保留。\n');
});

test('a toggle folds the blocks under its title; the title is typed in place and written back', async ({ page }) => {
	appendToFixture('\n<details>\n<summary>推导过程</summary>\n\n第一步。\n\n第二步。\n\n</details>\n');
	await openStudio(page);
	const toggle = editor(page).locator('.toggle-block');
	await expect(toggle.locator('.toggle-summary')).toHaveValue('推导过程');
	await expect(toggle.locator('.toggle-body p')).toHaveText(['第一步。', '第二步。']);

	await toggle.locator('.toggle-arrow').click();
	await expect(toggle.locator('.toggle-body')).toBeHidden();
	await toggle.locator('.toggle-arrow').click();
	await expect(toggle.locator('.toggle-body')).toBeVisible();

	await toggle.locator('.toggle-summary').fill('Hartree–Fock <推导>');
	await toggle.locator('.toggle-body p').last().click();
	await page.keyboard.press('End');
	await page.keyboard.type('然后收敛。');
	expect(await save(page)).toContain('<details>\n<summary>Hartree–Fock &lt;推导&gt;</summary>\n\n第一步。\n\n第二步。然后收敛。\n\n</details>\n');
});

test('[[ links another article by its title, at its address; it shows as a page and a click opens it', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' 参见 [[');
	const finder = page.locator('#quick-find-dialog');
	await expect(page.locator('#quick-find-input')).toHaveAttribute('placeholder', '链接到哪篇文章…');
	await page.locator('#quick-find-input').fill('第二');
	await expect(finder.locator('.quick-find-item').first()).toContainText('第二篇笔记');
	await page.keyboard.press('Enter');
	await expect(finder).toBeHidden();
	const link = editor(page).locator('a', { hasText: '第二篇笔记' });
	await expect(link).toHaveAttribute('href', '/wiki/second-note/');
	await page.keyboard.type('。');
	expect(await save(page)).toContain('结尾段落。 参见 [第二篇笔记](/wiki/second-note/)。');

	// In the sentence it is a page, as Notion's mention: its icon before it.
	await expect(link.locator('.pm-article-mention-start')).toHaveCount(1);
	expect(await link.locator('.pm-article-mention-start').evaluate((piece) => getComputedStyle(piece, '::before').content)).toBe('""');

	await link.click();
	await expect(page).toHaveURL(/article=second-note/u);
	await expect(editor(page)).toContainText('第二篇的正文。');
});

test('[[ given up leaves the two brackets as typed', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('[[');
	await expect(page.locator('#quick-find-dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#quick-find-dialog')).toBeHidden();
	await expect(editor(page).locator('p', { hasText: '结尾段落' })).toHaveText('结尾段落。[[');
});

test('the slash menu makes a callout and a toggle', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/提示块');
	await expect(page.locator('.milkdown-slash-menu')).toContainText('提示块');
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await page.keyboard.type('记得收敛。');
	await expect(editor(page).locator('aside.callout-tip .callout-body')).toHaveText('记得收敛。');

	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/折叠块');
	await expect(page.locator('.milkdown-slash-menu')).toContainText('折叠块');
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await page.keyboard.type('细节');
	await page.keyboard.press('Enter');
	await page.keyboard.type('藏起来的内容');
	const saved = await save(page);
	expect(saved).toContain('> [!TIP]\n> 记得收敛。');
	expect(saved).toContain('<details>\n<summary>细节</summary>\n\n藏起来的内容\n\n</details>');
});

test('a toggle whose title has HTML, or no title, is written back as it was when something else is edited', async ({ page }) => {
	const tagged = '<details>\n<summary><b>推导</b> 过程</summary>\n\n藏起来的推导。\n\n</details>';
	const untitled = '<details>\n\n没有标题的折叠内容。\n\n</details>';
	appendToFixture(`\n${tagged}\n\n${untitled}\n`);
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('改了别处');
	const saved = await save(page);
	expect(saved).toContain('结尾段落。改了别处');
	expect(saved).toContain(tagged);
	expect(saved).toContain(untitled);
	expect(saved).not.toContain('&lt;b&gt;');
	expect(saved).not.toContain('<summary></summary>');
});
