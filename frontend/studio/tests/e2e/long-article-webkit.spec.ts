import { existsSync } from 'node:fs';

import { expect, test, webkit } from '@playwright/test';

import { editFixture, editor, openStudio, resetFixture } from './studio.ts';

// A book in one article, in WebKit (the Mac app's): the outline takes the editor to a heading far down and leaves it
// there, and scrolling up and back down comes back to where it was, though formulas are drawn on the way as they come
// near (near-screen.ts) and change the heights above. WebKit keeps nothing still by itself (scroll-anchor.ts).
// Playwright's WebKit (`npx playwright install webkit`), not the Chromium the others use (nor its executable).
test.use({ browserName: 'webkit', channel: '', launchOptions: {}, trace: 'off' });
test.skip(!existsSync(webkit.executablePath()), 'WebKit is not installed (npx playwright install webkit)');

const PAGE = (n: number) => {
	const sentence = '在过渡态理论中，反应速率由鞍点处的自由能垒决定，振动频率给出指前因子。';
	const para = `${sentence.repeat(6)}其中 $E_a = ${n}.5\\,\\mathrm{kJ/mol}$，$k = A e^{-E_a/RT}$，$\\nu_{${n}} = ${n * 3}$。`;
	return `\n## 第 ${n} 页\n\n${para}\n\n${para}\n\n${para}\n${n % 2 ? '' : `\n$$\nk(T) = \\frac{k_B T}{h} e^{-\\Delta G/RT} = ${n}\n$$\n`}`;
};

test('the outline goes to a heading far down, and scrolling up and back down comes back to it', async ({ page }) => {
	test.setTimeout(180_000);
	resetFixture();
	editFixture((markdown) => markdown + Array.from({ length: 300 }, (_, index) => PAGE(index + 1)).join(''));
	await openStudio(page);
	const heading = editor(page).locator('h2', { hasText: /^第 200 页$/u });
	/** How far the heading is from the top of the editor, in pixels, either way. */
	const fromTop = () => heading.evaluate((node) => Math.abs(Math.round(node.getBoundingClientRect().top - document.querySelector('.editor-scroll')!.getBoundingClientRect().top)));
	await page.locator('#editor-outline a', { hasText: /^第 200 页$/u }).evaluate((link: HTMLElement) => link.click());
	await expect.poll(fromTop).toBeLessThanOrEqual(1);
	await editor(page).hover();
	for (let step = 0; step < 8; step += 1) {
		await page.mouse.wheel(0, -250);
		await page.waitForTimeout(60);
	}
	await page.waitForTimeout(500);
	for (let step = 0; step < 8; step += 1) {
		await page.mouse.wheel(0, 250);
		await page.waitForTimeout(60);
	}
	await page.waitForTimeout(500);
	expect(await fromTop()).toBeLessThanOrEqual(2);
});
