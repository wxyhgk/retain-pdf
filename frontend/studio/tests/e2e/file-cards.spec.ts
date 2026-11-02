import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { appendToFixture, blockSheet, editor, openStudio, resetFixture, savedMarkdown, writeFixtureFile } from './studio.ts';

// The article's files in its text (article-links.ts): alone on a line, a card (its kind, its size, its ⋯); in a
// sentence, marked by its icon. The Markdown stays the link it is.

test.beforeEach(() => resetFixture());

test('a file alone on its line is a card: what it is, how large; a click on it opens it, ⋯ says what else', async ({ page }) => {
	writeFixtureFile('assets/paper.pdf', `%PDF-1.4\n${'x'.repeat(3000)}`);
	appendToFixture('\n[论文全文](./assets/paper.pdf)\n\n后面一段。\n');
	await openStudio(page);
	const card = editor(page).locator('p.pm-file-card[data-file-kind="pdf"]');
	await expect(card).toContainText('论文全文');
	await expect(card.locator('.pm-file-card-meta')).toHaveText(/^PDF · 2\.9 KB⋯$/u);
	// Its words after the name: as a click on its link (the setting's 单击: in the Studio).
	await card.locator('.pm-file-card-meta').click({ position: { x: 4, y: 6 } });
	await expect(blockSheet(page).locator('iframe.file-preview-frame')).toBeVisible();
	await page.keyboard.press('Escape');
	await card.hover();
	await card.locator('.pm-file-card-more').click();
	await expect(page.getByRole('menuitem')).toHaveText(['打开', '用默认程序打开', /在 Finder 中显示|在文件管理器中显示/u, '历史版本…', '复制路径']);
	await page.keyboard.press('Escape');
	expect(savedMarkdown()).toContain('[论文全文](./assets/paper.pdf)');
});

test('a file in a sentence is marked by its icon, in the sentence with the words round it; a list item’s is no card', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	writeFixtureFile('assets/plot.png', readFileSync(new URL('./fixtures/plot.png', import.meta.url)));
	appendToFixture('\n脚本 [opt.py](./assets/opt.py) 算出了 [图](./assets/plot.png)。\n\n- [opt.py](./assets/opt.py)\n');
	await openStudio(page);
	const sentence = editor(page).locator('p', { hasText: '算出了' });
	await expect(sentence).not.toHaveClass(/pm-file-card/u);
	await expect(sentence.locator('.pm-file-mention-start[data-file-kind="code"]')).toHaveText('opt.py');
	await expect(sentence.locator('.pm-file-mention-start[data-file-kind="image"]')).toHaveText('图');
	await expect(editor(page).locator('li p.pm-file-card')).toHaveCount(0);
	await expect(editor(page).locator('li .pm-file-mention-start')).toHaveText('opt.py');
});
