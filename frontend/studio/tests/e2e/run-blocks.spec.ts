import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Code blocks that run where they are, as org-babel's (plugins/run-blocks): ⌘⇧↵ in one, or 运行 in its menu; its
// output written under it, and replaced when it is run again.

test.beforeEach(() => resetFixture());

test('a code block runs in its article’s folder; its output goes under it, replaced when it runs again', async ({ page }) => {
	appendToFixture('\n```sh\necho 结果 $((6 * 7))\npwd | grep -c studio-fixture\n```\n');
	await openStudio(page);
	const code = editor(page).locator('.milkdown-code-block', { hasText: 'echo 结果' });
	await code.scrollIntoViewIfNeeded();
	await code.locator('.cm-content').click();
	await page.keyboard.press('ControlOrMeta+Shift+Enter');
	const result = editor(page).locator('.milkdown-code-block', { hasText: '结果 42' }).filter({ hasNotText: 'echo' });
	await expect(result).toHaveCount(1);
	await expect(result).toContainText('1');
	// Run again (the block changed): the same result block, its words new.
	await code.locator('.cm-content').click();
	await page.keyboard.press('End');
	await page.keyboard.type('\necho 第二次');
	await page.keyboard.press('ControlOrMeta+Shift+Enter');
	await expect(editor(page).locator('.milkdown-code-block', { hasText: '第二次' }).filter({ hasNotText: 'echo' })).toHaveCount(1);
	await expect(editor(page).locator('.milkdown-code-block', { hasText: '结果 42' }).filter({ hasNotText: 'echo' })).toHaveCount(1);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	// (The line typed after the first one, where the caret was.)
	expect(savedMarkdown()).toMatch(/```sh\necho 结果 \$\(\(6 \* 7\)\)\necho 第二次\npwd \| grep -c studio-fixture\n```\n+```output title="运行结果"\n结果 42\n第二次\n1\n```/u);
	expect(savedMarkdown().match(/运行结果/gu)).toHaveLength(1);
});

test('a block that fails says how it ended, under it; ⌘K finds the command', async ({ page }) => {
	appendToFixture('\n```python\nraise SystemExit(3)\n```\n');
	await openStudio(page);
	const code = editor(page).locator('.milkdown-code-block', { hasText: 'raise SystemExit' });
	await code.scrollIntoViewIfNeeded();
	await code.locator('.cm-content').click();
	await page.keyboard.press('ControlOrMeta+k');
	await page.locator('#quick-find-input').fill('>运行');
	await expect(page.locator('#quick-find-dialog [role="option"]', { hasText: '运行光标所在的代码块' })).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(editor(page).locator('.milkdown-code-block', { hasText: '退出码 3' })).toHaveCount(1);
});
