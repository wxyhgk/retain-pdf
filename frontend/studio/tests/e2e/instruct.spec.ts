import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug } from './studio.ts';

// Alt+Enter: a line of the article saying what is wanted is done by the AI of AI 助手, by itself, in the article's
// folder (a stand-in here: tests/e2e/fake-agents/fake-agent.mjs). The blocks are marked as it works, the task shows
// at the bottom right, and what it changes in index.md comes back to be accepted or rejected where it is; it goes on
// from the last talk there, or starts anew with ⇧.

const workLog = () => readFileSync(join(process.env.STUDIO_BLOG_DIR!, slug, 'ai', 'work', 'log.md'), 'utf8');
const reviewBar = (page: import('@playwright/test').Page) => page.locator('#review-bar');

test.beforeEach(() => resetFixture());

test('Alt+Enter has the AI do what the line says; what it writes in its place is reviewed, and only that line changes', async ({ page }) => {
	await openStudio(page);
	const before = savedMarkdown();
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('画一个 sin x 的图');
	await page.keyboard.press('Alt+Enter');

	const task = page.locator('#task-tray .task-item', { hasText: '画一个 sin x 的图' });
	await expect(task.locator('.task-title')).toHaveText('Claude：画一个 sin x 的图');
	await expect(task).toHaveAttribute('data-state', 'done');
	// Its change on disk, to accept.
	await expect(reviewBar(page)).toBeVisible();
	await reviewBar(page).getByRole('button', { name: '全部接受' }).click();
	await expect(reviewBar(page)).toBeHidden();
	await expect(editor(page)).toContainText('结果：画一个 sin x 的图（替身）');
	await expect(editor(page).locator('p', { hasText: /^画一个 sin x 的图$/u })).toHaveCount(0);
	await expect(editor(page).locator('.is-instructing')).toHaveCount(0);
	await expect(saveStatus(page)).toHaveText(/已载入|已保存/u);
	expect(savedMarkdown()).toBe(before.replace('结尾段落。\n', '结尾段落。\n\n结果：画一个 sin x 的图（替身）\n'));
	// The first in this article: nothing to go on from; its work noted.
	expect(workLog()).toBe('- 画一个 sin x 的图；接着上次：否\n');

	// Again: it goes on from the last talk in the folder.
	await editor(page).getByText('结果：画一个 sin x 的图（替身）').click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('加上图例');
	await page.keyboard.press('Alt+Enter');
	await expect(reviewBar(page)).toBeVisible();
	await reviewBar(page).getByRole('button', { name: '全部接受' }).click();
	await expect(editor(page)).toContainText('结果：加上图例（替身）');
	expect(workLog()).toBe('- 画一个 sin x 的图；接着上次：否\n- 加上图例；接着上次：是\n');

	// ⇧Alt+Enter: a new talk.
	await editor(page).getByText('结果：加上图例（替身）').click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('换成 cos x');
	await page.keyboard.press('Shift+Alt+Enter');
	await expect(reviewBar(page)).toBeVisible();
	await reviewBar(page).getByRole('button', { name: '全部接受' }).click();
	await expect(editor(page)).toContainText('结果：换成 cos x（替身）');
	expect(workLog()).toBe('- 画一个 sin x 的图；接着上次：否\n- 加上图例；接着上次：是\n- 换成 cos x；接着上次：否\n');
});

test('AI 助手 lists the AIs, adds another, and the one Alt+Enter uses is chosen there', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-terminal').click();
	await page.locator('#terminal-agents .terminal-agents-settings').click();
	const dialog = page.locator('#agents-dialog');
	const names = () => dialog.locator('.agent-row input[name="name"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
	await expect.poll(names).toEqual(['Claude', 'Codex', 'pi']);
	await dialog.getByRole('button', { name: '＋ 添加一个' }).click();
	const added = dialog.locator('.agent-row').last();
	await added.locator('input[name="name"]').fill('omp');
	await added.locator('input[name="id"]').fill('omp');
	await added.locator('input[name="launch"]').fill('omp');
	await added.locator('input[name="run"]').fill('omp -p {prompt}');
	await added.locator('input[name="resume"]').fill('omp -p --continue {prompt}');
	await added.getByLabel('Alt+Enter 用它').check();
	await dialog.getByRole('button', { name: '保存' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('#terminal-agents').getByRole('button', { name: 'omp' })).toBeDisabled();
	// A run without {prompt}: said, not saved.
	await page.locator('#terminal-agents .terminal-agents-settings').click();
	await dialog.locator('.agent-row').last().locator('input[name="run"]').fill('omp -p');
	await dialog.getByRole('button', { name: '保存' }).click();
	await expect(dialog.locator('#agents-status')).toContainText('{prompt}');
	await dialog.getByRole('button', { name: '恢复预设' }).click();
	await dialog.getByRole('button', { name: '保存' }).click();
	await expect(dialog).toBeHidden();
});
