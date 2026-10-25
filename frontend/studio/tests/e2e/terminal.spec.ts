import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { editor, fixtureHas, openStudio, resetFixture, savedMarkdown } from './studio.ts';

/** The repository's folder, as the terminal names it (a worktree's is not `notion2gitub_blog`). */
const folder = basename(fileURLToPath(new URL('../..', import.meta.url)));

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
	await expect(page.locator('#terminal-cwd')).toHaveText(`${folder}/`);
});

test('the terminal runs a shell in the repository', async ({ page }) => {
	await run(page, 'echo "studio-$((6 * 7)) in $(basename "$PWD")"');
	await expect(screen(page)).toContainText(`studio-42 in ${folder}`);
});

test('in the article’s folder, what the shell writes shows up in the file panel', async ({ page }) => {
	page.once('dialog', (dialog) => void dialog.accept());
	await page.getByRole('radio', { name: '当前文章' }).click();
	await expect(page.locator('#terminal-cwd')).toHaveText('blog/studio-fixture/');
	await running(page);
	// A new shell: what is typed before it has started can be lost on a busy machine.
	await page.waitForTimeout(1500);
	await run(page, 'echo "article=$STUDIO_ARTICLE file=$(basename "$(dirname "$STUDIO_ARTICLE_FILE")")/$(basename "$STUDIO_ARTICLE_FILE")"; mkdir -p assets && echo 3 > assets/from-shell.xyz');
	// One line, however narrow the panel wraps it.
	await expect.poll(async () => (await screen(page).innerText()).replace(/\n/gu, '')).toContain('article=studio-fixture file=studio-fixture/index.md');
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

test('⌘J, 在终端里问 AI: a question about the block’s lines typed into the terminal, to finish and send', async ({ page }) => {
	await page.locator('#side-tab-files').click();
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type('，刚改的');
	await page.keyboard.press('ControlOrMeta+j');
	await page.locator('.inline-ai').getByRole('option', { name: '在终端里问 AI…' }).click();
	// The article is saved first, so the lines named are the file's.
	await expect.poll(savedMarkdown).toContain('结尾段落。，刚改的');
	const line = savedMarkdown().split('\n').findIndex((text) => text.includes('结尾段落。，刚改的')) + 1;
	await expect(page.locator('#side-terminal')).toBeVisible();
	// One line, however the terminal wraps it on the screen.
	const typed = async () => (await screen(page).innerText()).replace(/\n/gu, '');
	await expect.poll(typed).toContain(`blog/studio-fixture/index.md 第 ${line} 行（从「结尾段落。，刚改的」开始）。要求：`);
	// Typed, not run: nothing came back from the shell, and nothing was made.
	await page.waitForTimeout(500);
	expect(await typed()).not.toContain('command not found');
	await expect(page.locator('#terminal-screen')).toHaveAttribute('data-state', 'running');
});

test('the terminal has `studio`, the pages’ operations for an AI, on its PATH', async ({ page }) => {
	await run(page, 'echo "pages=$(studio list-pages | grep -c \'Studio 测试夹具\')"');
	await expect(screen(page)).toContainText('pages=1');
});

test('an AI starts with a click, in the article’s folder; one this machine has not is greyed, saying how to get it', async ({ page }) => {
	const agents = page.locator('#terminal-agents');
	await expect(agents.locator('button[data-agent]')).toHaveText(['Claude', 'Codex', 'pi']);
	// The stand-ins (fake-agents/) have Claude only.
	await expect(agents.getByRole('button', { name: 'Codex' })).toBeDisabled();
	await expect(agents.getByRole('button', { name: 'Codex' })).toHaveAttribute('title', /npm install -g @openai\/codex/u);
	// A shell is running: asked first.
	page.once('dialog', (dialog) => void dialog.accept());
	await agents.getByRole('button', { name: 'Claude' }).click();
	await expect(page.locator('#terminal-cwd')).toHaveText('blog/studio-fixture/');
	await expect(screen(page)).toContainText('fake-claude in studio-fixture for studio-fixture');
	await expect(page.getByRole('radio', { name: '当前文章' })).toHaveAttribute('aria-checked', 'true');
});
