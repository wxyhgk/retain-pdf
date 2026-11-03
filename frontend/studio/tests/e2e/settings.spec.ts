import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

import { openStudio, resetFixture, workspaceMenu } from './studio.ts';

// 设置: 语言, the AI's (模型和账号, 识别图片, 高级) and 插件 in one dialog, as Notion's: the parts in a column with a search, the one chosen beside it.

const settingsFile = () => join(process.env.STUDIO_BLOG_DIR!, '.studio-settings.json');

test.beforeEach(() => {
	resetFixture();
	rmSync(settingsFile(), { force: true });
});
test.afterEach(() => rmSync(settingsFile(), { force: true }));

test('one 设置 in the workspace menu: its parts in a column, found by a search, each shown beside it', async ({ page }) => {
	await openStudio(page);
	await page.locator('#workspace-menu').click();
	// The three that were in the menu are one now.
	await expect(page.locator('#open-settings')).toHaveText('设置');
	await expect(page.locator('#open-plugins, #open-ai-settings, #open-locale')).toHaveCount(0);
	await page.locator('#open-settings').click();

	const dialog = page.locator('#settings-dialog');
	const nav = dialog.locator('nav [data-section]');
	await expect(nav).toHaveText(['语言', '外观', '打开文件', '其他设备访问', 'RetainPDF', '模型和账号', '识别图片', '高级', '插件']);
	// 语言 first, the search with the keys.
	await expect(dialog.locator('#settings-locale #studio-locale')).toBeVisible();
	await expect(dialog.locator('nav [aria-current="page"]')).toHaveText('语言');
	await expect(dialog.locator('#settings-search')).toBeFocused();

	// Found by what they are about, not only their names; Enter shows the first found.
	await dialog.locator('#settings-search').fill('key');
	await expect(nav).toHaveText(['模型和账号', '识别图片']);
	await dialog.locator('#settings-search').press('Enter');
	await expect(dialog.locator('#settings-ai-models .ai-sheet')).toBeVisible();
	await nav.filter({ hasText: '识别图片' }).click();
	await expect(dialog.locator('#settings-ai-vision #ai-provider')).toBeVisible();
	await dialog.locator('#settings-search').fill('没有这种设置');
	await expect(nav).toHaveCount(0);
	await expect(dialog.locator('nav')).toContainText('没有找到「没有这种设置」');
	await dialog.locator('#settings-search').fill('');

	// Saved here, it stays open, saying so.
	await dialog.locator('#ai-provider').selectOption('openai');
	await dialog.locator('#ai-model').fill('qwen-vl-max');
	await dialog.locator('#ai-settings-save').click();
	await expect(dialog.locator('#ai-settings-status')).toHaveText('已保存');
	await expect(dialog).toBeVisible();

	await nav.filter({ hasText: '插件' }).click();
	await expect(dialog.locator('#settings-plugins .plugin-row[data-plugin="job"]')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	// Opened again: what was saved is shown.
	await workspaceMenu(page, 'open-settings');
	await dialog.locator('nav [data-section="ai-vision"]').click();
	await expect(dialog.locator('#ai-model')).toHaveValue('qwen-vl-max');
});

test('设置 › AI › 高级: Claude Code and Codex beside pi in the AI panel, each on or off', async ({ page }) => {
	await openStudio(page);
	await workspaceMenu(page, 'open-settings');
	const dialog = page.locator('#settings-dialog');
	await dialog.locator('nav [data-section="ai-advanced"]').click();
	const rows = dialog.locator('#agents-list li');
	await expect(rows.locator('strong')).toHaveText(['Claude', 'Codex']);
	// Nothing saved: as the tests start (STUDIO_AGENTS_ON), both on.
	const codex = dialog.getByRole('switch', { name: '在 AI 面板里用 Codex' });
	await expect(codex).toBeChecked();
	await codex.click();
	await expect(codex).not.toBeChecked();
	await expect(dialog.locator('#agents-status')).toContainText('已保存');
	expect(JSON.parse(readFileSync(settingsFile(), 'utf8')).agents).toEqual({ on: ['claude'] });
	// The panel's AIs: pi first, Claude still, Codex no longer.
	await page.keyboard.press('Escape');
	await page.reload();
	await page.locator('#side-tab-ai').click();
	const listed = await page.evaluate(async () => ((await (await fetch('/api/studio/conversations')).json()) as { agents: Array<{ id: string }> }).agents.map((agent) => agent.id));
	expect(listed).toEqual(['pi', 'claude']);
});
