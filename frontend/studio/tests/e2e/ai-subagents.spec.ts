import { expect, test, type Page } from '@playwright/test';

import { openStudio, resetFixture } from './studio.ts';

// Subagents an AI runs (pi's subagent extension, reported by the Studio's pi: pi-agent.mjs subagentsOf), as Claude
// Code, opencode and Cline show theirs: a card in the conversation, not folded in with the steps; a row each, what it
// is doing now, how many tools, tokens, how long; the status line counting those at work; opened, its steps and what
// it said; one that failed says why.

const pane = (page: Page) => page.locator('#side-ai');
const input = (page: Page) => pane(page).locator('.ai-input .ProseMirror');

test.beforeEach(() => resetFixture());

test('subagents at work: a row each, what it is doing, how much, how long; done or failed; opened, its steps and what it said', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	await expect(pane(page).locator('.ai-effort')).toBeVisible();
	await input(page).fill('子代理');
	await input(page).press('Enter');

	const card = pane(page).locator('.ai-subagents');
	await expect(card.locator('.ai-subagents-title')).toContainText('2 个子代理并行');
	// In the conversation, not in the folded line of steps.
	await expect(pane(page).locator('.ai-work .ai-subagents')).toHaveCount(0);
	const [scout, planner] = [card.locator('.ai-subagent').nth(0), card.locator('.ai-subagent').nth(1)];
	await expect(scout).toHaveAttribute('data-status', 'running');
	await expect(scout.locator('.ai-subagent-name')).toHaveText('scout');
	await expect(scout.locator('.ai-subagent-task')).toHaveText('找认证代码');
	await expect(scout.locator('.ai-subagent-doing')).toHaveText('grep -rn auth src');
	await expect(scout.locator('.ai-subagent-facts')).toHaveText('1 次工具 · 1.8k tokens');
	await expect(scout.locator('.ai-subagent-time')).toContainText('1 分 0');
	await expect(planner.locator('.ai-subagent-doing')).toHaveText('准备中…');
	await expect(pane(page).locator('.ai-status')).toContainText('2 个子代理在跑');

	// Done: one finished, one failed (why, in red), the time stopped; nothing at work said.
	await expect(scout).toHaveAttribute('data-status', 'completed');
	await expect(card.locator('.ai-subagents-count')).toHaveText('1/2 完成 · 1 个失败');
	await expect(scout.locator('.ai-subagent-facts')).toHaveText('1 次工具 · 3.5k tokens · $0.004');
	await expect(scout.locator('.ai-subagent-time')).toHaveText('1 分 12 秒');
	await expect(scout.locator('.ai-subagent-doing')).toHaveCount(0);
	await expect(planner).toHaveAttribute('data-status', 'failed');
	await expect(planner.locator('.ai-subagent-error')).toHaveText('模型拒绝了请求');
	await expect(pane(page).locator('.ai-status')).not.toContainText('子代理');

	// Opened: what it was given, its steps, what it said.
	await scout.locator('.ai-subagent-row').click();
	await expect(scout.locator('.ai-subagent-steps li')).toHaveText(['›_grep -rn auth src']);
	await expect(scout.locator('.ai-subagent-output strong')).toHaveText('src/auth.ts');
	await expect(scout.locator('.ai-subagent-model')).toHaveText('fake/m1');
});

test('a step still going when its turn is over (its end never told) says it was cut off, not turning', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	await expect(pane(page).locator('.ai-effort')).toBeVisible();
	await input(page).fill('漏掉');
	await input(page).press('Enter');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('做完了。');
	await pane(page).locator('.ai-work').last().click();
	const step = page.locator('.ai-work-dialog .ai-tool');
	await expect(step).toHaveAttribute('data-status', 'interrupted');
	await expect(step.locator('.ai-tool-state')).toHaveText('已中断');
	// Gray, not the red of a failure, and not turning.
	expect(await step.locator('.ai-tool-state').evaluate((node) => getComputedStyle(node).color)).not.toMatch(/rgb\(2\d\d, \d{1,2}, \d{1,2}\)/u);
	expect(await step.locator('.ai-tool-state').evaluate((node) => getComputedStyle(node, '::after').animationName)).toBe('none');
});
