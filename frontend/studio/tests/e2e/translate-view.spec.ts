import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { openSettings, openStudio, resetFixture } from './studio.ts';

// 翻译 (the left column): RetainPDF's own pages in the middle, at the address in 设置 › RetainPDF. Here a stand-in for
// RetainPDF answers on a port of its own.

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');
const savedUrl = () => {
	try {
		return JSON.parse(readFileSync(settingsFile(), 'utf8')).retainpdfUrl;
	} catch {
		return undefined;
	}
};

let retainpdf: Server;
let retainpdfUrl = '';

test.beforeAll(async () => {
	retainpdf = createServer((_request, response) => {
		response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		response.end('<!doctype html><title>RetainPDF</title><h1 id="library">图书馆</h1>');
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
	await expect(frame).toHaveAttribute('src', retainpdfUrl);
	await expect(page.frameLocator('#retainpdf-frame').locator('#library')).toHaveText('图书馆');
	expect(new URL(page.url()).searchParams.has('translate')).toBe(true);

	// Pressed again: the article, the frame left loaded behind it.
	await page.locator('#open-translate').click();
	await expect(page.locator('#translate-view')).toBeHidden();
	await expect(page.locator('.editor-panel')).toBeVisible();
	expect(new URL(page.url()).searchParams.has('translate')).toBe(false);
	await expect(frame).toHaveAttribute('src', retainpdfUrl);

	// The address with ?translate opens it.
	await page.goto(`${new URL(page.url()).pathname}?translate`);
	await expect(page.locator('#translate-view')).toBeVisible();
	await expect(page.frameLocator('#retainpdf-frame').locator('#library')).toHaveText('图书馆');
});

test('RetainPDF not answering: why, a way to try again, and to its address in the settings', async ({ page }) => {
	await openStudio(page);
	// A port nothing listens on: the stand-in's, closed.
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
	await expect(page.frameLocator('#retainpdf-frame').locator('#library')).toHaveText('图书馆');
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
