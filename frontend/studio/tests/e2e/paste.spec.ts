import { expect, test } from '@playwright/test';

import { caretAfter, displayFormulas, editor, inlineFormulas, openStudio, paste, resetFixture } from './studio.ts';

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
