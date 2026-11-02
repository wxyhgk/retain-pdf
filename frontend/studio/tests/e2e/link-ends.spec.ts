import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, writeFixtureFile } from './studio.ts';

// What is typed right after a link (a file's, a page's, the web's) is not more of the link: typed, or put by an input
// method (Chinese), as Notion and Google Docs have it.

test.beforeEach(() => resetFixture());

/** The caret at the end of the paragraph holding `words`, by the keys (a click on a file's link opens the file). */
async function caretAtEnd(page: Page, words: string): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	const lines = await editor(page).locator('p').allTextContents();
	const below = lines.findIndex((text) => text.includes(words)) - lines.findIndex((text) => text.includes('结尾段落'));
	for (let step = 0; step < below; step += 1) await page.keyboard.press('ArrowDown');
	// The line's end: ⌘→ (End moves nothing in WebKit on a Mac).
	await page.keyboard.press('ControlOrMeta+ArrowRight');
}

test('typed right after a link at the end of a line: outside it', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	appendToFixture('\n其中的文件是 [opt.py](./assets/opt.py)\n');
	await openStudio(page);
	await caretAtEnd(page, '其中的文件是');
	await page.keyboard.type(' 和别的');
	await expect(editor(page).locator('p', { hasText: '其中的文件是' }).locator('a')).toHaveText('opt.py');
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain('其中的文件是 [opt.py](./assets/opt.py) 和别的');
});

test('put by an input method right after a link: outside it, the file still marked as one', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'an input method is played through Chromium’s own (CDP)');
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	appendToFixture('\n其中的文件是 [opt.py](./assets/opt.py)\n');
	await openStudio(page);
	await caretAtEnd(page, '其中的文件是');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.imeSetComposition', { text: 'he', selectionStart: 2, selectionEnd: 2 });
	await cdp.send('Input.imeSetComposition', { text: 'hebie', selectionStart: 5, selectionEnd: 5 });
	await cdp.send('Input.insertText', { text: '和别的' });
	const line = editor(page).locator('p', { hasText: '其中的文件是' });
	await expect(line).toContainText('和别的');
	await expect(line.locator('a')).toHaveText('opt.py');
	await expect(line.locator('.pm-file-mention-start')).toHaveText('opt.py');
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain('其中的文件是 [opt.py](./assets/opt.py)和别的');
});
