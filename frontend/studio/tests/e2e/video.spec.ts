import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Videos (plugins/video): a link to one on Bilibili or YouTube shows their player (answered here, not fetched); a
// video file of this machine goes into the article's assets/ and plays in the Studio, a frame of it becoming the
// cover the blog shows.

const CLIP = readFileSync(new URL('./fixtures/clip.mp4', import.meta.url));

test.beforeEach(async ({ page }) => {
	resetFixture();
	// The players are the sites' own: not fetched in a test.
	await page.route(/^https:\/\/(player\.bilibili\.com|www\.youtube-nocookie\.com)\//u, (route) => route.fulfill({ contentType: 'text/html', body: '<p>播放器</p>' }));
});

const block = (page: Page) => editor(page).locator('.video-block');

async function save(page: Page): Promise<string> {
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

/** 视频 from the slash menu, at the end of the article. */
async function insertVideo(page: Page): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/视频');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('视频');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
}

test('视频 from the slash menu takes a Bilibili link (a short one opened first) and shows its player', async ({ page }) => {
	await page.route('**/api/studio/plugins/video/resolve?*', (route) => route.fulfill({ json: { url: 'https://www.bilibili.com/video/BV1GJ411x7h7?share_source=copy' } }));
	await openStudio(page);
	await insertVideo(page);
	const input = block(page).locator('input[type="url"]');
	await expect(input).toBeFocused();
	await page.keyboard.type('https://b23.tv/abc');
	await page.keyboard.press('Enter');
	const player = block(page).locator('iframe');
	await expect(player).toHaveAttribute('src', 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&autoplay=0&high_quality=1&danmaku=0');
	await expect(player).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
	await expect(player).toHaveAttribute('sandbox', /allow-scripts/u);

	// A caption under it, as under a picture.
	await block(page).hover();
	await block(page).locator('.video-block-caption').click();
	await page.keyboard.type('演示');
	await expect(block(page).locator('.video-block-caption')).toBeFocused();
	expect(await save(page)).toContain('结尾段落。\n\n```video\nhttps://www.bilibili.com/video/BV1GJ411x7h7?share_source=copy\ncaption: 演示\n```\n');
});

test('a link that is no video of Bilibili or YouTube is said so, and nothing is written', async ({ page }) => {
	await openStudio(page);
	await insertVideo(page);
	await expect(block(page).locator('input[type="url"]')).toBeFocused();
	await page.keyboard.type('https://vimeo.com/1');
	await page.keyboard.press('Enter');
	await expect(page.locator('.studio-toast')).toContainText('只认 B 站和 YouTube 的视频链接');
	await expect(block(page).locator('input[type="url"]')).toBeVisible();
});

test('a video of this machine goes into assets/, plays here, and a frame of it becomes its cover', async ({ page }) => {
	await openStudio(page);
	await insertVideo(page);
	await block(page).locator('input[type="file"]').setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: CLIP });
	const video = block(page).locator('video');
	await expect(video).toHaveAttribute('src', /\/files\/assets\/clip\.mp4$/u);
	// Its cover made by itself, from a frame a little way in.
	await expect(video).toHaveAttribute('poster', /\/files\/img\/clip\.jpg(\?\d+)?$/u);
	expect(fixtureHas('assets/clip.mp4')).toBe(true);
	expect(fixtureHas('img/clip.jpg')).toBe(true);
	await expect(block(page).locator('.video-block-note')).toHaveText('只在本机 · 博客上显示封面');
	expect(await save(page)).toContain('结尾段落。\n\n```video\n./assets/clip.mp4\ncover: ./img/clip.jpg\n```\n');

	// Served in part, as a player asks for it (WebKit plays nothing otherwise).
	const part = await page.evaluate(async (src) => {
		const response = await fetch(src, { headers: { Range: 'bytes=0-99' } });
		return { status: response.status, range: response.headers.get('content-range'), length: (await response.arrayBuffer()).byteLength };
	}, (await video.getAttribute('src'))!);
	expect(part).toEqual({ status: 206, range: `bytes 0-99/${CLIP.length}`, length: 100 });

	// 做封面: the frame shown is the cover now.
	const before = readFileSync(fixturePath('img/clip.jpg'));
	await video.evaluate((element: HTMLVideoElement) => new Promise((resolve) => {
		element.addEventListener('seeked', resolve, { once: true });
		element.currentTime = 1.8;
	}));
	await block(page).hover();
	await block(page).getByRole('button', { name: '做封面' }).click();
	await expect(page.locator('.studio-toast')).toContainText('封面换成了这一帧');
	expect(readFileSync(fixturePath('img/clip.jpg')).equals(before)).toBe(false);
});

test('a video file dropped on the editor becomes a video block', async ({ page }) => {
	await openStudio(page);
	const text = editor(page).getByText('结尾段落。', { exact: true });
	await text.scrollIntoViewIfNeeded();
	const box = (await text.boundingBox())!;
	await page.evaluate(({ base64, x, y }) => {
		const transfer = new DataTransfer();
		transfer.items.add(new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], 'drop.mp4', { type: 'video/mp4' }));
		document.elementFromPoint(x, y)!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
	}, { base64: CLIP.toString('base64'), x: box.x + box.width - 2, y: box.y + box.height / 2 });
	await expect(block(page).locator('video')).toHaveAttribute('src', /\/files\/assets\/drop\.mp4$/u);
	await expect(block(page).locator('video')).toHaveAttribute('poster', /\/files\/img\/drop\.jpg(\?\d+)?$/u);
	expect(await save(page)).toContain('```video\n./assets/drop.mp4\ncover: ./img/drop.jpg\n```');
});

test('a video of the article without a cover gets one when the article is opened, the caret left where it is', async ({ page }) => {
	writeFixtureFile('assets/clip.mp4', CLIP);
	appendToFixture('\n```video\n./assets/clip.mp4\ncaption: 实验录像\n```\n\n```video\nhttps://youtu.be/dQw4w9WgXcQ\n```\n');
	await openStudio(page);
	await editor(page).locator('p', { hasText: '开头段落' }).click();
	await expect(block(page).first().locator('video')).toHaveAttribute('poster', /\/files\/img\/clip\.jpg\?\d+$/u);
	await expect(block(page).first()).not.toHaveClass(/ProseMirror-selectednode/u);
	await page.keyboard.type('还在这里');
	await expect(editor(page).locator('p', { hasText: '开头段落' })).toContainText('还在这里');
	expect(await save(page)).toContain('```video\n./assets/clip.mp4\ncover: ./img/clip.jpg\ncaption: 实验录像\n```');
});

test('a video whose file is not on this machine says so where it would play', async ({ page }) => {
	writeFixtureFile('img/gone.jpg', readFileSync(new URL('./fixtures/plot.png', import.meta.url)));
	appendToFixture('\n```video\n./assets/gone.mp4\ncover: ./img/gone.jpg\n```\n');
	await openStudio(page);
	await expect(block(page).locator('.video-block-missing')).toContainText('放不了 ./assets/gone.mp4');
});

function fixturePath(path: string): string {
	return `${process.env.STUDIO_BLOG_DIR}/studio-fixture/${path}`;
}
