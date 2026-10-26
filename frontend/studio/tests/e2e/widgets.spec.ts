import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

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
	// In the page's dark colors (given by the page: global.css's --gray-dark there).
	await expect(widget.locator('body')).toHaveCSS('color', 'rgb(211, 211, 211)');

	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toMatch(/结尾段落。\n+```widget title="Morse 势能" height=300\n<label>阱深 Dₑ <input id="depth"[\s\S]*draw\(\);\n<\/script>\n```\n/u);
});

test('a widget that is a file of the article reads the article’s data, and starts over when either changes', async ({ page }) => {
	writeFixtureFile('assets/energies.txt', '-76.41\n');
	writeFixtureFile(
		'assets/reader.html',
		'<p id="out">…</p><script>note.file("assets/energies.txt").then((text) => { document.querySelector("#out").textContent = "读到 " + text.trim(); });</script>',
	);
	appendToFixture('\n```widget title="读数据"\n@file ./assets/reader.html\n```\n');
	await openStudio(page);
	const frame = editor(page).locator('iframe.note-widget-frame[data-widget-file="assets/reader.html"]');
	await frame.scrollIntoViewIfNeeded();
	const widget = page.frameLocator('iframe.note-widget-frame[data-widget-file="assets/reader.html"]');
	await expect(widget.locator('#out')).toHaveText('读到 -76.41');

	// The data changes on disk (another program, the terminal): the widget reads it again.
	writeFixtureFile('assets/energies.txt', '-76.52\n');
	await expect(widget.locator('#out')).toHaveText('读到 -76.52');
	// The widget itself changes: it is drawn again.
	writeFixtureFile('assets/reader.html', '<p id="out">新版本</p>');
	await expect(widget.locator('#out')).toHaveText('新版本');
});

test('a widget reads only what is published with the article', async ({ page }) => {
	appendToFixture(
		'\n```widget\n<p id="out">…</p><script>note.file("ai/notes.md").then(() => { out.textContent = "读到了"; }, (error) => { out.textContent = error.message; });</script>\n```\n',
	);
	await openStudio(page);
	const frame = editor(page).locator('iframe.note-widget-frame').last();
	await frame.scrollIntoViewIfNeeded();
	await expect(page.frameLocator('iframe.note-widget-frame >> nth=-1').locator('#out')).toHaveText('ai/notes.md 不在文章的 img/ 或 assets/ 里');
});
