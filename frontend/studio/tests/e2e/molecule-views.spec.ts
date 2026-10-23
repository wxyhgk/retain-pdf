import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { openStudio, resetFixture, scienceBlock } from './studio.ts';

// A 3D molecule (fast-mol) turned, its view saved in the article (article.views.json) and shown so when it opens again;
// a view 3Dmol saved before is kept in the file but not read.

const VIEWS = () => `${process.env.STUDIO_BLOG_DIR}/studio-fixture/article.views.json`;
const savedViews = () => JSON.parse(readFileSync(VIEWS(), 'utf8')).molecules as Record<string, { format: string; view: unknown }>;

test.beforeEach(() => resetFixture());

const water = (page: Page) => scienceBlock(page, 'XYZ');

/** Drags across the middle of the molecule. */
async function turn(page: Page): Promise<void> {
	const canvas = water(page).locator('.chem-stage canvas');
	await canvas.scrollIntoViewIfNeeded();
	const box = (await canvas.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 8 });
	await page.mouse.up();
}

test('a turned molecule’s view is saved in the article and shown so when it opens again', async ({ page }) => {
	await openStudio(page);
	const controls = water(page).locator('.chem-view-controls');
	await expect(water(page).locator('.chem-stage canvas')).toBeVisible();
	await expect(controls.locator('span')).toHaveText('使用自动视角');

	await turn(page);
	await expect(controls.locator('span')).toHaveText('视角有改动 · 尚未写入文章');
	await controls.getByRole('button', { name: '保存视角到文章' }).click();
	await expect(controls.locator('span')).toHaveText('视角已写入文章配置');
	const [entry] = Object.values(savedViews());
	expect(entry.format).toBe('xyz');
	expect(entry.view).toMatchObject({ rotation: expect.any(Array), zoom: expect.any(Number), pan: { x: expect.any(Number), y: expect.any(Number) } });
	expect((entry.view as { rotation: number[] }).rotation).toHaveLength(9);
	expect((entry.view as { rotation: number[] }).rotation).not.toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);

	await page.reload();
	await expect(water(page).locator('.chem-view-controls span')).toHaveText('已载入文章视角');

	// 重置视角: the view it chose itself, the saved one left in the file until saved again.
	await water(page).getByRole('button', { name: '重置视角' }).click();
	await expect(water(page).locator('.chem-view-controls span')).toHaveText('已重置 · 尚未写入文章');
	expect(Object.values(savedViews())[0].view).toEqual(entry.view);
});

test('a view 3Dmol saved before is kept in the file, the molecule drawn from its own view', async ({ page }) => {
	await openStudio(page);
	await turn(page);
	await water(page).getByRole('button', { name: '保存视角到文章' }).click();
	await expect(water(page).locator('.chem-view-controls span')).toHaveText('视角已写入文章配置');
	// As 3Dmol saved it, under the same molecule's key.
	const views = JSON.parse(readFileSync(VIEWS(), 'utf8'));
	const key = Object.keys(views.molecules)[0];
	views.molecules[key].view = [0, 0, -0.33, 142.8, 0.5, 0.46, -0.08, 0.72];
	writeFileSync(VIEWS(), JSON.stringify(views, null, 2));

	await page.reload();
	await expect(water(page).locator('.chem-stage canvas')).toBeVisible();
	await expect(water(page).locator('.chem-view-controls span')).toHaveText('使用自动视角');
	expect(savedViews()[key].view).toEqual([0, 0, -0.33, 142.8, 0.5, 0.46, -0.08, 0.72]);
});
