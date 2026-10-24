import { expect, test } from '@playwright/test';

import { appendToFixture, caretAfter, editor, openStudio, resetFixture, saveStatus, savedMarkdown } from './studio.ts';

// The editor writes its Markdown a block at a time, remembered by block (blockwise-markdown.ts), and the Studio merges
// only round the change (merge.ts): an edit saved changes the characters typed, and nothing else, however the blocks
// beside it are written, in an article of any length.

const NEIGHBOURS = [
	'',
	'- 甲',
	'- 乙',
	'',
	'* 丙',
	'* 丁',
	'',
	'1. 一',
	'2. 二',
	'',
	'3) 三',
	'',
	'改这里',
	'',
	'- [ ] 待办',
	'',
	'<div>',
	'html',
	'</div>',
	'',
	'> 引用',
	'>',
	'> - 里面的列表',
	'',
	'```js',
	'x',
	'```',
	'',
	'| a | b |',
	'|---|---|',
	'| 1 | 2 |',
	'',
	'也改这里',
	'',
].join('\n');

test.beforeEach(() => resetFixture());

test('an edit between lists, code, HTML and a table saves the characters typed and nothing else', async ({ page }) => {
	appendToFixture(NEIGHBOURS);
	const before = savedMarkdown();
	await openStudio(page);
	await caretAfter(page, '改这里');
	await page.keyboard.type('一');
	await caretAfter(page, '也改这里');
	await page.keyboard.type('二');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toBe(before.replace('\n改这里\n', '\n改这里一\n').replace('\n也改这里\n', '\n也改这里二\n'));
});

test('in a long article, what is off the screen is not laid out, and an edit saves only itself', async ({ page }) => {
	const paragraphs = Array.from({ length: 450 }, (_, index) => `第 ${index + 1} 段，$x_{${index}}$ 在这里。`);
	appendToFixture(`\n${paragraphs.join('\n\n')}\n`);
	const before = savedMarkdown();
	await openStudio(page);
	await expect(editor(page)).toHaveClass(/\bis-long\b/u);
	expect(await editor(page).locator('> p').first().evaluate((node) => getComputedStyle(node).contentVisibility)).toBe('auto');
	await editor(page).locator('p', { hasText: '第 450 段' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('末');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toBe(before.replace('第 450 段，$x_{449}$ 在这里。', '第 450 段，$x_{449}$ 在这里。末'));
});
