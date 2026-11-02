import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { editor, openStudio, resetFixture, savedMarkdown, saveStatus, scienceBlock } from './studio.ts';

// The least start (safe-mode.ts, plugins.ts): whatever the plugins have become, the Studio opens and articles can be
// written. A plugin that cannot load is that plugin failed, said why; 安全模式 loads none.

const root = () => join(process.env.E2E_ROOT_PARENT!, basename(fileURLToPath(new URL('../..', import.meta.url))));

test.beforeEach(() => resetFixture());

for (const [kind, code, why] of [
	['syntax', "export const name = 'broken'; export function apply( {", /broken-syntax.*载入失败/u],
	['throws', "throw new Error('插件一载入就出错'); export const name = 'x'; export function apply() {}", /broken-throws.*插件一载入就出错/u],
	['hangs', "await new Promise(() => {}); export const name = 'x'; export function apply() {}", /broken-hangs.*秒内没有载入完/u],
] as const) {
	test(`a plugin that ${kind === 'syntax' ? 'has a mistake in it' : kind === 'throws' ? 'throws as it loads' : 'never finishes loading'}: the Studio opens, the others work, it is said why`, async ({ page }) => {
		test.setTimeout(60_000);
		const folder = join(root(), 'plugins', `broken-${kind}`);
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'studio.ts'), code);
		try {
			// openStudio waits for the molecules too: another plugin, working.
			await openStudio(page);
			await expect(page.locator('.studio-toast', { hasText: why })).toBeVisible({ timeout: 20_000 });
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	});
}

test('安全模式 (?safe): no plugins, a bar says so; the article is written and saved; 正常启动 brings them back', async ({ page }) => {
	await page.goto('/studio?article=studio-fixture&safe');
	await expect(page.locator('#safe-mode-bar')).toContainText('安全模式：这次没有载入插件');
	await expect(page.locator('#save-status')).toHaveText('已载入');
	// The molecules are a plugin's: not drawn.
	await expect(scienceBlock(page, 'SMILES').locator('.science-block-preview svg')).toHaveCount(0);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('安全模式里写的。');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。安全模式里写的。');
	await page.locator('#safe-mode-bar').getByRole('button', { name: '正常启动' }).click();
	await expect(scienceBlock(page, 'SMILES').locator('.science-block-preview svg')).toBeVisible();
	await expect(page.locator('#safe-mode-bar')).toHaveCount(0);
});

test('after two starts that did not finish, the next is safe by itself', async ({ page }) => {
	await openStudio(page);
	await page.evaluate(() => localStorage.setItem('studio.unfinishedStarts', JSON.stringify({ count: 2, at: Date.now() })));
	await page.reload();
	await expect(page.locator('#safe-mode-bar')).toContainText('前两次都没能启动完');
	await expect(page.locator('#save-status')).toHaveText('已载入');
	// That start finished: the next is as usual.
	await page.goto('/studio?article=studio-fixture');
	await expect(page.locator('#save-status')).toHaveText('已载入');
	await expect(page.locator('#safe-mode-bar')).toHaveCount(0);
});
