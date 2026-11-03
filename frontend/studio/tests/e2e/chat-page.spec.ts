import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { editFixture, editor, openStudio, resetFixture } from './studio.ts';

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
	await side.getByRole('button', { name: '显示方式' }).click();
	await page.getByRole('menuitem', { name: /^全屏/u }).click();
	await expect(view(page)).toBeVisible();
	await expect(view(page).locator('.ai-user .ai-bubble')).toHaveText('几块 侧边');
	await expect(view(page).locator('.ai-message .ai-block')).toHaveCount(4);
	await expect(page.getByRole('tab', { name: 'AI 问答' })).toHaveAttribute('aria-selected', 'true');
	// The very panel of the AI tab, moved: the tab away meanwhile.
	await expect(view(page).locator('#side-ai')).toHaveCount(1);
	await expect(page.locator('#side-tab-ai')).toBeHidden();
	await say(page, '接着说');
	await expect(side.locator('.ai-message').last()).toHaveText('结论是这样的。');
	// 显示方式 › 侧栏: back in the side, as it was; the article in the middle.
	await side.getByRole('button', { name: '显示方式' }).click();
	await expect(page.getByRole('menuitem', { name: /^全屏/u })).toContainText('✓');
	await page.getByRole('menuitem', { name: /^侧栏/u }).click();
	await expect(view(page)).toBeHidden();
	await expect(page.locator('#side-panel #side-ai')).toBeVisible();
	await expect(page.locator('#side-tab-ai')).toHaveAttribute('aria-selected', 'true');
	await expect(side.locator('.ai-message').last()).toHaveText('结论是这样的。');
	await expect(page.locator('#article-title-input')).toHaveValue('Studio 测试夹具');
});

test('a conversation is renamed from its menu (its page’s title too), and dragged into place; kept so once reloaded', async ({ page }) => {
	await openStudio(page);
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(view(page)).toBeVisible();
	const shown = () => new URL(page.url()).searchParams.get('chat');
	await expect.poll(shown).toMatch(/^chat-/u);
	await say(page, '几块 甲问题');
	const row = (title: string) => page.locator('#chat-list .chat-row', { hasText: title });
	await expect(row('甲问题')).toHaveCount(1);
	const first = await row('甲问题').getAttribute('data-chat');
	const file = join(chats(), first!, 'index.md');
	await expect.poll(() => existsSync(file)).toBe(true);
	await page.getByRole('button', { name: '新建对话' }).click();
	await expect.poll(shown).not.toBe(first);
	await page.waitForTimeout(300);
	await say(page, '代码 乙问题');
	await expect(row('乙问题')).toHaveCount(1);
	const titles = () => page.locator('#chat-list .chat-row .chat-row-title').allTextContents();
	const place = async (title: string) => (await titles()).findIndex((shown) => shown.includes(title));
	expect(await place('乙问题')).toBeLessThan(await place('甲问题'));

	// Renamed: listed so, its page titled so; the AI's own title no longer put over it.
	page.once('dialog', (dialog) => void dialog.accept('第一个对话'));
	await row('甲问题').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '重命名' }).click();
	await expect(row('第一个对话')).toHaveCount(1);
	await expect.poll(() => (existsSync(file) ? readFileSync(file, 'utf8') : '')).toContain('title: "第一个对话"');

	// Dragged above 乙问题, and so once read again.
	await row('第一个对话').dragTo(row('乙问题'), { targetPosition: { x: 20, y: 4 } });
	await expect.poll(async () => (await place('第一个对话')) < (await place('乙问题'))).toBe(true);
	await page.reload();
	await page.getByRole('tab', { name: 'AI 问答' }).click();
	await expect(row('第一个对话')).toHaveCount(1);
	expect(await place('第一个对话')).toBeLessThan(await place('乙问题'));
});

test('显示方式 › 悬浮: the AI panel floats over the Studio, moved by its bar, sized from an edge, kept so after a reload; back in the side', async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('float-test')) {
			sessionStorage.setItem('float-test', '1');
			localStorage.removeItem('studio.ai.mode');
			localStorage.removeItem('studio.ai.float');
		}
	});
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	const side = page.locator('#side-ai');
	await side.getByRole('button', { name: '显示方式' }).click();
	await expect(page.getByRole('menuitem', { name: /^侧栏/u })).toContainText('✓');
	await page.getByRole('menuitem', { name: /^悬浮/u }).click();

	// The very panel, floating; its tab lent away; it works as it did.
	const box = page.locator('#ai-float');
	await expect(box).toBeVisible();
	await expect(box.locator('#side-ai')).toBeVisible();
	await expect(page.locator('#side-tab-ai')).toBeHidden();
	await box.locator('.ai-input .ProseMirror').fill('几块 悬浮');
	await box.locator('.ai-input .ProseMirror').press('Enter');
	await expect(box.locator('.ai-message .ai-block')).toHaveCount(4);

	// Moved by its bar; sized from its left edge.
	const before = (await box.boundingBox())!;
	const bar = (await box.locator('.ai-toolbar .ai-title').boundingBox())!;
	await page.mouse.move(bar.x + 10, bar.y + bar.height / 2);
	await page.mouse.down();
	await page.mouse.move(bar.x - 190, bar.y - 90, { steps: 5 });
	await page.mouse.up();
	const moved = (await box.boundingBox())!;
	expect(Math.abs(moved.x - before.x + 200)).toBeLessThan(2);
	expect(Math.abs(moved.y - before.y + 100)).toBeLessThan(2);
	const grip = (await box.locator('.ai-float-grip[data-edge="w"]').boundingBox())!;
	await page.mouse.move(grip.x + 3, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(grip.x - 57, grip.y + grip.height / 2, { steps: 4 });
	await page.mouse.up();
	const sized = (await box.boundingBox())!;
	expect(Math.abs(sized.width - moved.width - 60)).toBeLessThan(2);

	// Kept: floating, where it was, after a reload.
	await page.reload();
	await expect(page.locator('#ai-float')).toBeVisible();
	expect(Math.abs((await page.locator('#ai-float').boundingBox())!.x - sized.x)).toBeLessThan(2);
	// 全屏 and back: floating again; 侧栏: in the side.
	await page.locator('#ai-float').getByRole('button', { name: '显示方式' }).click();
	await expect(page.getByRole('menuitem', { name: /^悬浮/u })).toContainText('✓');
	await page.getByRole('menuitem', { name: /^全屏/u }).click();
	await expect(view(page)).toBeVisible();
	await expect(page.locator('#ai-float')).toBeHidden();
	await page.locator('#sidebar-pages').click();
	await expect(page.locator('#ai-float')).toBeVisible();
	await page.locator('#ai-float').getByRole('button', { name: '显示方式' }).click();
	await page.getByRole('menuitem', { name: /^侧栏/u }).click();
	await expect(page.locator('#ai-float')).toBeHidden();
	await expect(page.locator('#side-panel #side-ai')).toBeVisible();
	await expect(page.locator('#side-tab-ai')).toHaveAttribute('aria-selected', 'true');
});

test('显示方式 › 新窗口: the AI in a window of its own, told of the article open, answering there; back here once it shuts', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	const side = page.locator('#side-ai');
	await side.locator('.ai-input .ProseMirror').fill('几块 侧边');
	await side.locator('.ai-input .ProseMirror').press('Enter');
	await expect(side.locator('.ai-message .ai-block')).toHaveCount(4);

	const popup = page.waitForEvent('popup');
	await side.getByRole('button', { name: '显示方式' }).click();
	await page.getByRole('menuitem', { name: /^新窗口/u }).click();
	const own = await popup;
	expect(new URL(own.url()).pathname).toBe('/studio/window');
	// Gone from the Studio meanwhile; the same conversation there, told of the article open here.
	await expect(page.locator('#side-tab-ai')).toBeHidden();
	await expect(side).toBeHidden();
	const there = own.locator('.ai-pane');
	await expect(there.locator('.ai-user .ai-bubble')).toHaveText('几块 侧边');
	await expect(there.locator('.ai-context')).toContainText('Studio 测试夹具');
	await there.locator('.ai-input .ProseMirror').fill('接着说');
	await there.locator('.ai-input .ProseMirror').press('Enter');
	await expect(there.locator('.ai-message').last()).toHaveText('结论是这样的。');

	// Shut: back in the side, the conversation as it went on.
	await own.close();
	await expect(page.locator('#side-tab-ai')).toBeVisible();
	await page.locator('#side-tab-ai').click();
	await expect(side.locator('.ai-message').last()).toHaveText('结论是这样的。');
});

test('the AI in a window of its own at work on the article open: its changes held in the Studio, looked over once its turn is over; 显示方式 there puts it back', async ({ page }) => {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	const popup = page.waitForEvent('popup');
	await page.locator('#side-ai').getByRole('button', { name: '显示方式' }).click();
	await page.getByRole('menuitem', { name: /^新窗口/u }).click();
	const own = await popup;
	const there = own.locator('.ai-pane');
	await expect(there.locator('.ai-context')).toContainText('Studio 测试夹具');
	await there.locator('.ai-input .ProseMirror').fill('慢慢来');
	await there.locator('.ai-input .ProseMirror').press('Enter');
	await expect(there.locator('.ai-work.is-going')).toBeVisible();
	// What it changes meanwhile: held in the Studio, as for the AI shown there.
	editFixture((markdown) => markdown.replace('结尾段落。', '结尾段落，AI 改的。'));
	await expect(page.locator('.studio-toast')).toContainText('AI 在改这一页，做完后一起给你过目');
	editFixture((markdown) => markdown.replace('开头段落', '开头段落（AI 又改了）'));
	await page.waitForTimeout(1500);
	await expect(page.locator('#review-bar')).toBeHidden();
	// Its turn over (stopped there): the changes, together.
	await there.locator('.ai-send').click();
	await expect(page.locator('#review-count')).toHaveText('磁盘上的页面有 2 处改动');
	await expect(editor(page)).toContainText('AI 又改了');

	// 显示方式 there › 悬浮: back in the Studio floating, its window shut.
	const shut = own.waitForEvent('close');
	await there.getByRole('button', { name: '显示方式' }).click();
	await own.getByRole('menuitem', { name: /^悬浮/u }).click();
	await shut;
	await expect(page.locator('#ai-float #side-ai')).toBeVisible();
	await page.locator('#ai-float').getByRole('button', { name: '显示方式' }).click();
	await page.getByRole('menuitem', { name: /^侧栏/u }).click();
	await expect(page.locator('#side-panel #side-ai')).toBeVisible();
});
