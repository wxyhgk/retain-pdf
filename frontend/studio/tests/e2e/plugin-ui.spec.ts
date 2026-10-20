import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture } from './studio.ts';

// A plugin's tab in the right column (ctx.panels) and its commands (ctx.commands): on their keys, in the slash menu, the ⋯ menu and the left column.

// Only on the server's own copy of the project (E2E_ISOLATED=1): the plugin written here must never be the repository's.
test.skip(!process.env.E2E_ROOT_PARENT, 'needs E2E_ISOLATED=1');

const root = () => join(process.env.E2E_ROOT_PARENT!, basename(fileURLToPath(new URL('../..', import.meta.url))));
const folder = () => join(root(), 'plugins', 'test-ui');

const PLUGIN = `
export const name = 'test-ui';
export const inject = ['studio', 'panels', 'commands'];
export function apply(ctx: any): void {
	ctx.panels.register({
		key: 'notes',
		label: '便签',
		draw(pane: HTMLElement) {
			pane.innerHTML = '<p class="test-notes">这是便签</p>';
			return () => { (window as any).notesUndrawn = ((window as any).notesUndrawn ?? 0) + 1; };
		},
	});
	ctx.commands.register({ id: 'test-ui.open', label: '打开便签', icon: '✎', places: ['sidebar'], run: () => ctx.studio.showPanel('notes') });
	ctx.commands.register({
		id: 'test-ui.stamp',
		label: '插入印章',
		keys: 'Mod-Alt-y',
		keywords: ['stamp'],
		places: ['slash', 'page-menu'],
		run: ({ from }: { from: string }) => ctx.studio.editor.insert('印章来自 ' + from + '，全文 ' + ctx.studio.source().length + ' 字'),
	});
	ctx.commands.register({ id: 'test-ui.fail', label: '会失败', places: ['page-menu'], run: () => { throw new Error('故意的'); } });
}
`;

test.beforeEach(() => resetFixture());
test.afterEach(() => rmSync(folder(), { recursive: true, force: true }));

const tab = (page: Page) => page.locator('.side-tabs [role="tab"]', { hasText: '便签' });
const sidebarButton = (page: Page) => page.locator('#plugin-commands button', { hasText: '打开便签' });

async function caretAtEnd(page: Page): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
}

test('a plugin’s tab and commands come with it and go with it', async ({ page }) => {
	await openStudio(page);
	await page.evaluate(() => {
		(window as any).notReloaded = true;
	});
	await expect(page.locator('#plugin-commands')).toBeHidden();

	mkdirSync(folder(), { recursive: true });
	writeFileSync(join(folder(), 'studio.ts'), PLUGIN);
	await expect(page.locator('.studio-toast', { hasText: '已重新载入插件：test-ui' })).toBeVisible({ timeout: 20_000 });

	// Its tab, after the Studio's own, drawn when it is first shown; its button in the left column opens it.
	await expect(tab(page)).toBeVisible();
	await expect(page.locator('.side-tabs [role="tab"]')).toHaveText(['文件', '终端', '资料库', '便签']);
	await expect(page.locator('.test-notes')).toHaveCount(0);
	await sidebarButton(page).click();
	await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#side-plugin-notes .test-notes')).toHaveText('这是便签');
	await expect(page.locator('#side-files')).toBeHidden();

	// Its shortcut.
	await caretAtEnd(page);
	await page.keyboard.press('Control+Alt+KeyY');
	await expect(editor(page)).toContainText(/印章来自 keys，全文 \d+ 字/u);

	// The slash menu, the `/…` typed taken away.
	await caretAtEnd(page);
	await page.keyboard.press('Enter');
	await page.keyboard.insertText('、');
	await page.keyboard.insertText('stamp');
	await page.waitForTimeout(100);
	await expect(page.locator('.milkdown-slash-menu')).toContainText('插入印章');
	await page.keyboard.press('Enter');
	await expect(editor(page)).toContainText('印章来自 slash');
	await expect(editor(page)).not.toContainText('、stamp');

	// The ⋯ menu (at the caret the slash menu left); a command that fails says why.
	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '插入印章' }).click();
	await expect(editor(page)).toContainText('印章来自 page-menu');
	await page.locator('#page-menu').click();
	await page.getByRole('menuitem', { name: '会失败' }).click();
	await expect(page.locator('.studio-toast', { hasText: '会失败：故意的' })).toBeVisible();

	// Gone with its plugin: the tab (what it drew undone, the files shown again), the button, the keys, the menus.
	rmSync(folder(), { recursive: true, force: true });
	await expect(tab(page)).toHaveCount(0, { timeout: 20_000 });
	await expect(page.locator('#side-files')).toBeVisible();
	expect(await page.evaluate(() => (window as any).notesUndrawn)).toBe(1);
	await expect(page.locator('#plugin-commands')).toBeHidden();
	await caretAtEnd(page);
	await page.keyboard.press('Control+Alt+KeyY');
	await page.locator('#page-menu').click();
	await expect(page.getByRole('menuitem', { name: '历史版本…' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: '插入印章' })).toHaveCount(0);
	await page.keyboard.press('Escape');
	await expect(editor(page).getByText('印章来自 keys')).toHaveCount(1);
	expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
});

test('the tab chosen is chosen again after a reload, once its plugin has put it in', async ({ page }) => {
	mkdirSync(folder(), { recursive: true });
	writeFileSync(join(folder(), 'studio.ts'), PLUGIN);
	await openStudio(page);
	await tab(page).click();
	await expect(page.locator('#side-plugin-notes .test-notes')).toBeVisible();
	await page.reload();
	await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#side-plugin-notes .test-notes')).toBeVisible();
});
