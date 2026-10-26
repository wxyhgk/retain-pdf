import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, writeFixtureFile } from './studio.ts';

// 识别: a picture read by the large model of AI 设置 (here a service of the test's own, speaking OpenAI's API),
// what is read put under the picture as a change to accept or not.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));

test.beforeEach(() => resetFixture());

type Asked = { url: string; authorization: string; body: { model: string; messages: Array<{ role: string; content: unknown }> } };

/** A model service of the test's own: answers every question with `answer` (and `status`), keeping what it was asked. */
async function fakeModel(answer: string, status = 200) {
	const asked: Asked[] = [];
	const server = createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			asked.push({ url: request.url ?? '', authorization: String(request.headers.authorization), body: JSON.parse(body) });
			response.statusCode = status;
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify(status === 200 ? { choices: [{ message: { content: answer } }] } : { error: { message: answer } }));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { url: `http://127.0.0.1:${port}/v1`, asked, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** AI 设置 as the author would make them, saved straight to the Studio (no dialog). */
const setAi = (page: Page, settings: Record<string, string>) =>
	page.evaluate((body) => fetch('/api/studio/ai/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), settings);

/** The picture's 「识别…」, and the kind of reading `label`. */
async function recognize(page: Page, label: string): Promise<void> {
	const figure = editor(page).locator('figure.pm-figure').last();
	await figure.scrollIntoViewIfNeeded();
	await figure.hover();
	const handle = page.locator('.milkdown-block-handle .operation-item').last();
	await expect(handle).toBeVisible();
	await handle.click();
	await page.locator('.milkdown-block-menu [data-key="recognize"]').click();
	await page.getByRole('menu').getByRole('menuitem', { name: label }).click();
}

test.afterEach(async ({ page }) => {
	// Nothing ready for the next test: a test of its own sets what it needs.
	await setAi(page, { provider: 'openai', model: '', baseUrl: '', apiKey: '', workspaceId: '' });
});

test('a picture read as a formula: AI 设置 asked for first, the formula comes under the picture, to accept', async ({ page }) => {
	const model = await fakeModel('```latex\nE = mc^2\n```');
	writeFixtureFile('img/eq.png', PLOT);
	appendToFixture('\n![质能方程](./img/eq.png)\n\n图后面的段落。\n');
	await openStudio(page);
	await setAi(page, { provider: 'openai', model: '', baseUrl: '', apiKey: '' });

	await recognize(page, '公式 → LaTeX');
	// No model set: the settings come first, saying why.
	const dialog = page.locator('#ai-settings-dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('#ai-settings-reason')).toContainText('识别图片要用大模型');
	await dialog.locator('#ai-provider').selectOption('anthropic');
	await expect(dialog.locator('#ai-workspace')).toBeVisible();
	await dialog.locator('#ai-provider').selectOption('openai');
	// A workspace is Claude's alone.
	await expect(dialog.locator('#ai-workspace')).toBeHidden();
	await dialog.locator('#ai-model').fill('fake-vl');
	await dialog.locator('#ai-base-url').fill(model.url);
	await dialog.locator('#ai-key').fill('sk-test');
	await dialog.locator('#ai-key').press('Enter');
	await expect(dialog).toBeHidden();

	// Read, and put under the picture as a change from outside: to accept or not.
	await expect(page.locator('#review-bar')).toBeVisible();
	await page.locator('#review-bar').getByRole('button', { name: '全部接受' }).click();
	await expect(editor(page).locator('.pm-display-math-formula .katex').last()).toBeVisible();
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain('![质能方程](./img/eq.png)\n\n$$\nE = mc^2\n$$\n\n图后面的段落。');

	// The service was asked for the formula, with the picture, the model and the key set.
	expect(model.asked).toHaveLength(1);
	const [{ url, authorization, body }] = model.asked;
	expect(url).toBe('/v1/chat/completions');
	expect(authorization).toBe('Bearer sk-test');
	expect(body.model).toBe('fake-vl');
	const question = JSON.stringify(body.messages);
	expect(question).toContain('data:image/png;base64,');
	expect(question).toContain('LaTeX');

	// The key is not given back to the page; that there is one is.
	const shown = await page.evaluate(() => fetch('/api/studio/ai/settings').then((response) => response.json()));
	expect(shown).toMatchObject({ provider: 'openai', model: 'fake-vl', hasKey: true, keySaved: true });
	expect(JSON.stringify(shown)).not.toContain('sk-test');
	await model.close();
});

test('the service failing is said, and the article stays as it was', async ({ page }) => {
	const model = await fakeModel('invalid api key', 401);
	writeFixtureFile('img/eq.png', PLOT);
	appendToFixture('\n![质能方程](./img/eq.png)\n');
	await openStudio(page);
	await setAi(page, { provider: 'openai', model: 'fake-vl', baseUrl: model.url, apiKey: 'wrong' });

	await recognize(page, '表格 → Markdown 表格');
	await expect(page.locator('.studio-toast')).toContainText('没能识别：key 不对或没有权限（401）：invalid api key');
	await expect(page.locator('#review-bar')).toBeHidden();
	expect(savedMarkdown()).not.toContain('|');
	await model.close();
});
