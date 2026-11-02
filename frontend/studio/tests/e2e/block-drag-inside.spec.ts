import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { editor, removeArticle, resetFixture, writeArticle } from './studio.ts';

// As Notion has it: a drag begun inside the article selects text in its block only; into another block, it selects
// the blocks, whole, whatever they are (code, a picture, a formula), up or down; the browser's highlight not shown in
// them. Begun in the margin, a box is drawn as it goes.

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="#fff" stroke="#999"/><text x="20" y="80">0.5</text><path d="M20 80 Q 110 0 200 80 T 380 80" stroke="#000" fill="none"/></svg>';

test.beforeEach(({ page }) => {
	resetFixture();
	writeArticle('drag-blocks', '---\ntitle: 拖选\ndescription: 测试\npubDate: 2026-10-27\ndraft: true\n---\n\n代码\n\n```text\n\n```\n\n![y = sin x 的图像](./img/plot.svg)\n\n公式\n\n$$\n\\sin x + \\int f(x)\\mathrm{d}x\n$$\n\n结尾\n');
	mkdirSync(join(process.env.STUDIO_BLOG_DIR!, 'drag-blocks', 'img'), { recursive: true });
	writeFileSync(join(process.env.STUDIO_BLOG_DIR!, 'drag-blocks', 'img', 'plot.svg'), svg);
	return page.setViewportSize({ width: 1400, height: 1300 });
});
test.afterEach(() => removeArticle('drag-blocks'));

const selected = (page: import('@playwright/test').Page) => editor(page).locator('.pm-block-range');

for (const direction of ['up', 'down'] as const) {
	test(`a drag begun inside the article (${direction}) selects every block it goes over`, async ({ page }) => {
		await page.goto('/studio?article=drag-blocks');
		await expect(editor(page).locator('.pm-display-math')).toBeVisible();
		const first = (await editor(page).locator('p', { hasText: '代码' }).boundingBox())!;
		const last = (await editor(page).locator('p', { hasText: '结尾' }).boundingBox())!;
		const [from, to] = direction === 'up' ? [[last.x + 300, last.y + last.height / 2], [first.x + 300, first.y + 4]] : [[first.x + 10, first.y + first.height / 2], [last.x + 300, last.y + last.height / 2]];
		await page.mouse.move(from[0]!, from[1]!);
		await page.mouse.down();
		await page.mouse.move(to[0]!, to[1]!, { steps: 20 });
		await page.mouse.up();
		await expect(selected(page)).toHaveCount(6);
		await expect(editor(page).locator('.milkdown-code-block.pm-block-range, figure.pm-block-range, .pm-display-math.pm-block-range')).toHaveCount(3);
		await expect(editor(page)).toHaveClass(/pm-has-block-range/u);
		// Kept after the press is over.
		await page.waitForTimeout(200);
		await expect(selected(page)).toHaveCount(6);
	});
}

test('in one block a drag selects its text; from the margin, a box is drawn while the blocks are selected', async ({ page }) => {
	await page.goto('/studio?article=drag-blocks');
	await expect(editor(page).locator('.pm-display-math')).toBeVisible();
	const line = (await editor(page).locator('p', { hasText: '结尾' }).boundingBox())!;
	await page.mouse.move(line.x + 1, line.y + line.height / 2);
	await page.mouse.down();
	await page.mouse.move(line.x + 30, line.y + line.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(selected(page)).toHaveCount(0);
	expect(await page.evaluate(() => getSelection()?.toString())).toBe('结尾');

	const first = (await editor(page).locator('p', { hasText: '代码' }).boundingBox())!;
	// The editor's margin, left of the blocks.
	await page.mouse.move((await editor(page).boundingBox())!.x + 4, line.y + line.height / 2);
	await page.mouse.down();
	await page.mouse.move(first.x + 200, first.y + 4, { steps: 10 });
	await expect(page.locator('.pm-block-marquee')).toBeVisible();
	await page.mouse.up();
	await expect(page.locator('.pm-block-marquee')).toHaveCount(0);
	await expect(selected(page)).toHaveCount(6);
});
