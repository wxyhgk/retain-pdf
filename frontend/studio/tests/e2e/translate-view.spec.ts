import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { editor, openSettings, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// 翻译 (the left column): RetainPDF's own pages in the middle, at the address in 设置 › RetainPDF. Here a stand-in for
// RetainPDF answers on a port of its own: every page of it is 图书馆, speaking studio-bridge.v1 as RetainPDF's does
// (hello → ready; theme, navigate shown on the page; 摘 sends a quote).

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');
const savedUrl = () => {
	try {
		return JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfUrl;
	} catch {
		return undefined;
	}
};

const STAND_IN = `<!doctype html><meta charset="utf-8"><title>RetainPDF</title>
<h1 id="library">图书馆</h1>
<p>embed <span id="embed"></span> · theme <span id="theme"></span> · navigated <span id="navigated"></span></p>
<button id="quote" type="button">摘</button>
<script>
const head = { protocol: 'retainpdf-studio-bridge', v: 1 };
let host = '';
document.querySelector('#embed').textContent = new URLSearchParams(location.search).get('embed') || '';
addEventListener('message', (event) => {
	const message = event.data;
	if (event.source !== parent || !message || message.protocol !== head.protocol || message.v !== 1) return;
	if (message.type === 'hello') {
		host = event.origin;
		document.querySelector('#theme').textContent = message.theme;
		parent.postMessage({ ...head, type: 'ready', features: ['theme', 'navigate', 'quote'] }, host);
	} else if (message.type === 'theme') {
		document.querySelector('#theme').textContent = message.theme;
	} else if (message.type === 'navigate') {
		const { protocol, v, type, ...target } = message;
		document.querySelector('#navigated').textContent = JSON.stringify(target);
	}
});
document.querySelector('#quote').addEventListener('click', () => parent.postMessage({
	...head, type: 'quote', job_id: 'job-1', document_id: 'doc-1', title: 'Quantum Chemistry', item_id: 'p012-b0003', page_idx: 11,
	source_text: 'The variation principle.', translated_text: '变分原理。',
}, host));
</script>`;

let retainpdf: Server;
let retainpdfUrl = '';

test.beforeAll(async () => {
	retainpdf = createServer((_request, response) => {
		response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		response.end(STAND_IN);
	});
	await new Promise<void>((resolve) => retainpdf.listen(0, '127.0.0.1', resolve));
	retainpdfUrl = `http://127.0.0.1:${(retainpdf.address() as AddressInfo).port}/`;
});
test.afterAll(() => new Promise<void>((resolve) => retainpdf.close(() => resolve())));
// The settings outlive a test: each starts at the default address.
test.beforeEach(() => {
	resetFixture();
	let settings: Record<string, unknown>;
	try {
		settings = JSON.parse(readFileSync(settingsFile(), 'utf8'));
	} catch {
		return;
	}
	delete settings.retainpdfUrl;
	writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
});

async function setAddress(page: Page, url: string): Promise<void> {
	const status = await page.evaluate(
		async (address) => (await fetch('/api/studio/settings/retainpdf', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: address }) })).status,
		url,
	);
	expect(status).toBe(200);
}

const inFrame = (page: Page) => page.frameLocator('#retainpdf-frame');

test('翻译 shows RetainPDF in the middle, kept as it was while another view is shown, and again from the address', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	const frame = page.locator('#retainpdf-frame');
	// Nothing loaded before it is first shown.
	await expect(frame).toHaveCount(1);
	expect(await frame.getAttribute('src')).toBeNull();

	await page.locator('#open-translate').click();
	await expect(page.locator('#open-translate')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(page.locator('.editor-panel')).toBeHidden();
	// Told it is in the Studio, and how it looks.
	await expect(frame).toHaveAttribute('src', `${retainpdfUrl}?embed=studio`);
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
	await expect(inFrame(page).locator('#embed')).toHaveText('studio');
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);
	expect(new URL(page.url()).searchParams.has('translate')).toBe(true);

	// Pressed again: the article, the frame left loaded behind it.
	await page.locator('#open-translate').click();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('.editor-panel')).toBeVisible();
	expect(new URL(page.url()).searchParams.has('translate')).toBe(false);
	await expect(frame).toHaveAttribute('src', `${retainpdfUrl}?embed=studio`);

	// The address with ?translate opens it.
	await page.goto(`${new URL(page.url()).pathname}?translate`);
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
});

test('摘到笔记 in RetainPDF puts the passage in the note; its card opens RetainPDF there again', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	// The caret at the end of the note: where the passage goes.
	await editor(page).locator('p').last().click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);

	// The Studio's light or dark followed.
	const other = (await inFrame(page).locator('#theme').textContent()) === 'dark' ? 'light' : 'dark';
	await page.evaluate((theme) => {
		document.documentElement.dataset.theme = theme;
		window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
	}, other);
	await expect(inFrame(page).locator('#theme')).toHaveText(other);

	await inFrame(page).locator('#quote').click();
	await expect(page.locator('.studio-toast')).toContainText('已摘到');
	await page.locator('#open-translate').click();
	const card = editor(page).locator('.retainpdf-quote');
	await expect(card).toHaveCount(1);
	await expect(card.locator('.retainpdf-quote-where')).toHaveText('Quantum Chemistry · 第 12 页');
	await expect(card.locator('.retainpdf-quote-source')).toHaveText('The variation principle.');
	await expect(card.locator('.retainpdf-quote-translated')).toHaveText('变分原理。');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('```retainpdf\nbook: Quantum Chemistry\ndocument: doc-1\njob: job-1\nblock: p012-b0003\npage: 12\n---\nThe variation principle.\n---\n变分原理。\n```\n');

	// Its card: 翻译 again, at that passage.
	await card.locator('.retainpdf-quote-open').click();
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(inFrame(page).locator('#navigated')).toHaveText(JSON.stringify({ job_id: 'job-1', block_id: 'p012-b0003', page_idx: 11 }));
});

test('a quote not from RetainPDF\'s frame is not taken', async ({ page }) => {
	await openStudio(page);
	await setAddress(page, retainpdfUrl);
	await page.locator('#open-translate').click();
	await expect(inFrame(page).locator('#theme')).toHaveText(/^(light|dark)$/u);
	// The Studio's own page saying it, as any page of it could.
	await page.evaluate(() =>
		window.postMessage({ protocol: 'retainpdf-studio-bridge', v: 1, type: 'quote', job_id: 'j', document_id: null, title: 'x', item_id: 'p001-b0000', page_idx: 0, source_text: 'forged', translated_text: null }, '*'),
	);
	await page.waitForTimeout(300);
	await expect(page.locator('.studio-toast')).toHaveCount(0);
	await page.locator('#open-translate').click();
	await expect(editor(page).locator('.retainpdf-quote')).toHaveCount(0);
});

test('RetainPDF not answering: why, a way to try again, and to its address in the settings', async ({ page }) => {
	await openStudio(page);
	// A port nothing listens on: a server's, closed.
	const closed = createServer();
	await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
	const nowhere = `http://127.0.0.1:${(closed.address() as AddressInfo).port}/`;
	await new Promise<void>((resolve) => closed.close(() => resolve()));
	await setAddress(page, nowhere);

	await page.locator('#open-translate').click();
	const why = page.locator('#retainpdf-unreachable');
	await expect(why).toBeVisible();
	await expect(why).toContainText('连不上 RetainPDF');
	await expect(why.locator('code')).toHaveText(nowhere);
	await expect(page.locator('#retainpdf-frame')).toBeHidden();

	// Set right in the settings, then 重试: the pages.
	await why.getByRole('button', { name: '改地址' }).click();
	const section = page.locator('#settings-retainpdf');
	await expect(section).toBeVisible();
	await expect(section.locator('#retainpdf-url')).toHaveValue(nowhere);
	await section.locator('#retainpdf-url').fill(retainpdfUrl);
	await section.getByRole('button', { name: '保存' }).click();
	await expect(section.locator('#retainpdf-status')).toContainText('已保存');
	expect(savedUrl()).toBe(retainpdfUrl);
	await page.keyboard.press('Escape');
	await why.getByRole('button', { name: '重试' }).click();
	await expect(why).toBeHidden();
	await expect(inFrame(page).locator('#library')).toHaveText('图书馆');
});

test('设置 › RetainPDF: empty is the default address, and nothing other than http(s) is taken', async ({ page }) => {
	await openStudio(page);
	const section = await openSettings(page, 'retainpdf');
	await expect(section.locator('#retainpdf-url')).toHaveValue('');
	await expect(section.locator('#retainpdf-url')).toHaveAttribute('placeholder', 'http://127.0.0.1:40001/');
	await section.locator('#retainpdf-url').fill('file:///Applications/RetainPDF.app');
	await section.getByRole('button', { name: '保存' }).click();
	await expect(section.locator('#retainpdf-status')).toContainText('http:// 或 https://');
	expect(savedUrl()).toBeUndefined();
});
