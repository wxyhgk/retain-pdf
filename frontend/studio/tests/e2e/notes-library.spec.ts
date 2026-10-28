import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, writeArticle, writeFixtureFile } from './studio.ts';

/** A file of another note than the fixture. */
function writeFileOf(folder: string, path: string, content: Buffer): void {
	writeFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, path), content);
}

// 代码库 and 图片库 (apps/code-library, apps/image-library): what is scattered in all the notes, gathered by the Studio
// (studio.notes.*), shown at once, searched, and gone back to where it is.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));
const frame = (page: Page, id: string) => page.frameLocator(`.mini-app-window[data-app="${id}"] iframe`);

async function openApp(page: Page, name: string): Promise<void> {
	await page.locator('#open-apps').click();
	await page.getByRole('menuitem', { name }).click();
}

test.beforeEach(() => {
	resetFixture();
	removeArticle('other-note');
});
test.afterEach(() => removeArticle('other-note'));

test('代码库: the code of every note, its scripts too, searched, filtered by language; the same code once; back to the note at it', async ({ page }) => {
	appendToFixture('\n## 复现\n\n```python title="RFO 一步"\nimport numpy as np\nstep = np.linalg.solve(H, -g)\n```\n\n```smiles\nCCO\n```\n');
	writeFixtureFile('ai/work/opt.py', 'def converged(g):\n    return abs(g).max() < 3e-4\n');
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n记一下：\n\n```bash\nxtb mol.xyz --opt\n```\n\n```python\nimport numpy as np\nstep = np.linalg.solve(H, -g)\n```\n');
	await openStudio(page);
	await openApp(page, '代码库');
	const app = frame(page, 'code-library');

	// Each piece once, the plugin's block (a molecule) not among them unless asked for.
	await expect(app.locator('.item')).toHaveCount(3);
	await expect(app.locator('#count')).toHaveText('3 段，来自 2 篇笔记');
	const rfo = app.locator('.item', { hasText: 'RFO 一步' });
	await expect(rfo).toContainText('出现在 2 篇');
	// Where it was last changed first.
	await expect(rfo.locator('.where')).toContainText('《另一篇笔记》');
	await expect(app.locator('.item', { hasText: 'opt.py' }).locator('.lang')).toHaveText('Python 文件');
	await app.locator('#others').check();
	await expect(app.locator('.item')).not.toHaveCount(3);
	await app.locator('#others').uncheck();

	// By language; by words of the code.
	await app.locator('.chip', { hasText: 'Shell' }).click();
	await expect(app.locator('.item')).toHaveCount(1);
	await expect(app.locator('.item')).toContainText('xtb mol.xyz --opt');
	await app.locator('.chip', { hasText: '全部' }).click();
	await app.locator('#query').fill('abs max');
	await expect(app.locator('.item')).toHaveCount(1);
	await expect(app.locator('.item mark').first()).toHaveText('abs');

	// Its whole text beside the list; where it is, each place one click away.
	await app.locator('#query').fill('');
	await rfo.click();
	await expect(app.locator('.detail .code')).toContainText('step = np.linalg.solve(H, -g)');
	await expect(app.locator('.place')).toHaveCount(2);
	await expect(app.locator('.place', { hasText: 'Studio 测试夹具' })).toContainText('› 复现');
	await app.locator('.place', { hasText: '另一篇笔记' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('另一篇笔记');
	await expect(editor(page).locator('.milkdown-code-block', { hasText: 'np.linalg.solve' })).toBeVisible();

	// A note changed: the list is asked again, by itself.
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n```fortran\nprogram hi\nend program\n```\n');
	await expect(app.locator('.item', { hasText: 'program hi' })).toBeVisible();
	await expect(app.locator('.item', { hasText: 'RFO 一步' })).not.toContainText('出现在 2 篇');
});

test('图片库: the pictures of every note on one wall, those never put in marked, the same picture once; large, and back to it in its note', async ({ page }) => {
	appendToFixture('\n## 结果\n\n![能量曲线](./img/curve.png)\n');
	writeFixtureFile('img/curve.png', PLOT);
	// The AI's copy of it, and a plot it made that no note shows.
	writeFixtureFile('ai/work/curve.png', PLOT);
	writeFixtureFile('ai/work/scratch.png', Buffer.concat([PLOT, Buffer.from([0])]));
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n很多段落，把图挤到下面。\n\n'.concat('一段话。\n\n'.repeat(60), '![同一张图](./curve.png)\n'));
	writeFileOf('other-note', 'curve.png', PLOT);
	await openStudio(page);
	await openApp(page, '图片库');
	const app = frame(page, 'image-library');

	// Shown in two notes, kept by the AI too: one picture, its three places.
	const curve = app.locator('.tile', { has: app.locator('.badge', { hasText: '3 处' }) });
	await expect(curve).toHaveCount(1);
	await expect(curve.locator('img')).toHaveJSProperty('complete', true);
	expect(await curve.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
	await expect(app.locator('.tile', { hasText: 'scratch.png' }).locator('.badges')).toContainText('没用上');
	await app.locator('.chip[data-use="unused"]').click();
	await expect(app.locator('.tile')).toHaveCount(1);
	await app.locator('.chip[data-use=""]').click();
	await app.locator('#query').fill('另一篇');
	await expect(app.locator('.tile')).toHaveCount(1);
	await app.locator('#query').fill('');

	// Large, with what it is and where; to the other note, at the picture, far down.
	await curve.click();
	await expect(app.locator('#viewer')).toBeVisible();
	await expect(app.locator('#facts')).toContainText('用在文章里');
	await expect(app.locator('#facts')).toContainText(/\d+ × \d+/u);
	await expect(app.locator('.place')).toHaveCount(3);
	await app.locator('.place', { hasText: '另一篇笔记' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('另一篇笔记');
	await expect(editor(page).locator('img[src*="curve.png"]')).toBeInViewport();
	await expect(page.locator('.search-flash')).toHaveCount(1);
});
