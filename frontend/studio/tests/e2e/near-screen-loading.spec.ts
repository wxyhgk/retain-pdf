import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, writeFixtureFile } from './studio.ts';

// What an article fetches (its pictures, its 交互模块) is fetched as it comes near the screen, not before
// (near-screen.ts `loadWhenNear`): what is not scrolled to is not downloaded, another device's over a phone's network
// too. A picture's room is kept, as large as it is (picture-sizes.mjs), so nothing moves when it comes in.

test.beforeEach(() => resetFixture());

const FILLER = Array.from({ length: 120 }, (_, index) => `填充的第 ${index + 1} 段，让下面的东西离屏幕很远。`).join('\n\n');

test('a picture and a widget far down the article are not fetched till scrolled to; the picture’s room is kept', async ({ page }) => {
	writeFixtureFile('img/far.png', readFileSync(new URL('./fixtures/plot.png', import.meta.url)));
	appendToFixture(`\n\n${FILLER}\n\n![远处的图](./img/far.png)\n\n\`\`\`widget title="远处的模块" height=200\n<p id="far">远处的模块</p>\n\`\`\`\n`);
	const asked: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('far.png')) asked.push(request.url());
	});
	await openStudio(page);

	const figure = editor(page).locator('.pm-figure').last();
	const picture = figure.locator('img');
	const widget = editor(page).locator('iframe.note-widget-frame').last();
	await expect(picture).toHaveAttribute('width', '480');
	await expect(picture).toHaveAttribute('height', '280');
	await page.waitForTimeout(800);
	expect(asked).toEqual([]);
	await expect(picture).not.toHaveAttribute('src');
	// The widget: not even made yet (its code block is drawn as it comes near), let alone its page loaded.
	await expect(widget).toHaveCount(0);
	// Its room: as wide as the picture (480 px, the column wider), as tall as its shape makes it.
	const kept = (await picture.boundingBox())!;
	expect(Math.round(kept.width)).toBe(480);
	expect(Math.round(kept.height)).toBe(280);

	await figure.scrollIntoViewIfNeeded();
	await expect(picture).toHaveAttribute('src', /img\/far\.png/u);
	await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(480);
	expect(asked.length).toBeGreaterThan(0);
	const loaded = (await picture.boundingBox())!;
	expect(Math.round(loaded.height)).toBe(Math.round(kept.height));
	await expect(picture).toHaveAttribute('alt', '远处的图');
	// The widget just below it: near now, started.
	await expect(page.frameLocator('iframe.note-widget-frame >> nth=-1').locator('#far')).toHaveText('远处的模块');
});
