import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown } from './studio.ts';

// The AI in the editor, as Notion's: ⌘J (or the toolbar's 「AI 改写」) on what is selected opens a box for what to
// do; Space on an empty line, for what to write there. What the AI writes (a stand-in here: fake-acp.mjs) comes in
// place, to accept or reject on the review bar, or to ask again.

const box = (page: import('@playwright/test').Page) => page.locator('.inline-ai');
const reviewBar = (page: import('@playwright/test').Page) => page.locator('#review-bar');

test.beforeEach(() => resetFixture());

test('⌘J on a paragraph: the AI rewrites it in place, to accept; 重试 asks again; rejected, it is as it was', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click({ clickCount: 3 });
	await page.keyboard.press('ControlOrMeta+j');
	await expect(box(page)).toBeVisible();
	await expect(box(page).locator('.inline-ai-input')).toBeFocused();
	await expect(box(page).getByRole('option')).toContainText(['改得更通顺', '改得更简洁']);
	// Typed: what the author says comes first, the presets that hold it after.
	await page.keyboard.type('简洁');
	await expect(box(page).getByRole('option')).toHaveText(['让 AI：简洁', '改得更简洁']);
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(box(page)).toBeHidden();
	await expect(reviewBar(page)).toBeVisible();
	await expect(page.locator('#review-count')).toHaveText(/^AI 写的有 \d+ 处改动$/u);
	await expect(editor(page)).toContainText('这是 AI 改写后的');

	// Asked again: what was written let go first, then the new one shown.
	await page.locator('#review-retry').click();
	await expect(reviewBar(page)).toBeVisible();
	await expect(page.locator('#review-count')).toHaveText(/^AI 写的有 \d+ 处改动$/u);
	await page.locator('#review-reject-all').click();
	await expect(reviewBar(page)).toBeHidden();
	await expect(editor(page)).toContainText('结尾段落。');
	await expect(editor(page)).not.toContainText('AI 改写后');
	expect(savedMarkdown()).toContain('结尾段落。');

	// Accepted: saved as any edit.
	await editor(page).locator('p', { hasText: '结尾段落' }).click({ clickCount: 3 });
	await page.keyboard.press('ControlOrMeta+j');
	await box(page).getByRole('option', { name: '修正错别字和语法' }).click();
	await expect(reviewBar(page)).toBeVisible();
	await page.locator('#review-accept-all').click();
	await expect(reviewBar(page)).toBeHidden();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('这是 AI 改写后的段落（第 1 次）。');
	expect(savedMarkdown()).not.toContain('结尾段落。');
});

test('Space on an empty line: the AI writes there; a space anywhere else is a space', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' 有空格');
	await expect(box(page)).toBeHidden();
	await page.keyboard.press('Enter');
	await page.keyboard.press(' ');
	await expect(box(page)).toBeVisible();
	await expect(box(page).locator('.inline-ai-input')).toHaveAttribute('placeholder', '让 AI 在这里写什么…');
	await page.keyboard.type('写一句');
	await page.keyboard.press('Enter');
	await expect(reviewBar(page)).toBeVisible();
	await page.locator('#review-accept-all').click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const saved = savedMarkdown();
	expect(saved).toContain('结尾段落。 有空格');
	expect(saved.indexOf('AI 写的新段落。')).toBeGreaterThan(saved.indexOf('结尾段落。 有空格'));
	// Esc closes the box, nothing asked.
	await editor(page).locator('p', { hasText: 'AI 写的新段落' }).click();
	await page.keyboard.press('ControlOrMeta+j');
	await expect(box(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(box(page)).toBeHidden();
});
