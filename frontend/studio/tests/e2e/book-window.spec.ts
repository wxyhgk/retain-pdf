import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// A book (more than 1500 formulas) is in the editor a window at a time (book-window.ts): scrolled through to its end
// and back, what is in the editor stays a few screens; an edit far down is saved in its place, the rest as it was.

const PAGE = (n: number) =>
	`\n## 第 ${n} 页\n\n${'在过渡态理论中，反应速率由鞍点处的自由能垒决定，振动频率给出指前因子。'.repeat(8)}其中 $E_a = ${n}.5$，$k = A e^{-E_a/RT}$，$\\nu_{${n}} = ${n * 3}$。\n\n${n % 3 ? '' : `$$\nk(T) = \\frac{k_B T}{h} e^{-\\Delta G/RT} = ${n}\n$$\n`}`;

test.beforeEach(() => resetFixture());

test('a book: a window of it in the editor, scrolled to its end and back; an edit far in saved where it is', async ({ page }) => {
	test.setTimeout(240_000);
	appendToFixture(Array.from({ length: 700 }, (_, index) => PAGE(index + 1)).join(''));
	const before = savedMarkdown();
	await openStudio(page);
	const blocks = () => editor(page).evaluate((element) => element.childElementCount);
	// A window: not the 1400 and more blocks of the whole.
	expect(await blocks()).toBeLessThan(400);
	await expect(editor(page).locator('h2', { hasText: /^第 700 页$/u })).toHaveCount(0);

	// Down to the end, a wheel at a time: the window moves, never all of it in the editor.
	await editor(page).hover();
	const last = editor(page).locator('h2', { hasText: /^第 700 页$/u });
	let most = 0;
	for (let step = 0; step < 400 && !(await last.count()); step += 1) {
		await page.mouse.wheel(0, 1600);
		await page.waitForTimeout(30);
		most = Math.max(most, await blocks());
	}
	await expect(last).toHaveCount(1);
	expect(most).toBeLessThan(600);
	await expect(editor(page).locator('h2', { hasText: /^第 1 页$/u })).toHaveCount(0);

	// An edit far in: the whole is saved, only that changed.
	const far = editor(page).locator('h2', { hasText: /^第 690 页$/u });
	await far.scrollIntoViewIfNeeded();
	await far.click();
	await page.keyboard.press('End');
	await page.keyboard.type('（读过）');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toBe(before.replace('## 第 690 页\n', '## 第 690 页（读过）\n'));

	// Back up to the start: the first page there again, where the page is still.
	const first = editor(page).locator('h2', { hasText: /^第 1 页$/u });
	for (let step = 0; step < 400 && !(await first.count()); step += 1) {
		await page.mouse.wheel(0, -1600);
		await page.waitForTimeout(30);
	}
	await expect(first).toHaveCount(1);
	await expect(editor(page).locator('h2', { hasText: /^第 690 页（读过）$/u })).toHaveCount(0);
});

test('a book\'s outline lists all its headings; one outside the window is gone to; opened again, it is where it was read', async ({ page }) => {
	test.setTimeout(180_000);
	appendToFixture(Array.from({ length: 700 }, (_, index) => PAGE(index + 1)).join(''));
	await openStudio(page);
	const links = page.locator('#editor-outline a');
	// The book's 700 pages, not the window's few.
	await expect.poll(() => links.count()).toBeGreaterThanOrEqual(700);
	const heading = editor(page).locator('h2', { hasText: /^第 600 页$/u });
	await expect(heading).toHaveCount(0);
	await links.filter({ hasText: /^第 600 页$/u }).evaluate((link: HTMLElement) => link.click());
	await expect(heading).toHaveCount(1);
	await expect.poll(() => heading.evaluate((element) => Math.abs(element.getBoundingClientRect().top - document.querySelector('.editor-scroll')!.getBoundingClientRect().top))).toBeLessThan(4);
	await expect(page.locator('#editor-outline a[aria-current]')).toHaveText('第 600 页');

	// Left there and opened again: at that page, not the start.
	await page.waitForTimeout(600);
	await editor(page).hover();
	await page.mouse.wheel(0, 40);
	await page.waitForTimeout(600);
	await page.reload();
	await expect(editor(page).locator('h2', { hasText: /^第 600 页$/u })).toBeInViewport();
	await expect(editor(page).locator('h2', { hasText: /^第 1 页$/u })).toHaveCount(0);
});
