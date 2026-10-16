import { expect, test } from '@playwright/test';

import { editFixture, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Properties the blog could not build are saved all the same, and said wrong until fixed.

test.beforeEach(() => resetFixture());

test('a missing description is shown, and goes once one is typed and saved', async ({ page }) => {
	editFixture((markdown) => markdown.replace(/^description: .*\n/mu, ''));
	await openStudio(page);
	const summary = page.locator('#property-summary');
	await expect(summary).toHaveText('属性有 1 处问题，博客构建会失败');
	await page.locator('#toggle-properties').click();
	await expect(page.locator('#property-error')).toContainText('缺少简介（description）');

	await page.locator('#article-description').fill('水分子的势能面');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('description: "水分子的势能面"');
	await expect(summary).not.toHaveClass(/has-problems/);
	await expect(page.locator('#property-error')).toBeHidden();
});

test('an article whose YAML is broken still opens, and says so', async ({ page }) => {
	editFixture((markdown) => markdown.replace(/^tags: \[\]$/mu, 'tags: [unclosed'));
	await openStudio(page);
	await expect(page.locator('#property-summary')).toHaveText(/属性有 1 处问题/u);
	await page.locator('#toggle-properties').click();
	await expect(page.locator('#property-error')).toContainText('属性的 YAML 写错了');
	await expect(page.locator('.milkdown .ProseMirror')).toContainText('开头段落');
});
