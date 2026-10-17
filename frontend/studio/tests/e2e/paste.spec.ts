import { expect, test } from '@playwright/test';

import { caretAfter, displayFormulas, editor, inlineFormulas, openStudio, paste, removeArticle, resetFixture, savedMarkdown, saveStatus, writeArticle } from './studio.ts';

const markdown = '这张文献能量图非常关键：\n\n\\[ \\ce{F + CH3OH -> HF + CH2OH} \\]\n\n也就是 `RC2 → TS2 → PC2`，其中 \\(E_a\\) 很小。';
const html =
	'<p>这张文献能量图非常关键：</p><p>\\[ \\ce{F + CH3OH -&gt; HF + CH2OH} \\]</p>' +
	'<p>也就是 <code>RC2 → TS2 → PC2</code>，其中 \\(E_a\\) 很小。</p>';

test.beforeEach(async ({ page }) => {
	resetFixture();
	await openStudio(page);
	await caretAfter(page, '结尾段落。');
});

for (const [name, data] of [
	['copied from a web page (HTML)', { html, text: markdown }],
	['copied as Markdown (plain text)', { text: markdown }],
] as const) {
	test(`AI answers ${name} paste with their formulas drawn`, async ({ page }) => {
		const inline = await inlineFormulas(page).count();
		const display = await displayFormulas(page).count();
		await paste(page, data);
		await expect(displayFormulas(page)).toHaveCount(display + 1);
		await expect(inlineFormulas(page)).toHaveCount(inline + 1);
		await expect(editor(page)).not.toContainText('\\[');
		await expect(editor(page)).not.toContainText('\\(');
		await expect(editor(page).locator('code', { hasText: 'RC2 → TS2 → PC2' })).toBeVisible();
	});
}

test('Markdown copied from VS Code is read as Markdown; code from it is a code block', async ({ page }) => {
	const colored = '<div style="color: #d4d4d4;"><span style="color: #569cd6;">## 小结</span></div>';
	await page.keyboard.press('Enter');
	await paste(page, { html: colored, text: '## 小结\n\n- 第一点\n- 第二点', vscode: 'markdown' });
	await expect(editor(page).locator('h2', { hasText: '小结' })).toBeVisible();
	await expect(editor(page).locator('li', { hasText: '第二点' })).toBeVisible();

	await paste(page, { html: '<div>print(1)</div>', text: 'print(1)', vscode: 'python' });
	await expect(editor(page).locator('.milkdown-code-block .language-button').last()).toHaveText(/python/u);
});

test('an address pasted over selected text links it; on its own it comes in as a link', async ({ page }) => {
	await editor(page).getByText('结尾段落。', { exact: true }).selectText();
	// The editor knows of the selection once its toolbar is up (it hears of the browser's a moment later).
	await expect(page.locator('.milkdown-toolbar[data-show="true"]')).toBeVisible();
	await paste(page, { text: 'https://example.com/paper' });
	await expect(editor(page).locator('a[href="https://example.com/paper"]')).toHaveText('结尾段落。');

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await paste(page, { text: 'https://doi.org/10.1021/acs.jctc.0c00001' });
	await expect(editor(page).locator('a[href="https://doi.org/10.1021/acs.jctc.0c00001"]')).toHaveText('https://doi.org/10.1021/acs.jctc.0c00001');
	await page.keyboard.type(' 之后');
	await expect(editor(page).locator('a[href="https://doi.org/10.1021/acs.jctc.0c00001"]')).toHaveText('https://doi.org/10.1021/acs.jctc.0c00001');
});

test('the address of one of the blog’s articles comes in as a link titled as it', async ({ page }) => {
	writeArticle('second-note', "---\ntitle: '第二篇笔记'\ndescription: ''\npubDate: '2026-10-17'\ntags: []\nkind: wiki\n---\n\n正文。\n");
	try {
		// Read again, so the new article is in the list; a full run can be slow to load it.
		await page.reload();
		await expect(saveStatus(page)).toHaveText('已载入', { timeout: 30_000 });
		await caretAfter(page, '结尾段落。');
		await page.keyboard.press('Enter');
		await paste(page, { text: `${new URL(page.url()).origin}/wiki/second-note/#一节` });
		await expect(editor(page).locator('a[href="/wiki/second-note/#一节"]')).toHaveText('第二篇笔记');
		await page.keyboard.press('ControlOrMeta+s');
		await expect(saveStatus(page)).toHaveText('已保存');
		expect(savedMarkdown()).toContain('[第二篇笔记](/wiki/second-note/#一节)');
	} finally {
		removeArticle('second-note');
	}
});
