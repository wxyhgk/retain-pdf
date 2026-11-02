import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, paste, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Links as Notion takes them (link-embeds.ts): an address pasted alone on its line offers what the plugins make of
// it, a video's player before a bookmark's card; a line that is only a link and those blocks turn into one another.

test.beforeEach(async ({ page }) => {
	resetFixture();
	// The players are the sites' own, and the pages are read by the dev server: answered here, not fetched.
	await page.route(/^https:\/\/(player\.bilibili\.com|www\.youtube-nocookie\.com)\//u, (route) => route.fulfill({ contentType: 'text/html', body: '<p>播放器</p>' }));
	await page.route('**/api/studio/plugins/bookmark/preview?*', (route) =>
		route.fulfill({ json: { bookmark: { url: new URL(route.request().url()).searchParams.get('url'), title: '一篇论文', description: '讲了什么', image: '', site: 'Example' } } }),
	);
});

const offered = (page: Page) => page.locator('.link-paste-menu');

async function save(page: Page): Promise<string> {
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

/** A new empty line after the last paragraph, the caret in it. */
async function newLine(page: Page): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

test('a video link pasted alone on its line offers its player first; ↩ takes it', async ({ page }) => {
	await openStudio(page);
	await newLine(page);
	await paste(page, { text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42' });
	await expect(offered(page).getByRole('menuitem')).toHaveText(['视频', '网页书签', '保持链接']);
	await expect(offered(page).getByRole('menuitem').first()).toHaveClass(/is-active/u);
	await page.keyboard.press('Enter');
	await expect(offered(page)).toHaveCount(0);
	await expect(editor(page).locator('.video-block iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42');
	expect(await save(page)).toContain('结尾段落。\n\n```video\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42\n```\n');
});

test('any page’s link pasted alone becomes its card, the page read; ↓ ↩ chooses another', async ({ page }) => {
	await openStudio(page);
	await newLine(page);
	await paste(page, { text: 'https://example.com/paper' });
	await expect(offered(page).getByRole('menuitem')).toHaveText(['网页书签', '保持链接']);
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('.bookmark-block .note-bookmark-title')).toHaveText('一篇论文');
	expect(await save(page)).toContain('结尾段落。\n\n```bookmark\nhttps://example.com/paper\ntitle: 一篇论文\ndescription: 讲了什么\nsite: Example\n```\n');

	// 保持链接: left as it is.
	await editor(page).locator('.bookmark-block').click();
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await paste(page, { text: 'https://example.com/other' });
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(offered(page)).toHaveCount(0);
	await expect(editor(page).locator('a[href="https://example.com/other"]')).toHaveText('https://example.com/other');
});

test('typing on (or Esc) leaves the link as it is, the key going to the text; in a sentence nothing is offered', async ({ page }) => {
	await openStudio(page);
	await newLine(page);
	await paste(page, { text: 'https://example.com/a' });
	await expect(offered(page)).toBeVisible();
	await page.keyboard.type(' 看这里');
	await expect(offered(page)).toHaveCount(0);
	await expect(editor(page).locator('p', { hasText: '看这里' })).toHaveText('https://example.com/a 看这里');

	await page.keyboard.press('Enter');
	await paste(page, { text: 'https://example.com/b' });
	await expect(offered(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(offered(page)).toHaveCount(0);
	await expect(editor(page).locator('a[href="https://example.com/b"]')).toBeVisible();

	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await paste(page, { text: 'https://example.com/c' });
	await expect(editor(page).locator('a[href="https://example.com/c"]')).toBeVisible();
	await expect(offered(page)).toHaveCount(0);
});

test('a line that is only a link turns into its card or player from the block menu, and back', async ({ page }) => {
	appendToFixture('\n[B 站演示](https://www.bilibili.com/video/BV1GJ411x7h7)\n');
	await openStudio(page);
	const menu = page.locator('.milkdown-block-menu');
	const openMenuOf = async (target: ReturnType<typeof editor>) => {
		await target.hover();
		const handle = page.locator('.milkdown-block-handle .operation-item').last();
		await expect(handle).toBeVisible();
		await handle.click();
		await expect(menu).toBeVisible();
	};
	await openMenuOf(editor(page).getByText('B 站演示', { exact: true }));
	await expect(menu.locator('[data-key="link-bookmark_block"]')).toBeVisible();
	await menu.locator('[data-key="link-video_block"]').click();
	const video = editor(page).locator('.video-block');
	await expect(video.locator('iframe')).toHaveAttribute('src', /player\.bilibili\.com\/player\.html\?bvid=BV1GJ411x7h7/u);

	// A video turns into its card, or back into the link.
	await openMenuOf(video.locator('.video-block-caption'));
	await expect(menu.locator('[data-key="link-video_block"]')).toHaveClass(/current/u);
	await menu.locator('[data-key="link"]').click();
	await expect(editor(page).locator('a[href="https://www.bilibili.com/video/BV1GJ411x7h7"]')).toBeVisible();
	await expect(video).toHaveCount(0);
	expect(await save(page)).toContain('\n\n<https://www.bilibili.com/video/BV1GJ411x7h7>\n');
});
