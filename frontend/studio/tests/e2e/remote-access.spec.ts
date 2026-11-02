import { request as httpsRequest } from 'node:https';
import { expect, test } from '@playwright/test';

import { openSettings, openStudio, resetFixture, slug } from './studio.ts';

// 设置 › 其他设备访问 (server/remote/remote-access.mjs): on, a code to pair with (a QR code for the iPad app, typed into a
// browser's page), the device paired listed and removed.
// The test servers' door listens on this machine only, on a port of the system's.

test.beforeEach(() => resetFixture());

/** What the iPad app does with the code: asks the door to pair it (its certificate trusted by its fingerprint there). */
function pairAs(port: number, code: string, name: string): Promise<number> {
	return new Promise((done, failed) => {
		const asked = httpsRequest({ host: '127.0.0.1', port, method: 'POST', path: '/pair', headers: { 'Content-Type': 'application/json' }, rejectUnauthorized: false }, (answer) => {
			answer.resume();
			answer.on('end', () => done(answer.statusCode ?? 0));
		});
		asked.on('error', failed);
		asked.end(JSON.stringify({ code, name }));
	});
}

test('其他设备访问: turned on, a QR code to pair with; the device paired is listed, and removed; off again', async ({ page }) => {
	await openStudio(page);
	const settings = await openSettings(page, 'remote');
	await expect(settings.locator('#remote-pair')).toHaveCount(0);
	await settings.locator('#remote-enabled').click();
	await expect(settings.locator('#remote-pair')).toBeVisible();
	await settings.locator('#remote-pair').click();
	await expect(settings.locator('#remote-pairing svg')).toBeVisible();
	const code = (await settings.locator('#remote-code').textContent())!;
	expect(code).toMatch(/^[A-Z2-9]{8}$/u);

	const { port } = await (await page.request.get('/api/studio/remote')).json();
	expect(await pairAs(port, code, '测试的 iPad')).toBe(200);
	await expect(page.locator('#remote-status')).toHaveText('已配对「测试的 iPad」');
	await expect(settings.locator('#remote-pairing')).toHaveCount(0);
	const device = settings.locator('.remote-device', { hasText: '测试的 iPad' });
	await expect(device).toBeVisible();
	await device.getByRole('button', { name: '移除' }).click();
	await expect(device).toHaveCount(0);

	await settings.locator('#remote-enabled').click();
	await expect(settings.locator('#remote-pair')).toHaveCount(0);
});

test('其他设备访问 is set on the Mac only: asked through the door (from a device), refused', async ({ page }) => {
	await openStudio(page);
	const answer = await page.request.put('/api/studio/remote', { data: { enabled: true }, headers: { 'x-studio-remote': '1' } });
	expect(answer.status()).toBe(403);
	expect((await page.request.get('/api/studio/remote')).ok()).toBe(true);
});

test('a browser on another computer: shown a page to type the code into, then the Studio, as the Mac’s', async ({ page, browser }) => {
	await openStudio(page);
	const settings = await openSettings(page, 'remote');
	await settings.locator('#remote-enabled').click();
	await expect(settings.locator('#remote-fingerprint')).toHaveText(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/u);
	await expect(settings.locator('.remote-address').first()).toContainText('https://');
	await settings.locator('#remote-pair').click();
	const code = (await settings.locator('#remote-code').textContent())!;
	const { port } = await (await page.request.get('/api/studio/remote')).json();

	// The other computer: its own browser, the door's certificate let through (the author checked its fingerprint).
	const other = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: `https://127.0.0.1:${port}` });
	try {
		const away = await other.newPage();
		const shown = await away.goto(`/studio?article=${slug}`);
		expect(shown?.status()).toBe(401);
		await expect(away.locator('h1')).toHaveText('Studio');
		// Its name guessed from the browser, to be changed.
		await expect(away.locator('#name')).toHaveValue(/\S/u);
		await away.locator('#code').fill('AAAAAAAA');
		await away.locator('#go').click();
		await expect(away.locator('#said')).toHaveText('配对码不对');
		await away.locator('#name').fill('办公室的电脑');
		await away.locator('#code').fill(code.toLowerCase());
		await away.locator('#go').click();
		// The page asked for, the Studio's, with the article.
		await expect(away.locator('#crepe-editor .milkdown .ProseMirror')).toBeVisible();
		await expect(away.locator('#save-status')).toHaveText('已载入');
		expect(new URL(away.url()).searchParams.get('article')).toBe(slug);

		await expect(page.locator('#remote-status')).toHaveText('已配对「办公室的电脑」');
		const device = settings.locator('.remote-device', { hasText: '办公室的电脑' });
		await expect(device).toContainText('浏览器');
		// Removed: the browser is shown the page to pair again.
		await device.getByRole('button', { name: '移除' }).click();
		await expect(device).toHaveCount(0);
		expect((await away.reload())?.status()).toBe(401);
		await expect(away.locator('#code')).toBeVisible();
	} finally {
		await other.close();
	}
});
