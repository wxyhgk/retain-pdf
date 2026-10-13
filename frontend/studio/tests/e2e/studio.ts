import { cpSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

export const slug = 'studio-fixture';
const fixture = fileURLToPath(new URL(`./fixtures/blog/${slug}`, import.meta.url));
const articles = (): string => {
	const dir = process.env.STUDIO_BLOG_DIR;
	if (!dir) throw new Error('STUDIO_BLOG_DIR is not set: run through tests/e2e/playwright.config.ts');
	return dir;
};

/** Put the fixture article back as it was, whatever the last test saved. */
export function resetFixture(): void {
	const target = join(articles(), slug);
	rmSync(target, { recursive: true, force: true });
	cpSync(fixture, target, { recursive: true });
}

/** The article's Markdown as the Studio saved it. */
export function savedMarkdown(): string {
	return readFileSync(join(articles(), slug, 'index.md'), 'utf8');
}

/** Open the fixture in the Studio and wait until the editor and its molecules are drawn. */
export async function openStudio(page: Page): Promise<void> {
	await page.goto(`/studio?article=${slug}`);
	await expect(page.locator('.milkdown .ProseMirror')).toBeVisible();
	await expect(page.locator('#save-status')).toHaveText('已载入');
	await expect(scienceBlock(page, 'SMILES').locator('.science-block-preview svg')).toBeVisible();
	await expect(scienceBlock(page, 'SDF').locator('.science-block-preview svg')).toBeVisible();
	await expect(scienceBlock(page, 'XYZ').locator('.science-block-preview canvas')).toBeVisible();
}

export const editor = (page: Page): Locator => page.locator('.milkdown .ProseMirror');
export const popup = (page: Page): Locator => page.locator('.pm-source-popup');
export const popupInput = (page: Page): Locator => page.locator('.pm-source-popup-input');
export const structureSheet = (page: Page): Locator => page.locator('.chem-sheet');
export const saveStatus = (page: Page): Locator => page.locator('#save-status');
export const inlineFormulas = (page: Page): Locator => editor(page).locator('[data-type="math_inline"], .pm-inline-math');
export const displayFormulas = (page: Page): Locator => editor(page).locator('.pm-display-math');

/** The science block whose caption names this kind (SMILES, SDF, XYZ…). */
export function scienceBlock(page: Page, kind: string): Locator {
	return page.locator('.science-block').filter({ has: page.locator('.science-block-kind', { hasText: new RegExp(`^${kind}$`) }) });
}

/** The structure editor has closed and the page it made inert takes clicks again. */
export async function sheetClosed(page: Page): Promise<void> {
	await expect(structureSheet(page)).toHaveCount(0);
	await expect(page.locator('[inert]')).toHaveCount(0);
}

/** Open a chemistry block's source popup through its 编辑 button; the popup's textarea. */
export async function openSource(page: Page, kind: string): Promise<Locator> {
	const block = scienceBlock(page, kind);
	await block.hover();
	await block.locator('.science-block-edit').click();
	await expect(popupInput(page)).toBeVisible();
	return popupInput(page);
}

/** Paste as a browser would, with the clipboard holding HTML (when given) and plain text. */
export async function paste(page: Page, data: { html?: string; text: string }): Promise<void> {
	await page.evaluate(({ html, text }) => {
		const target = document.querySelector('.milkdown .ProseMirror');
		if (!target) throw new Error('no editor');
		const clipboard = new DataTransfer();
		if (html) clipboard.setData('text/html', html);
		clipboard.setData('text/plain', text);
		target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
	}, data);
}

/** Put the caret at the end of the paragraph holding this text. */
export async function caretAfter(page: Page, text: string): Promise<void> {
	await editor(page).getByText(text, { exact: true }).click();
	await page.keyboard.press('End');
}
