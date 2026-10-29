import { request as httpsRequest } from 'node:https';
import { expect, test } from '@playwright/test';

import { openSettings, openStudio, resetFixture } from './studio.ts';

// 设置 › iPad 访问 (server/remote/remote-access.mjs): on, a QR code to pair with, the device paired listed and removed.
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

test('iPad 访问: turned on, a QR code to pair with; the device paired is listed, and removed; off again', async ({ page }) => {
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

test('iPad 访问 is set on the Mac only: asked through the door (from a device), refused', async ({ page }) => {
	await openStudio(page);
	const answer = await page.request.put('/api/studio/remote', { data: { enabled: true }, headers: { 'x-studio-remote': '1' } });
	expect(answer.status()).toBe(403);
	expect((await page.request.get('/api/studio/remote')).ok()).toBe(true);
});
