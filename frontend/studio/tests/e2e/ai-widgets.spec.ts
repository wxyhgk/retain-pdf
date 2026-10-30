import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture } from './studio.ts';

// Widgets in a conversation, as ChatGPT's and Claude's apps: one being written waits for its whole page; done, it may
// ask the AI (a button in it clicked: said in the conversation) and tell it what it is at (note.tell: told with what
// is said next); shown large, it goes on from where it was. In an article, what it asks is put in the AI's input.

const pane = (page: Page) => page.locator('#side-ai');
const input = (page: Page) => pane(page).locator('.ai-input .ProseMirror');

async function openAi(page: Page): Promise<void> {
	await openStudio(page);
	await page.locator('#side-tab-ai').click();
	await expect(pane(page).locator('.ai-effort')).toBeVisible();
}

async function tell(page: Page, text: string): Promise<void> {
	await input(page).fill(text);
	await input(page).press('Enter');
}

test.beforeEach(() => resetFixture());

test('a widget in an answer: kept a place while written; then it asks the AI, tells it its values, and is shown large', async ({ page }) => {
	await openAi(page);
	await tell(page, '小模块');
	const answer = pane(page).locator('.ai-answer').last();
	// Being written: its place, no frame run from half of it.
	await expect(answer.locator('.ai-preview-pending')).toHaveText('正在写交互模块…');
	await expect(answer.locator('iframe')).toHaveCount(0);
	// Whole: its frame, its title under it (the fence's options kept).
	const figure = pane(page).locator('figure.note-widget').first();
	await expect(figure.locator('figcaption')).toHaveText('参数');
	await expect(answer.locator('.ai-preview-pending')).toHaveCount(0);
	const widget = page.frameLocator('#side-ai figure.note-widget iframe.note-widget-frame >> nth=0');
	await expect(widget.locator('#shown')).toHaveText('能问 a=3');

	// Not on its own: asked as it loads, no click, nothing is said.
	await expect(widget.locator('#self')).toHaveText('自己问不了');

	// Its value changed (told), then its button: said in the conversation, the value told with it.
	await widget.locator('#a').fill('7');
	await expect(widget.locator('#shown')).toHaveText('能问 a=7');
	await widget.locator('#go').click();
	await expect(pane(page).locator('.ai-user')).toHaveCount(2);
	const user = pane(page).locator('.ai-user').last();
	await expect(user.locator('.ai-bubble')).toHaveText('上下文：用 a=7 重算');
	await expect(user.locator('.ai-user-context')).toContainText('交互模块：参数');
	const echo = pane(page).locator('.ai-answer').last();
	await expect(echo).toContainText('用 a=7 重算');
	await expect(echo).toContainText('「参数」：{"a":7}');

	// Told once: what is said next, without it.
	await tell(page, '上下文 再来');
	await expect(pane(page).locator('.ai-answer').last()).toContainText('上下文 再来');
	await expect(pane(page).locator('.ai-answer').last()).not.toContainText('「参数」');

	// Shown large: as it was left; changed there, the one in the answer goes on from there.
	await figure.hover();
	await figure.locator('.note-widget-expand').click();
	const dialog = page.locator('dialog.note-widget-dialog[open]');
	await expect(dialog).toContainText('参数');
	const large = page.frameLocator('dialog.note-widget-dialog iframe.note-widget-frame');
	await expect(large.locator('#shown')).toHaveText('能问 a=7');
	const box = (await dialog.locator('iframe').boundingBox())!;
	expect(box.height).toBeGreaterThan(300);
	await large.locator('#a').fill('9');
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(widget.locator('#shown')).toHaveText('能问 a=9');
});

test('a widget in an article asks the AI: what it asks is put in the AI’s input, for the author to send', async ({ page }) => {
	appendToFixture('\n\n```widget title="问 AI"\n<button id="ask">问</button>\n<script>document.querySelector("#ask").onclick = () => note.ask("解释一下这条曲线");</script>\n```\n');
	await openStudio(page);
	// Started as it comes near the screen.
	await editor(page).locator('figure.note-widget').last().scrollIntoViewIfNeeded();
	const widget = page.frameLocator('#crepe-editor iframe.note-widget-frame >> nth=-1');
	await widget.locator('#ask').click();
	await expect(input(page)).toHaveText('解释一下这条曲线');
	await expect(editor(page)).toBeVisible();
});
