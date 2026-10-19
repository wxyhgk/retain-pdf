import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture } from './studio.ts';

// A plugin edited, added or removed while the Studio is open is put in again at once, without the page loading again.

// Only on the server's own copy of the project (E2E_ISOLATED=1): the plugins written here must never be the repository's.
test.skip(!process.env.E2E_ROOT_PARENT, 'needs E2E_ISOLATED=1');

const root = () => join(process.env.E2E_ROOT_PARENT!, basename(fileURLToPath(new URL('../..', import.meta.url))));
const lookFolder = () => join(root(), 'plugins', 'test-look');

function writeLook(apply: string): void {
	mkdirSync(lookFolder(), { recursive: true });
	writeFileSync(join(lookFolder(), 'studio.ts'), `export const name = 'test-look';\nexport const inject = ['theme'];\nexport function apply(ctx: any): void {\n\t${apply}\n}\n`);
}

test.beforeEach(() => resetFixture());
test.afterEach(() => rmSync(lookFolder(), { recursive: true, force: true }));

const width = (page: Page) => editor(page).evaluate((element) => element.getBoundingClientRect().width);

/** Marks the page: still marked later, it was not loaded again. */
async function mark(page: Page): Promise<void> {
	await page.evaluate(() => {
		(window as any).notReloaded = true;
	});
}
const stillMarked = (page: Page) => page.evaluate(() => (window as any).notReloaded === true);

test('a plugin added, edited and removed takes effect at once', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await openStudio(page);
	await mark(page);
	await expect.poll(() => width(page)).toBe(850);

	writeLook(`ctx.theme.set({ 'editor-width': '640px' });`);
	await expect.poll(() => width(page), { timeout: 20_000 }).toBe(640);
	await expect(page.locator('.studio-toast', { hasText: '已重新载入插件：test-look' })).toBeVisible();

	writeLook(`ctx.theme.set({ 'editor-width': '700px' });`);
	await expect.poll(() => width(page), { timeout: 20_000 }).toBe(700);

	rmSync(lookFolder(), { recursive: true, force: true });
	await expect.poll(() => width(page), { timeout: 20_000 }).toBe(850);
	expect(await stillMarked(page)).toBe(true);
});

test('a plugin that fails says why, and starts once it is fixed', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await openStudio(page);
	await mark(page);
	writeLook(`ctx.theme.set({ 'editor-widht': '640px' });`);
	await expect(page.locator('.studio-toast', { hasText: '没有叫 editor-widht 的设计变量' })).toBeVisible({ timeout: 20_000 });
	await expect.poll(() => width(page)).toBe(850);

	writeLook(`ctx.theme.set({ 'editor-width': '640px' });`);
	await expect.poll(() => width(page), { timeout: 20_000 }).toBe(640);
	expect(await stillMarked(page)).toBe(true);
});

test('a block’s plugin edited: the article is drawn again with it, nothing typed is lost', async ({ page }) => {
	const jobStudio = join(root(), 'plugins', 'job', 'studio', 'job-block.ts');
	const original = readFileSync(jobStudio, 'utf8');
	try {
		await openStudio(page);
		await mark(page);
		// A calculation block, and text typed after it, not yet saved.
		await editor(page).locator('p', { hasText: '结尾段落' }).click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await page.keyboard.insertText('、');
		await page.keyboard.insertText('jisuan');
		await page.waitForTimeout(100);
		await page.keyboard.press('Enter');
		await page.keyboard.press('Escape');
		const card = editor(page).locator('.job-block');
		await expect(card).toHaveCount(1);
		const before = await card.elementHandle();
		await editor(page).locator('p', { hasText: '结尾段落' }).click();
		await page.keyboard.press('End');
		await page.keyboard.insertText(' 热替换之前打的字');

		appendFileSync(jobStudio, '\n// edited while the Studio is open\n');
		await expect(page.locator('.studio-toast', { hasText: '已重新载入插件：job' })).toBeVisible({ timeout: 20_000 });
		// Drawn again by the new plugin: another element, the same block.
		await expect.poll(() => card.evaluate((element, old) => element !== old, before), { timeout: 20_000 }).toBe(true);
		await expect(card).toHaveCount(1);
		await expect(editor(page)).toContainText('热替换之前打的字');
		expect(await stillMarked(page)).toBe(true);
	} finally {
		writeFileSync(jobStudio, original);
	}
});
