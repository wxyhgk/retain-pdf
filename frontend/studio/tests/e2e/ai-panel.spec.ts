import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { editFixture, editor, fixtureHas, openStudio, removeArticle, resetFixture, saveStatus, savedMarkdown, scienceBlock, writeArticle, writeFixtureFile } from './studio.ts';

// The AI tab: a coding agent spoken to over the Agent Client Protocol (a stand-in here:
// tests/e2e/fake-agents/fake-acp.mjs), which thinks, says what it will do, asks leave to run a command, runs it,
// changes a file and keeps a plan; each drawn as it comes, the leave answered in the panel.

const pane = (page: Page) => page.locator('#side-ai');
/** The input: an editor as articles' (its words while empty over it). */
const input = (page: Page) => pane(page).locator('.ai-input .ProseMirror');
const placeholder = (page: Page) => pane(page).locator('.ai-input-placeholder');
const modelButton = (page: Page) => pane(page).locator('.ai-model');
/** The model menu's items: a model of it, one of a submenu (`under`), an option of the menu's foot. */
const menuItem = (page: Page, name: string) => page.locator('.ai-menu [role^="menuitem"]', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u') }).first();

/** `name` chosen from the model menu (from the submenu `under`, if given). */
async function fromModelMenu(page: Page, name: string, under?: string): Promise<void> {
	await modelButton(page).click();
	if (under) await menuItem(page, under).click();
	await menuItem(page, name).click();
	await expect(page.locator('.ai-menu')).toHaveCount(0);
}

async function openAi(page: Page): Promise<void> {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	// Begun at once in the article's folder: its options under the input when it is ready (the model that of the
	// service a test before may have saved).
	await expect(pane(page).locator('.ai-effort')).toBeVisible();
	await expect(modelButton(page)).toHaveAttribute('title', /（Claude 运行）$/u);
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
	await expect(input(page)).toHaveText('');
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('跑一下');
	await expect(pane(page).locator('.ai-empty')).toBeHidden();

	// Leave asked: the command shown, three answers.
	const asked = pane(page).locator('.ai-permission');
	await expect(asked.locator('.ai-permission-what')).toHaveText('echo hi');
	await expect(asked.locator('button')).toHaveText(['允许', '总是允许', '拒绝']);
	await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '停下');
	await asked.getByRole('button', { name: '允许', exact: true }).click();
	await expect(asked.locator('.ai-permission-answer')).toHaveText('已允许');

	// Its words, drawn as Markdown with formulas.
	const last = pane(page).locator('.ai-message').last();
	await expect(last.locator('strong')).toHaveText('hi');
	await expect(last.locator('.katex')).toHaveCount(1);
	await expect(pane(page).locator('.ai-message').first()).toHaveText('收到（模型 small）。我来运行命令。');
	// The work toward it, a row a stretch (what the leave asked splits): what it did, nothing of it shown.
	const work = pane(page).locator('.ai-work');
	await expect(work).toHaveText(['⚙思考›', '⚙运行了 1 个命令 · 计划 2/2›', '⚙改了 index.md›']);
	await expect(pane(page).locator('.ai-thought, .ai-tool, .ai-plan')).toHaveCount(0);
	// Opened: its detail in a dialog, the thinking open, closed with Esc.
	const dialog = page.locator('.ai-work-dialog');
	await work.first().click();
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.ai-thought-text')).toHaveText('先看看要做什么。');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	// The command: done, its output when opened; the plan, the latest of it.
	await work.nth(1).click();
	const run = dialog.locator('.ai-tool[data-kind="execute"]');
	await expect(run).toHaveAttribute('data-status', 'completed');
	await expect(run.locator('.ai-tool-title')).toHaveText('echo hi');
	await expect(run.locator('.ai-tool-detail')).toBeHidden();
	await run.locator('.ai-tool-row').click();
	await expect(run.locator('.ai-tool-detail pre')).toHaveText('hi');
	await expect(dialog.locator('.ai-plan li')).toHaveClass([/is-completed/u, /is-completed/u]);
	await dialog.getByRole('button', { name: '关闭' }).click();
	// The change to a file, as lines taken away and put in.
	await work.nth(2).click();
	const edit = dialog.locator('.ai-tool[data-kind="edit"]');
	await edit.locator('.ai-tool-row').click();
	await expect(edit.locator('.ai-diff-path')).toHaveText('index.md');
	await expect(edit.locator('.ai-diff-lines span')).toHaveText(['- 旧的一行\n', '+ 新的一行\n']);
	await page.keyboard.press('Escape');

	await expect(pane(page).locator('.ai-title')).toHaveText('问：跑一下');
	await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '发送');

	// Another model for what comes next.
	await fromModelMenu(page, 'Large');
	await tell(page, '再跑一下');
	await pane(page).locator('.ai-permission').last().getByRole('button', { name: '拒绝' }).click();
	await expect(pane(page).locator('.ai-message').last()).toHaveText('好，不运行了。');
	await expect(pane(page).locator('.ai-message').nth(2)).toHaveText('收到（模型 large）。我来运行命令。');
	await expect(pane(page).locator('.ai-work').nth(4)).toContainText('1 步失败');

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
	// What it is doing now, on its row.
	await expect(pane(page).locator('.ai-work.is-going')).toContainText('正在运行 sleep 100');
	await send.click();
	await expect(pane(page).locator('.ai-stop')).toHaveText('已停止');
	await expect(send).toHaveAttribute('aria-label', '发送');

	// What is chosen for an AI is given to its next conversation too.
	await fromModelMenu(page, 'Large');
	await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Large');
	await fromModelMenu(page, '只做计划', '权限：每步都问');
	await modelButton(page).click();
	await expect(menuItem(page, '权限：')).toHaveText('权限：只做计划');
	await page.keyboard.press('Escape');
	await pane(page).getByRole('button', { name: '新对话' }).click();
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Large');
	await modelButton(page).click();
	await expect(menuItem(page, '权限：')).toHaveText('权限：只做计划');
	await page.keyboard.press('Escape');
	await pane(page).getByRole('button', { name: '对话记录' }).click();
	await page.getByRole('menuitem', { name: /慢慢来|还没说话/u }).first().click();
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('慢慢来');
});

test('an agent whose adapter is missing says so where the answer would be', async ({ page }) => {
	await openAi(page);
	// The tests have no Codex stand-in: its adapter is not found.
	await fromModelMenu(page, 'Codex', '用 Claude 运行');
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
		await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Fake Main');
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

test('⚙ 模型和账号 closed by its ×: the conversation is back', async ({ page }) => {
	await openAi(page);
	await pane(page).getByRole('button', { name: '模型和账号' }).click();
	await expect(pane(page).locator('.ai-sheet')).toBeVisible();
	await pane(page).getByRole('button', { name: '关闭模型和账号' }).click();
	await expect(pane(page).locator('.ai-sheet')).toBeHidden();
	await expect(pane(page).locator('.ai-input')).toBeVisible();
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
	await fromModelMenu(page, 'pi', '用 Claude 运行');
	await expect(pane(page).locator('.ai-where')).toHaveText('DeepSeek');
	// Its models by their names, under their service's; the services with no key, to give one in ⚙.
	await modelButton(page).click();
	await expect(page.locator('.ai-menu-label')).toHaveText(['DeepSeek']);
	await expect(page.locator('.ai-model-item .ai-model-name')).toHaveText(['DeepSeek Flash', 'DeepSeek V4 Pro']);
	await menuItem(page, '更多模型来源').click();
	await expect(page.locator('.ai-model-keyless', { hasText: 'Kimi' }).first()).toBeVisible();
	await page.keyboard.press('Escape');
	await tell(page, '环境');
	await expect(pane(page).locator('.ai-message')).toHaveText('pi 模型 deepseek/deepseek-flash DeepSeek key sk-deepseek');
});

test('the model menu: another service or AI goes on with the same conversation; a starred model is first in it; how hard it thinks, from the bars', async ({ page }) => {
	await openAi(page);
	// A service of Claude Code's with a key (its address never asked here): the conversation begun on it.
	await pane(page).getByRole('button', { name: '模型和账号' }).click();
	const sheet = pane(page).locator('.ai-sheet');
	await sheet.getByLabel('模型来源', { exact: true }).selectOption('custom');
	await sheet.getByLabel('接口地址').fill('http://127.0.0.1:9');
	await sheet.getByLabel('API key').first().fill('sk-test');
	await sheet.getByLabel('主模型').fill('fake-main');
	await sheet.getByRole('button', { name: '保存' }).first().click();
	await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Fake Main');
	await tell(page, '环境');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('地址 http://127.0.0.1:9 模型 fake-main key 有');

	// The Claude account, another service: the same conversation, its agent started again for it.
	await modelButton(page).click();
	await expect(page.locator('.ai-menu-label').first()).toHaveText('其他（兼容 Anthropic 接口）');
	await menuItem(page, 'Claude 账号').click();
	await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Small');
	await expect(pane(page).locator('.ai-where')).toHaveText('');
	await tell(page, '环境');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('地址 无 模型 无 key 无');
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText(['环境', '环境']);

	// Starred: first in the menu, chosen from there.
	await modelButton(page).click();
	await page.locator('.ai-model-item', { hasText: 'Large' }).hover();
	await page.locator('.ai-model-item', { hasText: 'Large' }).getByRole('button', { name: '设为常用' }).click();
	await expect(page.locator('.ai-menu-label').first()).toHaveText('常用');
	await page.locator('.ai-model-item').first().click();
	await expect(modelButton(page)).toHaveAttribute('aria-label', '模型：Large');
	// How hard it thinks: bars, a level from their menu.
	const effort = pane(page).locator('.ai-effort');
	await expect(effort).toHaveAttribute('aria-label', '思考：中');
	await effort.click();
	await menuItem(page, '高').click();
	await expect(effort).toHaveAttribute('aria-label', '思考：高');

	// Another AI: the same conversation, told where what was said is.
	await fromModelMenu(page, 'pi', '用 Claude 运行');
	await expect(modelButton(page)).toHaveAttribute('title', /（pi 运行）$/u);
	await tell(page, '上下文');
	await expect(pane(page).locator('.ai-message').last()).toContainText('之前说过的话记在');
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText(['环境', '环境', '上下文']);
});

test('what is said is told where the author is: the article open (followed as another is opened), what is selected, the articles named with @', async ({ page }) => {
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n另一篇的一段。\n');
	// The fixture has its brief (blog/AGENTS.md: read it first), the other none: said of each, so none is tried for.
	writeFixtureFile('ai/brief.md', '写给刚学量子化学的本科生。\n');
	try {
		await openAi(page);
		const chips = pane(page).locator('.ai-context .ai-chip-label');
		await expect(chips).toHaveText(['Studio 测试夹具']);
		// Something selected in the article: a chip too.
		await editor(page).locator('p', { hasText: '结尾段落' }).click({ clickCount: 3 });
		await expect(chips).toHaveText(['Studio 测试夹具', '选中的内容']);
		// @ names another article, from the list.
		await input(page).fill('上下文 看看 @另一');
		await expect(pane(page).locator('.ai-mention')).toHaveCount(1);
		await input(page).press('Enter');
		await expect(input(page)).toHaveText('上下文 看看');
		await expect(chips).toHaveText(['Studio 测试夹具', '选中的内容', '另一篇笔记']);
		await input(page).press('Enter');
		const answer = pane(page).locator('.ai-message').last();
		await expect(answer).toContainText('当前打开的文章：《Studio 测试夹具》，文件 studio-fixture/index.md；它的写作要求在 studio-fixture/ai/brief.md，先读');
		await expect(answer).toContainText('选中的是这篇的第');
		await expect(answer).toContainText('结尾段落。');
		await expect(answer).toContainText('用 @ 提到的文章：《另一篇笔记》，文件 other-note/index.md（没有 ai/brief.md，不用找）');
		// What was said is shown as said, with what it named.
		await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('上下文 看看');
		await expect(pane(page).locator('.ai-user-context')).toContainText('另一篇笔记');

		// Another article opened: the same conversation, told of that one now.
		await page.locator('#article-list').getByText('另一篇笔记', { exact: true }).click();
		await expect(chips).toHaveText(['另一篇笔记']);
		await expect(pane(page).locator('.ai-user')).toHaveCount(1);
		// Left out by its ×.
		await pane(page).getByRole('button', { name: '不带上另一篇笔记' }).click();
		await expect(pane(page).locator('.ai-context')).toBeHidden();
		await tell(page, '上下文');
		await expect(pane(page).locator('.ai-message').last()).not.toContainText('当前打开的文章');
	} finally {
		removeArticle('other-note');
	}
});

test('the articles a conversation names are links to them, as Notion’s page mentions: a card as the pointer rests on one, opened when clicked', async ({ page }) => {
	writeArticle('other-note', '---\ntitle: 另一篇笔记\ndescription: 另一篇的简介。\npubDate: 2026-10-01\ndraft: true\n---\n\n另一篇的一段。\n');
	try {
		await openAi(page);
		await tell(page, '提到');
		// By title (its 《》 kept), by a link to its file, by its path in code; a title of none, as it is.
		const answer = pane(page).locator('.ai-message').last();
		const links = answer.locator('.ai-page-link');
		await expect(links).toHaveText(['另一篇笔记', '这篇夹具', 'other-note/index.md']);
		await expect(answer).toContainText('参见《另一篇笔记》');
		await expect(answer).toContainText('《没有这篇》不是');

		// Rested on: its card (its 简介, its date); clicked, the article open.
		await links.first().hover();
		const card = page.locator('.page-peek');
		await expect(card.locator('.page-peek-title')).toHaveText('另一篇笔记');
		await expect(card.locator('.page-peek-description')).toHaveText('另一篇的简介。');
		await expect(card.locator('.page-peek-facts')).toHaveText('草稿 · 2026-10-01');
		await links.first().click();
		await expect(card).toBeHidden();
		const chips = pane(page).locator('.ai-context .ai-chip-label');
		await expect(chips).toHaveText(['另一篇笔记']);
		await expect(page.locator('#article-title-input')).toHaveValue('另一篇笔记');

		// What was told with what was said too: from AI 问答 whole, back in the editor.
		await pane(page).getByRole('button', { name: '在页面中打开' }).click();
		await expect(pane(page).getByRole('button', { name: '收回到右边' })).toBeVisible();
		await pane(page).locator('.ai-user-context').getByRole('button', { name: 'Studio 测试夹具' }).click();
		await expect(chips).toHaveText(['Studio 测试夹具']);
		await expect(pane(page).getByRole('button', { name: '在页面中打开' })).toBeVisible();
	} finally {
		removeArticle('other-note');
	}
});

test('what the AI says is blocks: each dragged into the article, or clicked in where the caret is; all of it put in at once', async ({ page }) => {
	await openAi(page);
	await tell(page, '几块');
	const blocks = pane(page).locator('.ai-message .ai-block');
	// A paragraph, a formula, and the list an item a block, as the editor has them.
	await expect(blocks).toHaveCount(4);
	await expect(blocks.nth(1).locator('.ai-math-display')).toHaveCount(1);
	await expect(blocks.nth(2)).toHaveAttribute('data-markdown', '- 要点一');
	await expect(blocks.nth(3)).toHaveAttribute('data-markdown', '- 要点二');
	// The formula dragged onto the last paragraph: it goes after it.
	const formulas = editor(page).locator('.pm-display-math');
	const before = await formulas.count();
	await blocks.nth(1).hover();
	await blocks.nth(1).locator('.ai-block-handle').dragTo(editor(page).locator('p', { hasText: '结尾段落' }));
	await expect(formulas).toHaveCount(before + 1);
	// The list's second item clicked in, where the caret is: on a new line after that paragraph.
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await blocks.nth(3).hover();
	await blocks.nth(3).locator('.ai-block-handle').click();
	await expect(editor(page).locator('li', { hasText: '要点二' })).toHaveCount(1);
	await expect(editor(page).locator('li', { hasText: '要点一' })).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const saved = savedMarkdown();
	const at = (text: string) => saved.indexOf(text);
	expect(at('结尾段落。')).toBeGreaterThan(-1);
	expect(at('- 要点二')).toBeGreaterThan(at('结尾段落。'));
	expect(at('$$\nE = mc^2\n$$')).toBeGreaterThan(at('- 要点二'));

	// All of it, from under the answer.
	await pane(page).locator('.ai-message').hover();
	await pane(page).getByRole('button', { name: '插入到文章' }).click();
	await expect(editor(page)).toContainText('能量和质量的关系：');
});

test('a conversation is kept in chats/ as a page: there again once the page is opened again; deleted from the list, its folder too', async ({ page }) => {
	await openAi(page);
	await tell(page, '几块 记下来');
	await expect(pane(page).locator('.ai-message .ai-block')).toHaveCount(4);
	// The tests' chats/ is beside their copy of blog/.
	const chats = `${process.env.STUDIO_BLOG_DIR}-chats`;
	const kept = () => (existsSync(chats) ? readdirSync(chats) : []).find((name) => existsSync(join(chats, name, 'index.md')) && readFileSync(join(chats, name, 'index.md'), 'utf8').includes('```ask\n几块 记下来\n```')) ?? null;
	await expect.poll(kept).not.toBeNull();
	const folder = join(chats, kept()!);
	expect(readFileSync(join(folder, 'index.md'), 'utf8')).toContain('draft: true');
	// All of it, a moment after.
	await expect.poll(() => existsSync(join(folder, 'ai', 'conversation.json'))).toBe(true);

	// Opened again: the same conversation, as it was.
	await page.reload();
	await page.locator('#side-tab-ai').click();
	await expect(pane(page).locator('.ai-user .ai-bubble')).toHaveText('几块 记下来');
	await expect(pane(page).locator('.ai-message .ai-block')).toHaveCount(4);

	// Deleted, once the author says yes: its folder gone, a new conversation begun.
	page.once('dialog', (dialog) => void dialog.accept());
	await pane(page).getByRole('button', { name: '对话记录' }).click();
	await page.getByRole('menuitem', { name: '删除这个对话' }).click();
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	expect(existsSync(folder)).toBe(false);
});

test('a turn over with nothing said (only thought) is said so; 接着说 asks for what it concluded', async ({ page }) => {
	await openAi(page);
	await tell(page, '只想不说');
	const notice = pane(page).locator('.ai-notice');
	await expect(notice).toContainText('停下了，但没有说结论');
	await notice.getByRole('button', { name: '接着说' }).click();
	await expect(pane(page).locator('.ai-user .ai-bubble').last()).toHaveText('接着说：把你刚才的结论告诉我。');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('结论是这样的。');
});

test('a picture the AI drew on this machine is shown, by its path', async ({ page }) => {
	await openAi(page);
	await tell(page, '画图');
	const picture = pane(page).locator('.ai-message img[alt="势能曲线"]');
	await expect(picture).toHaveCount(1);
	await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
	// Small in the conversation, whole when clicked.
	expect((await picture.boundingBox())!.height).toBeLessThanOrEqual(300);
	await picture.click();
	const whole = page.locator('.ai-picture-dialog');
	await expect(whole).toBeVisible();
	await expect(whole.locator('img')).toHaveAttribute('alt', '势能曲线');
	await whole.click();
	await expect(whole).toBeHidden();
});

test('what the AI changes in the article open while it works is looked over once its turn is over, all at once', async ({ page }) => {
	await openAi(page);
	await tell(page, '慢慢来');
	await expect(pane(page).locator('.ai-work.is-going')).toBeVisible();
	editFixture((markdown) => markdown.replace('结尾段落。', '结尾段落，AI 改的。'));
	await expect(page.locator('.studio-toast')).toContainText('AI 在改这篇文章，做完后一起给你过目');
	editFixture((markdown) => markdown.replace('开头段落', '开头段落（AI 又改了）'));
	await page.waitForTimeout(1500);
	await expect(page.locator('#review-bar')).toBeHidden();
	// Its turn over (stopped here): the changes, together.
	await pane(page).locator('.ai-send').click();
	await expect(page.locator('#review-count')).toHaveText('磁盘上的文章有 2 处改动');
	await expect(editor(page)).toContainText('AI 又改了');
});

test('a picture the AI looked at is on its row, small, and whole in the dialog; one it sends as an attachment is in its words', async ({ page }) => {
	await openAi(page);
	await tell(page, '看图');
	const loaded = (picture: import('@playwright/test').Locator) => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth);
	const thumbnail = pane(page).locator('.ai-work .ai-work-picture');
	await expect(thumbnail).toHaveCount(1);
	await expect.poll(() => loaded(thumbnail)).toBeGreaterThan(0);
	const sent = pane(page).locator('.ai-message img');
	await expect(sent).toHaveCount(1);
	await expect.poll(() => loaded(sent)).toBeGreaterThan(0);
	await pane(page).locator('.ai-work').click();
	await page.locator('.ai-work-dialog .ai-tool-row').click();
	await expect.poll(() => loaded(page.locator('.ai-work-dialog .ai-tool-picture'))).toBeGreaterThan(0);
});

test('the plugins’ blocks in an answer are drawn as in the editor, and put in the article are those blocks; a picture of this machine is copied in', async ({ page }) => {
	await openAi(page);
	await tell(page, '组件');
	const blocks = pane(page).locator('.ai-message .ai-block');
	await expect(blocks).toHaveCount(6);
	// A molecule in 2D and in 3D, an energy diagram, a widget's frame, a bookmark's card.
	// (Drawn as they come in sight, as in the editor.)
	await blocks.nth(1).scrollIntoViewIfNeeded();
	await expect(blocks.nth(1).locator('.ai-preview svg').first()).toBeVisible();
	await blocks.nth(2).scrollIntoViewIfNeeded();
	await expect(blocks.nth(2).locator('.ai-preview canvas')).toHaveCount(1);
	await expect(blocks.nth(2).getByRole('button', { name: '保存视角到文章' })).toBeHidden();
	await expect(blocks.nth(3).locator('.note-energy')).toHaveCount(1);
	await expect(blocks.nth(4).locator('iframe')).toHaveCount(1);
	await expect(blocks.nth(5).locator('.note-bookmark')).toContainText('例子网页');
	// The 3D molecule dragged in: a block of the article.
	const molecules = await scienceBlock(page, 'XYZ').count();
	await blocks.nth(2).hover();
	await blocks.nth(2).locator('.ai-block-handle').dragTo(editor(page).locator('p', { hasText: '结尾段落' }));
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(molecules + 1);

	// A picture the AI drew, put in where the caret is: copied into the article's img/, shown there.
	await tell(page, '画图');
	const picture = pane(page).locator('.ai-message .ai-block', { has: page.locator('img') });
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await picture.hover();
	await picture.locator('.ai-block-handle').click();
	const shown = editor(page).locator('img[alt="势能曲线"]');
	await expect.poll(() => shown.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth).catch(() => 0)).toBeGreaterThan(0);
	expect(fixtureHas('img/plot.png')).toBe(true);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('](./img/plot.png)');
});

test('said while it works: Claude Code takes it in between; pi, once its turn is over (queued, or said now)', async ({ page }) => {
	await openAi(page);
	await tell(page, '慢慢来');
	await expect(placeholder(page)).toHaveText('插话：它会尽快看到（Enter）');
	await tell(page, '换个方向');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('插话收到：换个方向');
	await expect(pane(page).locator('.ai-user-context', { hasText: '插话' })).toHaveCount(1);

	// pi (here, an adapter that takes nothing in between): what is said waits for its turn to be over.
	await fromModelMenu(page, 'pi', '用 Claude 运行');
	await tell(page, '慢慢来');
	await expect(placeholder(page)).toHaveText('排队：它做完这一轮就发（Enter）');
	await tell(page, '环境');
	const queued = pane(page).locator('.ai-queued');
	await expect(queued.locator('.ai-queued-text')).toHaveText('环境');
	await expect(input(page)).toHaveText('');
	// Said now: what it does stopped, then said.
	await queued.getByRole('button', { name: '立刻发' }).click();
	await expect(pane(page).locator('.ai-stop').last()).toHaveText('已停止');
	await expect(pane(page).locator('.ai-message').last()).toContainText('pi 模型');
	await expect(queued).toHaveCount(0);
});

test('a picture pasted into the input goes with what is said, shown small over it', async ({ page }) => {
	await openAi(page);
	const plot = readFileSync(new URL('./fixtures/plot.png', import.meta.url)).toString('base64');
	await input(page).evaluate((node, data) => {
		const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
		const transfer = new DataTransfer();
		transfer.items.add(new File([bytes], 'plot.png', { type: 'image/png' }));
		node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
	}, plot);
	await expect(pane(page).locator('.ai-picture-chip img')).toBeVisible();
	await tell(page, '看看这张');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('看到 1 张图（image/png）');
	await expect(pane(page).locator('.ai-picture-chip')).toHaveCount(0);
	await expect(pane(page).locator('.ai-user-picture')).toBeVisible();
	await expect.poll(() => pane(page).locator('.ai-user-picture').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('/ lists the commands its agent offers; one is sent as it is, nothing added after it', async ({ page }) => {
	await openAi(page);
	await input(page).fill('/re');
	const menu = pane(page).locator('.ai-command');
	await expect(menu).toHaveText([/^\/review/u]);
	await input(page).press('Enter');
	await expect(input(page)).toHaveText('/review');
	await input(page).pressSequentially('这段');
	await input(page).press('Enter');
	await expect(pane(page).locator('.ai-message').last()).toHaveText('命令 /review 这段');
});

test('a question it asks is a form in the conversation: a choice, answered, said back to it', async ({ page }) => {
	await openAi(page);
	await tell(page, '问我');
	const question = pane(page).locator('.ai-question');
	await expect(question.locator('.ai-question-ask')).toHaveText('用哪个基组？');
	await question.getByRole('button', { name: /def2-TZVP/u }).click();
	await question.getByRole('button', { name: '回答' }).click();
	await expect(pane(page).locator('.ai-message').last()).toHaveText('就用 def2-TZVP');
	await expect(question.locator('.ai-question-answer')).toHaveText('你答：def2-TZVP');
});

test('what the AI said, selected (a formula in it taken whole, as written), quoted in what is said next', async ({ page }) => {
	await openAi(page);
	await tell(page, '公式');
	const answer = pane(page).locator('.ai-message').last();
	await expect(answer.locator('.katex')).toHaveCount(1);
	// From inside the formula to just after it: the formula whole.
	await answer.evaluate((node) => {
		const math = node.querySelector('.ai-math')!;
		const inside = document.createTreeWalker(math, NodeFilter.SHOW_TEXT).nextNode()!;
		const after = math.nextSibling!;
		const range = document.createRange();
		range.setStart(inside, 0);
		range.setEnd(after, 3);
		document.getSelection()!.removeAllRanges();
		document.getSelection()!.addRange(range);
		node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	});
	await page.locator('.ai-quote-button').click();
	const quoted = pane(page).locator('.ai-quote-row .ai-quote');
	await expect(quoted.locator('.katex')).toHaveCount(1);
	await tell(page, '这是什么意思');
	const told = pane(page).locator('.ai-message').last();
	await expect(told).toContainText('> $E = mc^2$ 说明');
	await expect(told).toContainText('这是什么意思');
	await expect(pane(page).locator('.ai-quote-row')).toHaveCount(0);
	await expect(pane(page).locator('.ai-user').last().locator('.ai-user-quote .katex')).toHaveCount(1);
});

test('leave to change a file shows the change, to be read before it is allowed', async ({ page }) => {
	await openAi(page);
	await tell(page, '改文件');
	const asked = pane(page).locator('.ai-permission');
	await expect(asked.locator('.ai-permission-detail .ai-diff-lines span')).toHaveText(['- 旧的一行\n', '+ 新的一行\n']);
	await asked.getByRole('button', { name: '允许', exact: true }).click();
	await expect(pane(page).locator('.ai-message').last()).toHaveText('改好了。');
	await expect(asked.locator('.ai-permission-detail')).toHaveCount(0);
});

test('what was said: copied, or put back to be changed; what failed, said again; what is used of its context, a ring', async ({ page }) => {
	await openAi(page);
	await tell(page, '用量');
	// Under the answer, its actions there without a pointer on it.
	await expect(pane(page).locator('.ai-answer').last().getByRole('button', { name: '插入到文章' })).toBeVisible();
	await pane(page).locator('.ai-user').last().getByRole('button', { name: '改一改再问' }).click();
	await expect(input(page)).toHaveText('用量');
	await input(page).fill('');

	// Nearly full: the ring says so, and clicked, /compact is in the input; sent, a line where it was compacted.
	const ring = pane(page).locator('.ai-usage-ring');
	await expect(ring).toHaveText('85%');
	await expect(ring).toHaveClass(/is-full/u);
	await expect(ring).toHaveAttribute('title', /\$0\.42/u);
	await ring.click();
	await expect(input(page)).toHaveText('/compact');
	await pane(page).locator('.ai-send').click();
	const compacted = pane(page).locator('.ai-compaction');
	await expect(compacted.locator('summary')).toHaveText('上下文已压缩');
	await compacted.locator('summary').click();
	await expect(compacted.locator('.ai-compaction-summary')).toHaveText('之前聊了基组的选择。');
	await expect(ring).toHaveText('10%');

	// Failed: said again with 重试.
	await tell(page, '出错');
	await expect(pane(page).locator('.ai-error').last()).toBeVisible();
	await pane(page).locator('.ai-error').last().getByRole('button', { name: '重试' }).click();
	await expect(pane(page).locator('.ai-message').last()).toHaveText('第 2 次好了');
});

test('scrolled up, away from the end: ↓ back to it, with a dot when something came meanwhile', async ({ page }) => {
	await openAi(page);
	await page.setViewportSize({ width: 1400, height: 600 });
	for (let count = 1; count <= 8; count += 1) {
		await tell(page, '几块');
		await expect(pane(page).locator('.ai-answer')).toHaveCount(count);
		await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '发送');
	}
	const transcript = pane(page).locator('.ai-transcript');
	await transcript.evaluate((node) => node.scrollTo({ top: 0 }));
	const latest = pane(page).locator('.ai-latest');
	await expect(latest).toBeVisible();
	await expect(latest).not.toHaveClass(/is-fresh/u);
	await tell(page, '几块');
	await expect(latest).toHaveClass(/is-fresh/u);
	await latest.click();
	await expect(latest).toBeHidden();
	await expect.poll(() => transcript.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(5);
});

test.describe('copied from what the AI said', () => {
	test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

	test('code by its button; a formula on its own lines by its button, one in a line clicked: as written', async ({ page }) => {
		await openAi(page);
		await tell(page, '代码');
		const answer = pane(page).locator('.ai-message').last();
		const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
		await answer.locator('.ai-code').hover();
		await answer.locator('.ai-code .ai-copy').click();
		await expect.poll(clipboard).toBe('print(1)');
		await answer.locator('.ai-math-block').hover();
		await answer.locator('.ai-math-block .ai-copy').click();
		await expect.poll(clipboard).toBe('$$\nE = mc^2\n$$');
		await answer.locator('.ai-math').click();
		await expect.poll(clipboard).toBe('$a+b$');
	});
});

test('words pasted at length are a chip, sent after what is typed and folded under it', async ({ page }) => {
	await openAi(page);
	const log = Array.from({ length: 20 }, (_, at) => `line ${at + 1}`).join('\n');
	await input(page).evaluate((node, words) => {
		const transfer = new DataTransfer();
		transfer.setData('text/plain', words);
		node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
	}, log);
	await expect(input(page)).toHaveText('');
	await expect(pane(page).locator('.ai-paste-chip')).toHaveText(/已粘贴 20 行/u);
	await tell(page, '上下文 看看日志');
	const told = pane(page).locator('.ai-message').last();
	await expect(told).toContainText('上下文 看看日志');
	await expect(told).toContainText('line 20');
	await expect(pane(page).locator('.ai-paste-chip')).toHaveCount(0);
	await expect(pane(page).locator('.ai-user .ai-paste summary')).toHaveText('已粘贴 20 行');
});

test('a conversation of before, opened, is shown at its end', async ({ page }) => {
	await openAi(page);
	await page.setViewportSize({ width: 1400, height: 600 });
	for (let count = 1; count <= 8; count += 1) {
		await tell(page, '代码');
		await expect(pane(page).locator('.ai-message')).toHaveCount(count);
		await expect(pane(page).locator('.ai-send')).toHaveAttribute('aria-label', '发送');
	}
	await pane(page).getByRole('button', { name: '新对话' }).click();
	await expect(pane(page).locator('.ai-empty')).toBeVisible();
	await pane(page).getByRole('button', { name: '对话记录' }).click();
	await page.getByRole('menuitem', { name: /代码/u }).first().click();
	await expect(pane(page).locator('.ai-message')).toHaveCount(8);
	const transcript = pane(page).locator('.ai-transcript');
	await expect.poll(() => transcript.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(5);
	await expect.poll(() => transcript.evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
});

test('the input is written as articles are: a formula typed is drawn there, and said as written', async ({ page }) => {
	await openAi(page);
	await input(page).click();
	await input(page).pressSequentially('上下文 质能 $E=mc^2$ 是什么');
	await expect(pane(page).locator('.ai-input .katex')).toHaveCount(1);
	await expect(placeholder(page)).toHaveCount(0);
	await input(page).press('Enter');
	const told = pane(page).locator('.ai-message').last();
	await expect(told).toContainText('上下文 质能 $E=mc^2$ 是什么');
	await expect(input(page)).toHaveText('');
	await expect(placeholder(page)).toBeVisible();
});
