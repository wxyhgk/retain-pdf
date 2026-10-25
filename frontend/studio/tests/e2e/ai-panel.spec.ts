import { createServer } from 'node:http';

import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, removeArticle, resetFixture, writeArticle } from './studio.ts';

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
	await expect(pane(page).locator('.ai-where')).toHaveText('');
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	await tell(page, '跑一下');
	await expect(input(page)).toHaveValue('');
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('跑一下');
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
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText(['跑一下', '再跑一下']);
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
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('慢慢来');
});

test('an agent whose adapter is missing says so where the answer would be', async ({ page }) => {
	await openAi(page);
	// The tests have no Codex stand-in: its adapter is not found.
	await pane(page).locator('.ai-agent').selectOption('codex');
	await expect(pane(page).locator('.ai-status')).toContainText('Codex 没能启动');
	await expect(pane(page).locator('.ai-status')).toHaveClass(/is-error/u);
});

test('⚙ 模型和账号: another service, tried with a word and saved, is the one the next conversation is started for; its key never comes back', async ({ page }) => {
	// A service that speaks Anthropic's API, here: it answers 「好」.
	const asked: string[] = [];
	const service = createServer((request, response) => {
		asked.push(`${request.url} ${request.headers.authorization}`);
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify({ content: [{ type: 'text', text: '好' }] }));
	});
	await new Promise<void>((resolve) => service.listen(0, '127.0.0.1', resolve));
	const address = `http://127.0.0.1:${(service.address() as import('node:net').AddressInfo).port}`;
	try {
		await openAi(page);
		await pane(page).getByRole('button', { name: '模型和账号' }).click();
		const sheet = pane(page).locator('.ai-sheet');
		await expect(sheet).toBeVisible();
		await expect(pane(page).locator('.ai-input')).toBeHidden();
		await sheet.getByLabel('模型来源', { exact: true }).selectOption('custom');
		await sheet.getByLabel('接口地址').fill(address);
		await sheet.getByLabel('API key').first().fill('sk-test');
		await sheet.getByLabel('主模型').fill('fake-main');
		await sheet.getByRole('button', { name: '检查' }).first().click();
		await expect(sheet.locator('.ai-sheet-result').first()).toHaveText('能用：fake-main 回答了「好」');
		expect(asked).toEqual(['/v1/messages Bearer sk-test']);
		await sheet.getByRole('button', { name: '保存' }).first().click();
		// Back to the conversation, a new one, on that service: its models by their names.
		await expect(sheet).toBeHidden();
		await expect(pane(page).locator('.ai-where')).toHaveText('其他（兼容 Anthropic 接口）');
		await expect(pane(page).locator('.ai-options select[aria-label="Model"] option')).toHaveText(['fake-main']);
		await tell(page, '环境');
		await expect(pane(page).locator('.ai-message')).toHaveText(`地址 ${address} 模型 fake-main key 有`);
		// The key stays on the server.
		await pane(page).getByRole('button', { name: '模型和账号' }).click();
		await expect(sheet.getByLabel('API key').first()).toHaveValue('');
		await expect(sheet.getByLabel('API key').first()).toHaveAttribute('placeholder', '已保存（不改就留空）');
		expect(await page.content()).not.toContain('sk-test');
	} finally {
		service.close();
	}
});

test('pi: a service of its catalog and a key, saved; the next pi conversation has that key and only that service’s models', async ({ page }) => {
	await openAi(page);
	await pane(page).getByRole('button', { name: '模型和账号' }).click();
	const sheet = pane(page).locator('.ai-sheet');
	await sheet.getByLabel('pi 的模型来源').selectOption('deepseek');
	await expect(sheet.getByLabel('API key').nth(1)).toHaveAttribute('placeholder', '粘贴 API key（pi 从 DEEPSEEK_API_KEY 读）');
	await sheet.getByLabel('API key').nth(1).fill('sk-deepseek');
	await sheet.locator('.ai-sheet-actions').nth(1).getByRole('button', { name: '保存' }).click();
	await expect(sheet).toBeHidden();
	await pane(page).locator('.ai-agent').selectOption('pi');
	await expect(pane(page).locator('.ai-where')).toHaveText('DeepSeek');
	await expect(pane(page).locator('.ai-options select[aria-label="Model"] option')).toHaveText(['deepseek/deepseek-flash', 'deepseek/deepseek-v4-pro']);
	await tell(page, '环境');
	await expect(pane(page).locator('.ai-message')).toHaveText('pi 模型 deepseek/deepseek-flash DeepSeek key sk-deepseek');
});

test('what is said is told where the author is: the article open (followed as another is opened), what is selected, the articles named with @', async ({ page }) => {
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n另一篇的一段。\n');
	try {
		await openAi(page);
		const chips = pane(page).locator('.ai-context .ai-chip-label');
		await expect(chips).toHaveText(['📄 Studio 测试夹具']);
		// Something selected in the article: a chip too.
		await editor(page).locator('p', { hasText: '结尾段落' }).click({ clickCount: 3 });
		await expect(chips).toHaveText(['📄 Studio 测试夹具', '选中的内容']);
		// @ names another article, from the list.
		await input(page).fill('上下文 看看 @另一');
		await expect(pane(page).locator('.ai-mention')).toHaveCount(1);
		await input(page).press('Enter');
		await expect(input(page)).toHaveValue('上下文 看看 ');
		await expect(chips).toHaveText(['📄 Studio 测试夹具', '选中的内容', '@ 另一篇笔记']);
		await input(page).press('Enter');
		const answer = pane(page).locator('.ai-message').last();
		await expect(answer).toContainText('当前打开的文章：《Studio 测试夹具》，文件 studio-fixture/index.md');
		await expect(answer).toContainText('选中的是这篇的第');
		await expect(answer).toContainText('结尾段落。');
		await expect(answer).toContainText('用 @ 提到的文章：《另一篇笔记》，文件 other-note/index.md');
		// What was said is shown as said, with what it named.
		await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('上下文 看看');
		await expect(pane(page).locator('.ai-user-context')).toContainText('@ 另一篇笔记');

		// Another article opened: the same conversation, told of that one now.
		await page.locator('#article-list').getByText('另一篇笔记', { exact: true }).click();
		await expect(chips).toHaveText(['📄 另一篇笔记']);
		await expect(pane(page).locator('.ai-user')).toHaveCount(1);
		// Left out by its ×.
		await pane(page).getByRole('button', { name: '不带上📄 另一篇笔记' }).click();
		await expect(pane(page).locator('.ai-context')).toBeHidden();
		await tell(page, '上下文');
		await expect(pane(page).locator('.ai-message').last()).not.toContainText('当前打开的文章');
	} finally {
		removeArticle('other-note');
	}
});
