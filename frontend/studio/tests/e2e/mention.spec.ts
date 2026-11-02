import { expect, test } from '@playwright/test';

import { editor, openStudio, resetDrive, resetFixture, savedMarkdown, writeArticle, removeArticle, writeFixtureFile } from './studio.ts';

// `@` (article-links.ts mentionAt, QuickFindDialog's 插入): a page, a file of the article, a file of the drive copied
// into it, put where it was typed, in the sentence.

test.beforeEach(() => resetFixture());

async function typeAt(page: import('@playwright/test').Page, words: string): Promise<void> {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(words);
}

test('@ in a sentence: the article’s files offered first; the one chosen put in, in the sentence, marked by its icon', async ({ page }) => {
	writeFixtureFile('assets/opt.py', 'x = 1\n');
	writeFixtureFile('assets/energies.csv', 'a,b\n');
	await openStudio(page);
	await typeAt(page, '用 ');
	await page.keyboard.type('@');
	const finder = page.locator('#quick-find-dialog');
	await expect(finder).toBeVisible();
	await expect(finder.locator('.quick-find-item').first()).toContainText('energies.csv');
	await page.locator('#quick-find-input').fill('opt');
	await expect(finder.locator('.quick-find-item').first()).toContainText('opt.py');
	await page.keyboard.press('Enter');
	await expect(finder).toBeHidden();
	await page.keyboard.type(' 算的。');
	const sentence = editor(page).locator('p', { hasText: '算的' });
	await expect(sentence.locator('.pm-file-mention-start[data-file-kind="code"]')).toHaveText('opt.py');
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toContain('结尾段落。用 [opt.py](./assets/opt.py) 算的。');
});

test('@ puts in a page too; given up, the @ stays as typed; in an address it is only an @', async ({ page }) => {
	writeArticle('mention-other', '---\ntitle: 另一页\npubDate: 2026-10-01\ndraft: true\n---\n\n正文。\n');
	try {
		await openStudio(page);
		await typeAt(page, '见 ');
		await page.keyboard.type('@');
		await page.locator('#quick-find-input').fill('另一页');
		await page.locator('#quick-find-dialog .quick-find-item', { hasText: '另一页' }).first().click();
		await page.keyboard.type(' 和 ');
		await page.keyboard.type('@');
		await expect(page.locator('#quick-find-dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await page.keyboard.type(' 邮件 a@b.com');
		await expect(page.locator('#quick-find-dialog')).toBeHidden();
		await page.keyboard.press('ControlOrMeta+s');
		// The Markdown written may escape an address's @ (a\\@b.com, as GitHub's links have it): the same once shown.
		await expect.poll(savedMarkdown).toMatch(/结尾段落。见 \[另一页\]\(\/blog\/mention-other\/\) 和 @ 邮件 a\\?@b\.com/u);
	} finally {
		removeArticle('mention-other');
	}
});

test('@ finds a file of the drive too: copied into the article, linked there', async ({ page }) => {
	resetDrive({ '论文/BSSE 校正.pdf': '%PDF-1.4 counterpoise' });
	await openStudio(page);
	await typeAt(page, '参考 ');
	await page.keyboard.type('@');
	await page.locator('#quick-find-input').fill('BSSE');
	const found = page.locator('#quick-find-dialog .quick-find-item', { hasText: 'BSSE 校正.pdf' });
	await expect(found).toBeVisible();
	await found.click();
	await expect(editor(page).locator('.pm-file-mention-start[data-file-kind="pdf"]')).toBeVisible();
	await page.keyboard.press('ControlOrMeta+s');
	await expect.poll(savedMarkdown).toMatch(/参考 \[BSSE-?校正\.pdf\]\(\.\/assets\/[^)]+\.pdf\)/u);
});
