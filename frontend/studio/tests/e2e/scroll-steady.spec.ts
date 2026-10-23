import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editFixture, editor, openStudio, resetFixture, writeFixtureFile } from './studio.ts';

// The text being read stays where it is while things above it change: a code block put to sleep off screen, a
// widget loading, a picture drawn, a block selected. Chrome keeps it there by itself (scroll anchoring); WebKit,
// which shows the Studio in the Mac app, doesn't.

test.beforeEach(() => resetFixture());

const WIDGET = '```widget title="高的模块" height=300\n<div style="height: 520px">一个高的模块</div>\n```\n';
const PARAGRAPHS = Array.from({ length: 80 }, (_, i) => `第 ${i + 1} 段，用来把文章撑长。`).join('\n\n');

/** The fixture with a widget and a long run of paragraphs after it, scrolled to the middle of those. */
async function openLong(page: Page): Promise<void> {
	appendToFixture(`\n${WIDGET}\n${PARAGRAPHS}\n`);
	await openStudio(page);
	const frame = editor(page).locator('iframe.note-widget-frame');
	await frame.scrollIntoViewIfNeeded();
	await expect(frame).toBeVisible();
	await editor(page).locator('p', { hasText: /^第 40 段/ }).evaluate((p) => p.scrollIntoView({ block: 'center' }));
	await frames(page);
}

/** Waits for the page to be drawn twice: what was scrolled or resized has been seen to (scroll events come with a frame). */
const frames = (page: Page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/** Where the paragraph `第 n 段` is on the screen. */
const topOf = (page: Page, n: number) => editor(page).locator('p', { hasText: new RegExp(`^第 ${n} 段`) }).evaluate((p) => Math.round(p.getBoundingClientRect().top));

test('a code block put to sleep off screen keeps its height, and stays asleep', async ({ page }) => {
	await openLong(page);
	await editor(page).locator('iframe.note-widget-frame').evaluate((frame) => (frame.closest<HTMLElement>('.milkdown-code-block')!.dataset.watched = ''));
	const block = editor(page).locator('.milkdown-code-block[data-watched]');
	const awake = await block.evaluate((element) => Math.round(element.getBoundingClientRect().height));

	// Off screen for a while (5 s), it gives up its editor and shows its text instead…
	await expect(block.locator('.milkdown-code-block-placeholder')).toBeAttached({ timeout: 10_000 });
	// …in the space it had: what is around it doesn't move.
	expect(await block.evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(awake);
	// And, not having grown back into view, it is not woken again (it was, every 5 s, its widget loading each time).
	const wakings = await block.evaluate(
		(element) =>
			new Promise<number>((resolve) => {
				let count = 0;
				new MutationObserver(() => (count += element.querySelector('iframe') ? 1 : 0)).observe(element, { childList: true, subtree: true });
				setTimeout(() => resolve(count), 7000);
			}),
	);
	expect(wakings).toBe(0);

	// Back in view it wakes, as before.
	await block.scrollIntoViewIfNeeded();
	await expect(block.locator('iframe.note-widget-frame')).toBeVisible();
});

test('where the browser doesn’t anchor the scroll, the Studio does: text in view stays put when a block above changes height', async ({ page }) => {
	await openLong(page);
	// As in WebKit.
	await page.locator('.editor-scroll').evaluate((scroller) => (scroller.style.overflowAnchor = 'none'));
	await frames(page);
	const before = await topOf(page, 40);

	// The widget far above grows, as one does when it has loaded.
	await editor(page).locator('iframe.note-widget-frame').evaluate((frame) => ((frame as HTMLElement).style.height = '1200px'));
	await frames(page);
	expect(await topOf(page, 40)).toBe(before);

	// And shrinks.
	await editor(page).locator('iframe.note-widget-frame').evaluate((frame) => ((frame as HTMLElement).style.height = '100px'));
	await frames(page);
	expect(await topOf(page, 40)).toBe(before);

	// A block below the text in view changing doesn't move it either way, and a scroll by the reader is theirs.
	await page.locator('.editor-scroll').evaluate((scroller) => (scroller.scrollTop -= 300));
	await frames(page);
	expect(await topOf(page, 40)).toBe(before + 300);
});

test('selecting a formula or a picture whole doesn’t move the article (a heading first in it stays where it is)', async ({ page }) => {
	writeFixtureFile('img/plot.png', readFileSync(new URL('./fixtures/plot.png', import.meta.url)));
	editFixture((markdown) => markdown.replace('\n开头段落', '\n# 开头的标题\n\n![势能面](./img/plot.png){width=40%}\n\n开头段落'));
	await openStudio(page);
	const heading = editor(page).locator('h1', { hasText: '开头的标题' });
	const top = () => heading.evaluate((h) => Math.round(h.getBoundingClientRect().top));
	const before = await top();

	// A block selected whole: the caret's mark at the article's start goes away…
	await editor(page).locator('figure.pm-figure img').click();
	await frames(page);
	expect(await top()).toBe(before);
	await editor(page).locator('.pm-display-math-formula').first().click();
	await frames(page);
	expect(await top()).toBe(before);
	// …and back with the caret.
	await editor(page).locator('p', { hasText: '开头段落' }).click();
	await frames(page);
	expect(await top()).toBe(before);
});
