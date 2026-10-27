import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { openStudio, resetFixture } from './studio.ts';

// AI 问答, as Notion's: the AI tab's panel itself, moved whole into the middle; the left column lists the conversations
// (chats/) in place of the pages. The AI is a stand-in (fake-agents/fake-acp.mjs).

const view = (page: Page) => page.locator('#chat-view');
const input = (page: Page) => view(page).locator('.ai-input .ProseMirror');
const chats = () => `${process.env.STUDIO_BLOG_DIR}-chats`;

async function say(page: Page, text: string): Promise<void> {
	await input(page).fill(text);
	await input(page).press('Enter');
}

test.beforeEach(() => resetFixture());

test('AI 问答: a conversation whole in the middle, listed on the left; there again once reloaded; 页面 back to the article; deleted', async ({ page }) => {
	await openStudio(page);
	await expect(view(page)).toBeHidden();
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(view(page)).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	await expect(page.locator('#article-list')).toBeHidden();
	await expect(page.locator('#chat-list')).toBeVisible();

	// The latest conversation, or a new one: in the address once there.
	const shown = () => new URL(page.url()).searchParams.get('chat');
	await expect.poll(shown).toMatch(/^chat-\d{8}-\d{6}/u);
	const first = shown();
	// ＋: a new one, in the address once begun; not listed until something is said in it (no empty 新对话 left).
	const before = await page.locator('#chat-list .chat-row').count();
	await page.getByRole('button', { name: '新建对话' }).click();
	await expect.poll(shown).not.toBe(first);
	const unused = shown()!;
	// ＋ again, nothing said in that one: it is let go, the list as it was.
	await page.getByRole('button', { name: '新建对话' }).click();
	await expect.poll(shown).not.toBe(unused);
	await page.waitForTimeout(500);
	await expect(page.locator('#chat-list .chat-row')).toHaveCount(before);
	const id = shown()!;

	// Drawn as the AI tab draws it: what was asked, the answer's blocks, a plugin's block as the editor draws it.
	await say(page, '几块');
	// Listed once spoken to.
	await expect(page.locator('#chat-list .chat-row')).toHaveCount(before + 1);
	await expect(page.locator('#chat-list .chat-row.active')).toHaveAttribute('data-chat', id);
	await expect(view(page).locator('.ai-user .ai-bubble')).toHaveText('几块');
	await expect(view(page).locator('.ai-message .ai-block')).toHaveCount(4);
	await say(page, '能量图');
	await expect(view(page).locator('.ai-preview .note-energy')).toHaveCount(1);
	// Kept: its record read as a page.
	const file = join(chats(), id, 'index.md');
	await expect.poll(() => (existsSync(file) ? readFileSync(file, 'utf8') : '')).toContain('```ask\n能量图\n```');
	await expect(page.locator('#chat-list .chat-row.active .chat-row-title')).toHaveText('几块');

	// Reloaded: the same conversation, as it was.
	await page.reload();
	await expect(view(page)).toBeVisible();
	await expect(view(page).locator('.ai-user .ai-bubble')).toHaveText(['几块', '能量图']);
	await expect(page.getByRole('tab', { name: 'AI 问答' })).toHaveAttribute('aria-selected', 'true');

	// 页面: the article, its list; AI 问答 again: this conversation.
	await page.getByRole('tab', { name: '页面' }).click();
	await expect(view(page)).toBeHidden();
	await expect(page.locator('#article-title-input')).toHaveValue('Studio 测试夹具');
	await expect(page.locator('#article-list')).toBeVisible();
	expect(new URL(page.url()).searchParams.get('chat')).toBeNull();
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(view(page).locator('.ai-user .ai-bubble')).toHaveText(['几块', '能量图']);

	// Deleted from the list: another shown, its folder gone.
	page.once('dialog', (dialog) => void dialog.accept());
	await page.locator(`#chat-list [data-chat="${id}"]`).click({ button: 'right' });
	await page.getByRole('menuitem', { name: '删除这个对话' }).click();
	await expect(page.locator(`#chat-list [data-chat="${id}"]`)).toHaveCount(0);
	await expect(view(page).locator('.ai-user .ai-bubble', { hasText: '能量图' })).toHaveCount(0);
	expect(existsSync(join(chats(), id))).toBe(false);
});

test('⤢ in the AI tab: the panel itself whole, in the middle; ⤡ back in the side, as it was', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	const side = page.locator('#side-ai');
	await side.locator('.ai-input .ProseMirror').fill('几块 侧边');
	await side.locator('.ai-input .ProseMirror').press('Enter');
	await expect(side.locator('.ai-message .ai-block')).toHaveCount(4);
	await side.getByRole('button', { name: '在页面中打开' }).click();
	await expect(view(page)).toBeVisible();
	await expect(view(page).locator('.ai-user .ai-bubble')).toHaveText('几块 侧边');
	await expect(view(page).locator('.ai-message .ai-block')).toHaveCount(4);
	await expect(page.getByRole('tab', { name: 'AI 问答' })).toHaveAttribute('aria-selected', 'true');
	// The very panel of the AI tab, moved: the tab away meanwhile.
	await expect(view(page).locator('#side-ai')).toHaveCount(1);
	await expect(page.locator('#side-tab-ai')).toBeHidden();
	await say(page, '接着说');
	await expect(side.locator('.ai-message').last()).toHaveText('结论是这样的。');
	// ⤡: back in the side, as it was; the article in the middle.
	await side.getByRole('button', { name: '收回到右边' }).click();
	await expect(view(page)).toBeHidden();
	await expect(page.locator('#side-panel #side-ai')).toBeVisible();
	await expect(page.locator('#side-tab-ai')).toHaveAttribute('aria-selected', 'true');
	await expect(side.locator('.ai-message').last()).toHaveText('结论是这样的。');
	await expect(page.locator('#article-title-input')).toHaveValue('Studio 测试夹具');
});
