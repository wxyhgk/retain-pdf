import { expect, test, type Locator, type Page } from '@playwright/test';

import { fixtureHas, openStudio, resetFixture } from './studio.ts';

const screen = (page: Page): Locator => page.locator('#terminal-screen .xterm-rows');
const running = (page: Page) => expect(page.locator('#terminal-screen')).toHaveAttribute('data-state', 'running');

/** Type into the terminal as a person would, ending with Return. */
async function run(page: Page, command: string): Promise<void> {
	await page.locator('#terminal-screen .xterm-helper-textarea').focus();
	await page.keyboard.type(command);
	await page.keyboard.press('Enter');
}

test.beforeEach(async ({ page }) => {
	resetFixture();
	await page.addInitScript(() => localStorage.setItem('studio.terminal-cwd', 'root'));
	await openStudio(page);
	await page.locator('#side-tab-terminal').click();
	// The first run may compile tools/studio-terminal.
	await expect(page.locator('#terminal-screen')).toHaveAttribute('data-state', 'running', { timeout: 120_000 });
	await expect(page.locator('#terminal-cwd')).toHaveText('notion2gitub_blog/');
});

test('the terminal runs a shell in the repository', async ({ page }) => {
	await run(page, 'echo "studio-$((6 * 7)) in $(basename "$PWD")"');
	await expect(screen(page)).toContainText('studio-42 in notion2gitub_blog');
});

test('in the article’s folder, what the shell writes shows up in the file panel', async ({ page }) => {
	page.once('dialog', (dialog) => void dialog.accept());
	await page.getByRole('radio', { name: '当前文章' }).click();
	await expect(page.locator('#terminal-cwd')).toHaveText('blog/studio-fixture/');
	await running(page);
	await run(page, 'echo "article=$STUDIO_ARTICLE"; mkdir -p assets && echo 3 > assets/from-shell.xyz');
	await expect(screen(page)).toContainText('article=studio-fixture');
	await page.locator('#side-tab-files').click();
	await expect(page.locator('#file-tree .file-row[data-path="assets/from-shell.xyz"]')).toBeVisible();
	expect(fixtureHas('assets/from-shell.xyz')).toBe(true);
});

test('after the shell exits, a key opens a new one', async ({ page }) => {
	await run(page, 'exit 4');
	await expect(screen(page)).toContainText('终端已结束（退出码 4），按任意键重新打开');
	await page.keyboard.press('a');
	await running(page);
	await run(page, 'echo again-$((1 + 1))');
	await expect(screen(page)).toContainText('again-2');
});
