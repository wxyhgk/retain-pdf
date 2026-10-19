import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture } from './studio.ts';

// A plugin changes how the Studio looks (ctx.theme, ctx.styles), and it all goes back when the plugin does.

test.beforeEach(() => resetFixture());

/** The Studio's plugin loader, as the page has loaded it (a URL of the dev server, imported in the page). */
const PLUGINS = '/src/studio/plugins.ts';

/** Applies a plugin to the Studio's own plugin context (the module the page already has), kept as window.testPlugin; what it threw, if it did. */
async function applyPlugin(page: Page, apply: string): Promise<string | null> {
	return page.evaluate(async ([url, body]) => {
		const { studioPlugins } = await import(url);
		const plugin = { name: 'test-look', inject: ['theme', 'styles'], apply: new Function('ctx', body) };
		try {
			(window as any).testPlugin = await (studioPlugins as any).plugin(plugin);
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	}, [PLUGINS, apply]);
}

const disposePlugin = (page: Page) => page.evaluate(() => (window as any).testPlugin.dispose());
const width = (page: Page) => editor(page).evaluate((element) => element.getBoundingClientRect().width);

test('a plugin sets the text width and size, adds a style, and its going undoes them', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await openStudio(page);
	await expect.poll(() => width(page)).toBe(850);
	await expect(editor(page)).toHaveCSS('font-size', '17px');

	await applyPlugin(page, `
		ctx.theme.set({ 'editor-width': '640px', 'editor-font-size': '15px' });
		ctx.styles.add('.page-head { outline: 3px solid rgb(1, 2, 3); }');
	`);
	await expect.poll(() => width(page)).toBe(640);
	await expect(editor(page)).toHaveCSS('font-size', '15px');
	await expect(page.locator('.page-head')).toHaveCSS('outline-color', 'rgb(1, 2, 3)');
	const tokens = await page.evaluate(async (url) => (await import(url)).studioPlugins.theme.tokens(), PLUGINS);
	expect(tokens.find((token: { name: string }) => token.name === 'editor-width')).toMatchObject({ value: '640px', default: '850px' });

	await disposePlugin(page);
	await expect.poll(() => width(page)).toBe(850);
	await expect(editor(page)).toHaveCSS('font-size', '17px');
	await expect(page.locator('.page-head')).not.toHaveCSS('outline-color', 'rgb(1, 2, 3)');
});

test('a color set for dark mode only is not seen in light mode', async ({ page }) => {
	await openStudio(page);
	await applyPlugin(page, `ctx.theme.set({ surface: '#101010' }, { scheme: 'dark' });`);
	const surface = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
	expect(await surface()).toBe('#ffffff');
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
	expect(await surface()).toBe('#101010');
	await disposePlugin(page);
	expect(await surface()).toBe('#191919');
});

test('a token that does not exist is refused, and what the plugin did before is undone', async ({ page }) => {
	await openStudio(page);
	await page.setViewportSize({ width: 1600, height: 900 });
	expect(await applyPlugin(page, `ctx.theme.set({ 'editor-width': '640px' }); ctx.theme.set({ 'editor-widht': '640px' });`)).toMatch(/没有叫 editor-widht 的设计变量/u);
	// What it set before it threw is undone with it.
	await expect.poll(() => width(page)).toBe(850);
});
