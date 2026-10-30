import { expect, test, type Page } from '@playwright/test';

import { editFixture, openStudio, resetFixture, slug } from './studio.ts';

// Opening the Studio draws the page as it was left at once, as Notion does,
// and the editor takes over when it has loaded (page-snapshot.ts).

const TITLE = 'Studio 测试夹具';

test.beforeEach(() => resetFixture());
test.afterAll(() => resetFixture());

/** The Studio opened and left, as a person would: the page keeps its picture. */
async function openAndLeave(page: Page): Promise<void> {
	// A browser driven by tests is otherwise shown the page as it loads.
	await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
	const marked = page.waitForResponse(/\/page-version$/u);
	await openStudio(page);
	await marked;
	await page.waitForTimeout(800);
	await page.goto('about:blank');
}

/** Opens the Studio again with its scripts held back; `release` lets them load. */
async function openHeld(page: Page): Promise<() => void> {
	let release!: () => void;
	const held = new Promise<void>((resolve) => { release = resolve; });
	// Its script as this machine's Studio has it, or built (client-build.mjs, as another device's has it).
	await page.route(/\/src\/studio\/main\.ts|\/studio-client\/assets\/studio-[\w-]+\.js/u, async (route) => {
		await held;
		await route.continue();
	});
	await page.goto(`/studio?article=${slug}`, { waitUntil: 'commit' });
	return release;
}

test('the page as it was left shows before the editor loads, and the editor takes over', async ({ page }) => {
	await openAndLeave(page);
	const release = await openHeld(page);
	const picture = page.locator('.studio-snapshot');
	await expect(picture.locator('#crepe-editor .ProseMirror')).toContainText('结尾段落');
	await expect(picture.locator('#article-title-input')).toHaveValue(TITLE);
	await expect(picture.locator('.page-row', { hasText: TITLE })).toBeVisible();
	await expect(picture.locator('#file-tree')).toContainText('index.md');

	release();
	await expect(picture).toHaveCount(0);
	await expect(page.locator('#crepe-editor .milkdown .ProseMirror')).toContainText('结尾段落');
	await expect(page.locator('#article-title-input')).toHaveValue(TITLE);
});

test('not once the article changed on disk: the page shows no empty fields until the editor has it', async ({ page }) => {
	await openAndLeave(page);
	editFixture((markdown) => markdown.replace('结尾段落', '磁盘上改过的结尾段落'));
	const release = await openHeld(page);
	await expect(page.locator('.studio-bar')).toBeVisible();
	await page.waitForTimeout(300);
	await expect(page.locator('.studio-snapshot')).toHaveCount(0);
	await expect(page.locator('.editor-scroll')).toBeHidden();
	await expect(page.locator('#article-list')).toBeHidden();

	release();
	await expect(page.locator('#crepe-editor .milkdown .ProseMirror')).toContainText('磁盘上改过的结尾段落');
	await expect(page.locator('.editor-scroll')).toBeVisible();
	await expect(page.locator('#article-list .page-row', { hasText: TITLE })).toBeVisible();
});
