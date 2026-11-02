import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, openStudio, resetFixture, scienceBlock, writeFixtureFile } from './studio.ts';

// A 3D molecule (fast-mol) turned, its view saved in the article (article.views.json) and shown so when it opens again;
// a view 3Dmol saved before is kept in the file but not read.

const VIEWS = () => `${process.env.STUDIO_BLOG_DIR}/studio-fixture/article.views.json`;
const savedViews = () => JSON.parse(readFileSync(VIEWS(), 'utf8')).molecules as Record<string, { format: string; view: unknown; display?: Record<string, unknown> }>;

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

/** A p orbital along z on a small grid (Bohr): a positive lobe above, a negative one below, a carbon at the middle. */
function pOrbitalCube(): string {
	const n = 25;
	const step = 0.4;
	const origin = -((n - 1) / 2) * step;
	const lines = ['p orbital', 'made for a test', ` 1 ${origin} ${origin} ${origin}`, ` ${n} ${step} 0 0`, ` ${n} 0 ${step} 0`, ` ${n} 0 0 ${step}`, ' 6 6.0 0 0 0'];
	const values: string[] = [];
	for (let i = 0; i < n; i += 1)
		for (let j = 0; j < n; j += 1)
			for (let k = 0; k < n; k += 1) {
				const [x, y, z] = [origin + i * step, origin + j * step, origin + k * step];
				values.push((z * Math.exp(-Math.hypot(x, y, z) / 1.2) * 0.2).toExponential(5));
			}
	for (let at = 0; at < values.length; at += 6) lines.push(values.slice(at, at + 6).join(' '));
	return `${lines.join('\n')}\n`;
}

/** How many pixels of the cube's canvas are about the positive phase's blue. */
async function bluePixels(page: Page): Promise<number> {
	return scienceBlock(page, 'Cube').locator('.chem-stage canvas').evaluate((canvas: HTMLCanvasElement) => {
		const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
		let count = 0;
		for (let at = 0; at < data.length; at += 4) if (data[at + 2] > 150 && data[at + 2] - data[at] > 80 && data[at + 2] - data[at + 1] > 40) count += 1;
		return count;
	});
}

test('a cube’s surfaces follow its display (a phase hidden, the molecule drawn otherwise), saved with its view', async ({ page }) => {
	writeFixtureFile('assets/p.cube', pOrbitalCube());
	appendToFixture('\n```cube\n@file ./assets/p.cube\n```\n');
	await openStudio(page);
	const cube = scienceBlock(page, 'Cube');
	await cube.locator('.chem-stage canvas').scrollIntoViewIfNeeded();
	await expect(cube.locator('.chem-stage canvas')).toBeVisible();
	await expect.poll(() => bluePixels(page)).toBeGreaterThan(200);

	await cube.getByLabel('显示正相位').uncheck();
	await expect.poll(() => bluePixels(page)).toBeLessThan(20);
	await cube.getByLabel('分子骨架显示方式').selectOption('sphere');
	await expect(cube.locator('.chem-view-controls span')).toHaveText('显示有改动 · 尚未写入文章');
	await cube.getByRole('button', { name: '保存显示与视角' }).click();
	await expect(cube.locator('.chem-view-controls span')).toHaveText('显示与视角已写入文章配置');
	const saved = Object.values(savedViews()).find((entry) => entry.format === 'cube')!;
	expect(saved.view).toMatchObject({ zoom: expect.any(Number) });
	expect(saved.display).toMatchObject({ positive: false, negative: true, moleculeStyle: 'sphere' });

	await page.reload();
	const again = scienceBlock(page, 'Cube');
	await again.locator('.chem-stage canvas').scrollIntoViewIfNeeded();
	await expect(again.locator('.chem-view-controls span')).toHaveText('已载入文章视角');
	await expect(again.getByLabel('显示正相位')).not.toBeChecked();
	await expect(again.getByLabel('分子骨架显示方式')).toHaveValue('sphere');
	await expect.poll(() => bluePixels(page)).toBeLessThan(20);
});
