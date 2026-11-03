import { expect, test } from '@playwright/test';

import { appendToFixture, editFixture, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Properties the blog could not build are saved all the same, and said wrong until fixed;
// 发布 checks the article first.

test.beforeEach(() => resetFixture());

test('a missing description is shown, and goes once one is typed and saved', async ({ page }) => {
	editFixture((markdown) => markdown.replace(/^description: .*\n/mu, ''));
	await openStudio(page);
	await expect(page.locator('#property-error')).toContainText('缺少简介（description）');

	// Empty, 简介 is out of the way: added from 添加属性.
	await page.locator('#add-property').click();
	await page.getByRole('menuitem', { name: '简介' }).click();
	await expect(page.locator('#article-description')).toBeFocused();
	await page.locator('#article-description').fill('水分子的势能面');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('description: "水分子的势能面"');
	await expect(page.locator('#property-error')).toBeHidden();
});

test('an article whose YAML is broken still opens, and says so', async ({ page }) => {
	editFixture((markdown) => markdown.replace(/^tags: \[\]$/mu, 'tags: [unclosed'));
	await openStudio(page);
	await expect(page.locator('#property-error')).toContainText('属性的 YAML 写错了');
	await expect(page.locator('#crepe-editor .milkdown .ProseMirror')).toContainText('开头段落');
});

/** 撤回 in the page's head: there only once it is published (the blog's date, kind and state with it). */
const publishButton = (page: import('@playwright/test').Page) => page.locator('#publish-article');
const checkDialog = (page: import('@playwright/test').Page) => page.locator('#publish-check-dialog');
/** 发布到博客… from the page's ⋯ menu: a draft's head has nothing of the blog. */
async function publish(page: import('@playwright/test').Page): Promise<void> {
	await page.locator('#page-menu').click();
	await page.getByText('发布到博客…').click();
}

test('an article with nothing wrong publishes at once, from the page menu; its head then says so', async ({ page }) => {
	await openStudio(page);
	// A draft: nothing of the blog in its head.
	await expect(page.locator('#article-pub-date')).toHaveCount(0);
	await expect(publishButton(page)).toHaveCount(0);
	await publish(page);
	await expect(publishButton(page)).toHaveText('撤回');
	await expect(page.locator('#article-status')).toHaveText('已发布');
	await expect(page.locator('#article-pub-date')).toBeVisible();
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('draft: false');
	await expect(checkDialog(page)).toBeHidden();
});

test('what would stop the build keeps the article a draft', async ({ page }) => {
	appendToFixture('\n![缺图](./img/missing.png)\n');
	await openStudio(page);
	await publish(page);
	await expect(checkDialog(page)).toBeVisible();
	await expect(checkDialog(page).locator('.publish-check-item.is-error')).toContainText('找不到图片 ./img/missing.png');
	await expect(page.locator('#publish-anyway')).toBeHidden();
	await page.locator('#publish-check-cancel').click();
	await expect(checkDialog(page)).toBeHidden();
	await expect(publishButton(page)).toHaveCount(0);
	expect(savedMarkdown()).toContain('draft: true');
});

test('what would only show broken may be published all the same, unsaved edits checked too', async ({ page }) => {
	await openStudio(page);
	const editor = page.locator('#crepe-editor .milkdown .ProseMirror');
	await editor.locator('p').first().click();
	await page.keyboard.press('End');
	await page.keyboard.type(' 见 $\\eqref{eq:none}$ ');
	await publish(page);
	await expect(checkDialog(page).locator('.publish-check-item.is-warning')).toContainText('找不到公式标签 eq:none');
	await page.locator('#publish-anyway').click();
	await expect(publishButton(page)).toHaveText('撤回');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('draft: false');
});
