import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Pictures as figures: the width after them, their caption numbered, as the blog shows them.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));
const figures = (page: Page) => editor(page).locator('figure.pm-figure');

const save = async (page: Page) => {
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
};

test.beforeEach(async ({ page }) => {
	resetFixture();
	writeFixtureFile('img/plot.png', PLOT);
	appendToFixture('\n![势能面](./img/plot.png){width=50%}\n\n![plot](./img/plot.png)\n\n文字里 ![小图](./img/plot.png) 接着写。\n');
	await openStudio(page);
});

test('an image alone in its paragraph is a figure: its width, its caption numbered', async ({ page }) => {
	await expect(figures(page)).toHaveCount(2);
	const first = figures(page).first();
	await expect(first.locator('img')).toHaveJSProperty('complete', true);
	await expect(first.locator('.figure-label')).toHaveText('图 1');
	await expect(first.locator('.pm-figure-caption')).toHaveValue('势能面');
	const widths = await first.evaluate((figure) => [figure.getBoundingClientRect().width, figure.querySelector('img')!.getBoundingClientRect().width]);
	expect(Math.round((widths[1] / widths[0]) * 100)).toBe(50);
	// A file name is not a caption.
	await expect(figures(page).nth(1).locator('.figure-label')).toBeHidden();
	await expect(figures(page).nth(1).locator('.pm-figure-caption')).toHaveValue('');
	await expect(editor(page).locator('p img')).toHaveCount(1);
	await page.screenshot({ path: test.info().outputPath('figures.png'), fullPage: false });
});

test('typing a caption numbers the figure and writes the alt text', async ({ page }) => {
	const second = figures(page).nth(1);
	await second.hover();
	await second.locator('.pm-figure-caption').click();
	await page.keyboard.type('高斯型曲线');
	await expect(second.locator('.pm-figure-caption')).toBeFocused();
	await expect(second.locator('.pm-figure-caption')).toHaveValue('高斯型曲线');
	await expect(second.locator('.figure-label')).toHaveText('图 2');
	await page.keyboard.press('Enter');
	const markdown = await save(page);
	expect(markdown).toContain('![势能面](./img/plot.png){width=50%}\n\n![高斯型曲线](./img/plot.png)\n');
});

test('dragging the edge sets the width, written after the image', async ({ page }) => {
	const second = figures(page).nth(1);
	await second.hover();
	const handle = second.locator('.pm-figure-handle');
	const box = (await second.boundingBox())!;
	const grip = (await handle.boundingBox())!;
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	// 60% of the column: 30% to the right of its centre.
	await page.mouse.move(box.x + box.width * 0.8, grip.y + 10, { steps: 6 });
	await expect(second.locator('.pm-figure-badge')).toHaveText('60%');
	await page.mouse.up();
	const markdown = await save(page);
	expect(markdown).toContain('![plot](./img/plot.png){width=60%}');
});

test('figures the author did not touch are saved as they were written', async ({ page }) => {
	await editor(page).getByText('结尾段落。').click();
	await page.keyboard.press('End');
	await page.keyboard.type('改');
	const markdown = await save(page);
	expect(markdown).toContain('![势能面](./img/plot.png){width=50%}\n\n![plot](./img/plot.png)\n\n文字里 ![小图](./img/plot.png) 接着写。\n');
});

test('an SVG figure shows, as on the blog', async ({ page }) => {
	resetFixture();
	writeFixtureFile('img/scheme.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="teal"/></svg>');
	appendToFixture('\n![反应示意图](./img/scheme.svg)\n');
	await openStudio(page);
	const image = figures(page).locator('img');
	await expect(image).toHaveJSProperty('complete', true);
	expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(200);
});
