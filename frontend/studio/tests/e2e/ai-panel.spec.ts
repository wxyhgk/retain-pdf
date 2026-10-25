import { expect, test, type Page } from '@playwright/test';

import { openStudio, resetFixture } from './studio.ts';

// The AI tab: a coding agent spoken to over the Agent Client Protocol (a stand-in here:
// tests/e2e/fake-agents/fake-acp.mjs), which thinks, says what it will do, asks leave to run a command, runs it,
// changes a file and keeps a plan; each drawn as it comes, the leave answered in the panel.

const pane = (page: Page) => page.locator('#side-ai');
const input = (page: Page) => pane(page).locator('.ai-input');

async function openAi(page: Page): Promise<void> {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	// Begun at once in the article's folder: its options are there when it is ready.
	await expect(pane(page).locator('.ai-options select')).toHaveCount(2);
	await expect(pane(page).locator('.ai-agent')).toHaveValue('claude');
}

async function tell(page: Page, text: string): Promise<void> {
	await input(page).fill(text);
	await input(page).press('Enter');
}

test.beforeEach(() => resetFixture());

test('the agent thinks, asks leave to run a command, runs it once allowed, changes a file, keeps a plan; drawn as it goes', async ({ page }) => {
	await openAi(page);
	await expect(pane(page).locator('.ai-where')).toHaveText('在这篇文章里');
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	await tell(page, '跑一下');
	await expect(input(page)).toHaveValue('');
	await expect(pane(page).locator('.ai-user')).toHaveText('跑一下');
	await expect(pane(page).locator('.ai-empty')).toBeHidden();

	// Leave asked: the command shown, three answers.
	const asked = pane(page).locator('.ai-permission');
	await expect(asked.locator('.ai-permission-what')).toHaveText('echo hi');
	await expect(asked.locator('button')).toHaveText(['允许', '总是允许', '拒绝']);
	await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '停下');
	await asked.getByRole('button', { name: '允许', exact: true }).click();
	await expect(asked.locator('.ai-permission-answer')).toHaveText('已允许');

	// Its words, drawn as Markdown with formulas; its thinking folded.
	const last = pane(page).locator('.ai-message').last();
	await expect(last.locator('strong')).toHaveText('hi');
	await expect(last.locator('.katex')).toHaveCount(1);
	await expect(pane(page).locator('.ai-message').first()).toHaveText('收到（模型 small）。我来运行命令。');
	const thought = pane(page).locator('.ai-thought');
	await expect(thought.locator('summary')).toHaveText('思考过程');
	await expect(thought.locator('.ai-thought-text')).toBeHidden();
	await thought.locator('summary').click();
	await expect(thought.locator('.ai-thought-text')).toHaveText('先看看要做什么。');

	// The command: done, its output when opened.
	const run = pane(page).locator('.ai-tool[data-kind="execute"]');
	await expect(run).toHaveAttribute('data-status', 'completed');
	await expect(run.locator('.ai-tool-title')).toHaveText('echo hi');
	await expect(run.locator('.ai-tool-detail')).toBeHidden();
	await run.locator('.ai-tool-row').click();
	await expect(run.locator('.ai-tool-detail pre')).toHaveText('hi');
	// The change to a file, as lines taken away and put in.
	const edit = pane(page).locator('.ai-tool[data-kind="edit"]');
	await edit.locator('.ai-tool-row').click();
	await expect(edit.locator('.ai-diff-path')).toHaveText('index.md');
	await expect(edit.locator('.ai-diff-lines span')).toHaveText(['- 旧的一行\n', '+ 新的一行\n']);
	// The plan, the latest of it.
	await expect(pane(page).locator('.ai-plan')).toHaveCount(1);
	await expect(pane(page).locator('.ai-plan li')).toHaveClass([/is-completed/u, /is-completed/u]);

	await expect(pane(page).locator('.ai-title')).toHaveText('问：跑一下');
	await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '发送');

	// Another model for what comes next.
	await pane(page).locator('.ai-options select[aria-label="Model"]').selectOption('large');
	await tell(page, '再跑一下');
	await pane(page).locator('.ai-permission').last().getByRole('button', { name: '拒绝' }).click();
	await expect(pane(page).locator('.ai-message').last()).toHaveText('好，不运行了。');
	await expect(pane(page).locator('.ai-message').nth(2)).toHaveText('收到（模型 large）。我来运行命令。');
	await expect(pane(page).locator('.ai-tool[data-kind="execute"]').last()).toHaveAttribute('data-status', 'failed');

	// The page loaded again: the same conversation, as it was.
	await page.reload();
	await page.locator('#side-tab-ai').click();
	await expect(pane(page).locator('.ai-user')).toHaveText(['跑一下', '再跑一下']);
	await expect(pane(page).locator('.ai-title')).toHaveText('问：再跑一下');
});

test('a turn is stopped from the send button; ＋ begins another conversation, the first kept in the list', async ({ page }) => {
	await openAi(page);
	await tell(page, '慢慢来');
	const send = pane(page).locator('.ai-send');
	await expect(send).toHaveAttribute('aria-label', '停下');
	await expect(pane(page).locator('.ai-tool[data-status="in_progress"]')).toHaveCount(1);
	await send.click();
	await expect(pane(page).locator('.ai-stop')).toHaveText('已停止');
	await expect(send).toHaveAttribute('aria-label', '发送');

	// What is chosen for an AI is given to its next conversation too.
	await pane(page).locator('.ai-options select[aria-label="Model"]').selectOption('large');
	await pane(page).locator('.ai-options select[aria-label="Mode"]').selectOption('plan');
	await expect(pane(page).locator('.ai-options select[aria-label="Mode"] option:checked')).toHaveText('只做计划');
	await pane(page).getByRole('button', { name: '新对话' }).click();
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	await expect(pane(page).locator('.ai-options select')).toHaveCount(2);
	await expect(pane(page).locator('.ai-options select[aria-label="Model"]')).toHaveValue('large');
	await expect(pane(page).locator('.ai-options select[aria-label="Mode"]')).toHaveValue('plan');
	await pane(page).getByRole('button', { name: '对话记录' }).click();
	await page.getByRole('menuitem', { name: /慢慢来|还没说话/u }).first().click();
	await expect(pane(page).locator('.ai-user')).toHaveText('慢慢来');
});

test('an agent whose adapter is missing says so where the answer would be', async ({ page }) => {
	await openAi(page);
	// The tests have no Codex stand-in: its adapter is not found.
	await pane(page).locator('.ai-agent').selectOption('codex');
	await expect(pane(page).locator('.ai-status')).toContainText('Codex 没能启动');
	await expect(pane(page).locator('.ai-status')).toHaveClass(/is-error/u);
});
