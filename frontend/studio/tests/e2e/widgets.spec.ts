import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Interactive widgets (```widget): made from the slash menu, drawn in a sandboxed frame as the blog draws them.

test.beforeEach(() => resetFixture());

test('the slash menu makes a widget; it runs in its own frame, sized to it, and is saved as a fence', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/widget');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index]')).toHaveText(['交互模块']);
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');

	const frame = editor(page).locator('iframe.note-widget-frame');
	await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
	const widget = page.frameLocator('iframe.note-widget-frame');
	await expect(widget.locator('#depth')).toBeVisible();
	// The frame takes the height of what it holds.
	await expect.poll(async () => frame.evaluate((element) => element.style.height)).not.toBe('300px');
	// It cannot reach the Studio around it.
	expect(await widget.locator('body').evaluate(() => {
		try {
			return String(parent.document.title);
		} catch (error) {
			return (error as Error).name;
		}
	})).toBe('SecurityError');
	// And it follows the theme.
	await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
	await expect(widget.locator('html')).toHaveAttribute('data-theme', 'dark');

	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/结尾段落。\n+```widget title="Morse 势能" height=300\n<label>阱深 Dₑ <input id="depth"[\s\S]*draw\(\);\n<\/script>\n```\n/u);
});
