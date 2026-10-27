import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// A code block as Notion's: a gray box with round corners, so it is seen where it is; a click anywhere in it is in the
// code (the language laid over its top), the caret on the nearest line.

test.beforeEach(() => resetFixture());

test('a code block is a box, and a click anywhere in it is in its code', async ({ page }) => {
	appendToFixture('\n前一段。\n\n```python\nimport numpy as np\nprint(np.pi)\n```\n\n后一段。\n');
	await openStudio(page);
	const block = editor(page).locator('.milkdown-code-block').last();
	await block.scrollIntoViewIfNeeded();
	await expect(block).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(block).not.toHaveCSS('border-radius', '0px');
	await expect(block.locator('.language-button')).toHaveCSS('opacity', '1');
	const box = (await block.boundingBox())!;
	// The bottom right corner, past the code's last line and its end.
	await page.mouse.click(box.x + box.width - 8, box.y + box.height - 4);
	await page.keyboard.type(' # 结束');
	await expect(block.locator('.cm-line').last()).toHaveText('print(np.pi) # 结束');
	// The top left corner, beside the language.
	await page.mouse.click(box.x + 4, box.y + 4);
	await page.keyboard.press('ControlOrMeta+ArrowUp');
	await page.keyboard.type('# 开头\n');
	await expect(block.locator('.cm-line').first()).toHaveText('# 开头');
});
