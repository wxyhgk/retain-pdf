import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus } from './studio.ts';

// A conversation kept as a page (chats/), opened in the editor (问答为主): what was asked a bubble, what the AI
// answered the page's own blocks, to edit as any page; the turn going on and the input under them. The AI is a
// stand-in (fake-agents/fake-acp.mjs).

const composer = (page: import('@playwright/test').Page) => page.locator('#chat-composer');
const chats = () => `${process.env.STUDIO_BLOG_DIR}-chats`;

test.beforeEach(() => resetFixture());

test('a conversation as a page: begun from AI 问答, each turn written on it as blocks; edited as a page, the next turn added after; there again once reloaded; deleted', async ({ page }) => {
	await openStudio(page);
	await expect(composer(page)).toBeHidden();
	await expect(page.locator('#chat-list')).toBeHidden();
	// AI 问答: the latest conversation (a new one when there is none), the list of them in place of the pages.
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(composer(page)).toBeVisible();
	await expect(page.locator('#article-list')).toBeHidden();
	await expect(page.locator('#chat-list')).toBeVisible();
	// ＋: a new one, to be spoken to.
	const before = await page.locator('#chat-list .chat-row').count();
	await page.getByRole('button', { name: '新对话页' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('新对话');
	await expect(page.locator('#chat-list .chat-row')).toHaveCount(before + 1);
	await expect(composer(page).locator('.ai-input')).toBeFocused();
	const id = new URL(page.url()).searchParams.get('article')!;
	expect(id).toMatch(/^chat-\d{8}-\d{6}/u);
	await expect(page.locator('#chat-list .chat-row.active')).toHaveText(/新对话/u);
	// No article's properties on it.
	await expect(page.locator('.page-properties')).toBeHidden();

	await composer(page).locator('.ai-input').fill('几块');
	await composer(page).locator('.ai-input').press('Enter');
	// Once over, on the page: the question a bubble, the answer its blocks; gone from under it.
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText('几块');
	await expect(editor(page).locator('.pm-display-math')).toHaveCount(1);
	await expect(editor(page).locator('li', { hasText: '要点二' })).toHaveCount(1);
	await expect(composer(page).locator('.ai-items > *')).toHaveCount(0);
	// Titled as the conversation is, no longer 新对话.
	await expect(page.locator('#article-title-input')).toHaveValue('几块');
	await expect(page.locator('#chat-list .chat-row.active .chat-row-title')).toHaveText('几块');
	await expect(page.locator('#review-bar')).toBeHidden();
	const file = join(chats(), id, 'index.md');
	expect(readFileSync(file, 'utf8')).toContain('```ask\n几块\n```');

	// Edited as any page; the next turn comes after, the edit kept.
	await editor(page).locator('li', { hasText: '要点一' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('（我补的）');
	await composer(page).locator('.ai-input').fill('接上了吗');
	await composer(page).locator('.ai-input').press('Enter');
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText(['几块', '接上了吗']);
	await expect(editor(page)).toContainText('要点一（我补的）');
	await expect(page.locator('#review-bar')).toBeHidden();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	const saved = readFileSync(file, 'utf8');
	expect(saved).toContain('要点一（我补的）');
	expect(saved.indexOf('```ask\n接上了吗\n```')).toBeGreaterThan(saved.indexOf('要点一（我补的）'));

	// Opened again: the page, its input, the list of conversations.
	await page.reload();
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText(['几块', '接上了吗']);
	await expect(composer(page)).toBeVisible();
	await expect(page.getByRole('tab', { name: 'AI 问答' })).toHaveAttribute('aria-selected', 'true');

	// 页面: back to the article; AI 问答 again, to the conversation spoken in last.
	await page.getByRole('tab', { name: '页面' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('Studio 测试夹具');
	await expect(composer(page)).toBeHidden();
	await expect(page.locator('#article-list')).toBeVisible();
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText(['几块', '接上了吗']);
	// Another opened from the list, and this one again.
	const others = page.locator('#chat-list .chat-row:not(.active)');
	if (await others.count()) {
		await others.first().click();
		await expect(page.locator('#chat-list .chat-row.active')).not.toHaveAttribute('data-chat', id);
	}
	await page.locator(`#chat-list [data-chat="${id}"]`).click();
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText(['几块', '接上了吗']);

	// Deleted from 对话: an article opened instead, its folder gone.
	page.once('dialog', (dialog) => void dialog.accept());
	await page.locator('#chat-list .chat-row.active').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '删除这个对话' }).click();
	await expect(composer(page)).toBeHidden();
	await expect(page.locator(`#chat-list [data-chat="${id}"]`)).toHaveCount(0);
	expect(existsSync(join(chats(), id))).toBe(false);
});

test('⤢ in the AI tab: the conversation there opened as a page, what was said on it', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	const side = page.locator('#side-ai');
	await side.locator('.ai-input').fill('几块 侧边');
	await side.locator('.ai-input').press('Enter');
	await expect(side.locator('.ai-message .ai-block')).toHaveCount(3);
	await side.getByRole('button', { name: '在页面中打开' }).click();
	await expect(composer(page)).toBeVisible();
	await expect(editor(page).locator('.note-ask-bubble')).toHaveText('几块 侧边');
	await expect(page.getByRole('tab', { name: 'AI 问答' })).toHaveAttribute('aria-selected', 'true');
});
