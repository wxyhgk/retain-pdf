import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// A web bookmark (plugins/bookmark): an address given in the editor, the page read by the dev server (answered
// here, not fetched), the card drawn and what was read written into the article.

test.beforeEach(() => resetFixture());

const block = (page: Page) => editor(page).locator('.bookmark-block');

/** Answers the dev server's reading of pages: each address with this, or an error. */
async function answerPreviews(page: Page, answers: Record<string, { title: string; description?: string; image?: string; site?: string } | string>) {
	await page.route('**/api/studio/plugins/bookmark/preview?*', async (route) => {
		const url = new URL(route.request().url()).searchParams.get('url') ?? '';
		const answer = answers[url];
		if (typeof answer === 'string' || !answer) {
			await route.fulfill({ status: 502, json: { error: answer ?? '没有' } });
			return;
		}
		await route.fulfill({ json: { bookmark: { url, description: '', image: '', site: '', ...answer } } });
	});
}

async function save(page: Page): Promise<string> {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

test('网页书签 from the slash menu asks for an address; the page read fills the card and the article', async ({ page }) => {
	await answerPreviews(page, { 'https://example.com/paper': { title: '一篇论文', description: '讲了什么', site: 'Example' } });
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/书签');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index]').first()).toHaveText('网页书签');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	const input = block(page).locator('input');
	await expect(input).toBeFocused();
	await page.keyboard.type('https://example.com/paper');
	await page.keyboard.press('Enter');
	await expect(block(page).locator('.note-bookmark-title')).toHaveText('一篇论文');
	await expect(block(page).locator('.note-bookmark-description')).toHaveText('讲了什么');
	await expect(block(page).locator('.note-bookmark-site')).toHaveText('Example');
	expect(await save(page)).toContain('结尾段落。\n\n```bookmark\nhttps://example.com/paper\ntitle: 一篇论文\ndescription: 讲了什么\nsite: Example\n```\n');
});

test('改网址 reads the new page; a page that cannot be read says so and keeps the address', async ({ page }) => {
	appendToFixture('\n```bookmark\nhttps://example.com/old\ntitle: 旧的\n```\n');
	await answerPreviews(page, { 'https://example.com/new': { title: '新的' }, 'https://shut.example/': 'shut.example 没有给出这个页面（403）' });
	await openStudio(page);
	await expect(block(page).locator('.note-bookmark-title')).toHaveText('旧的');
	await block(page).hover();
	await block(page).getByRole('button', { name: '改网址' }).click();
	const input = block(page).locator('input');
	await expect(input).toBeFocused();
	await input.fill('https://example.com/new');
	await input.press('Enter');
	await expect(block(page).locator('.note-bookmark-title')).toHaveText('新的');
	expect(await save(page)).toContain('```bookmark\nhttps://example.com/new\ntitle: 新的\n```');

	await block(page).hover();
	await block(page).getByRole('button', { name: '改网址' }).click();
	await block(page).locator('input').fill('https://shut.example/');
	await block(page).locator('input').press('Enter');
	await expect(page.locator('.studio-toast', { hasText: '没能读取这个网页：shut.example 没有给出这个页面（403）' })).toBeVisible();
	// Nothing of the last page is kept for this one: the card shows its address.
	await expect(block(page).locator('.note-bookmark-title')).toHaveText('https://shut.example/');
	expect(await save(page)).toContain('```bookmark\nhttps://shut.example/\n```');
});

test('an address that is not http(s) is not taken', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/bookmark');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await block(page).locator('input').fill('javascript:alert(1)');
	await block(page).locator('input').press('Enter');
	await expect(page.locator('.studio-toast', { hasText: '网址要以 http:// 或 https:// 开头' })).toBeVisible();
	await expect(block(page).locator('input')).toBeVisible();
});
