import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, workspaceMenu } from './studio.ts';

// 插件: each plugin turned on or off in the Studio, at once, and kept so.

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');

test.beforeEach(() => {
	resetFixture();
	rmSync(settingsFile(), { force: true });
	appendToFixture('\n```job id=opt program=xtb args=--opt host=local title=水\n3\nwater\nO 0 0 0\nH 0 0 1\nH 0 1 0\n```\n');
});
test.afterEach(() => rmSync(settingsFile(), { force: true }));

const dialog = (page: Page) => page.locator('#plugins-dialog');
const row = (page: Page, id: string) => dialog(page).locator(`.plugin-row[data-plugin="${id}"]`);
const toggle = (page: Page, id: string) => row(page, id).getByRole('switch');

async function openPlugins(page: Page): Promise<void> {
	await workspaceMenu(page, 'open-plugins');
	await expect(dialog(page)).toBeVisible();
}

test('the plugins are listed, with what each is and how it is doing', async ({ page }) => {
	await openStudio(page);
	await openPlugins(page);
	await expect(row(page, 'job')).toContainText('计算块');
	await expect(row(page, 'job')).toContainText('构建 · 博客页面 · Studio · 开发服务器');
	await expect(row(page, 'job').locator('.plugin-state')).toHaveText('运行中');
	await expect(row(page, 'retainmol')).toContainText('RetainMol 分子编辑器');
	await expect(toggle(page, 'job')).toBeChecked();
});

test('a plugin turned off leaves the Studio at once, stays off, and comes back when turned on', async ({ page }) => {
	await openStudio(page);
	await page.evaluate(() => {
		(window as any).notReloaded = true;
	});
	await expect(editor(page).locator('.job-block')).toHaveCount(1);

	await openPlugins(page);
	await toggle(page, 'job').click({ force: true });
	await expect(row(page, 'job').locator('.plugin-state')).toHaveText('已关闭');
	await expect(dialog(page).locator('#plugins-status')).toContainText('已关闭 job');
	// Its block is plain code now, drawn again without the page loading again.
	await expect(editor(page).locator('.job-block')).toHaveCount(0);
	await expect(editor(page)).toContainText('O 0 0 0');
	expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
	await page.keyboard.press('Escape');

	// Its server side is gone too, and it is still off after a reload.
	expect((await page.request.get('/api/studio/plugins/job/hosts')).status()).toBe(404);
	await page.reload();
	await expect(editor(page)).toContainText('O 0 0 0');
	await expect(editor(page).locator('.job-block')).toHaveCount(0);

	await openPlugins(page);
	await expect(toggle(page, 'job')).not.toBeChecked();
	await toggle(page, 'job').click({ force: true });
	await expect(row(page, 'job').locator('.plugin-state')).toHaveText('运行中');
	await expect(editor(page).locator('.job-block')).toHaveCount(1);
	expect((await page.request.get('/api/studio/plugins/job/hosts')).status()).toBe(200);
});
