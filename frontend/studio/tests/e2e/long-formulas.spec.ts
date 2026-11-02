import { expect, test, type Locator, type Page } from '@playwright/test';

import { appendToFixture, openStudio, resetFixture } from './studio.ts';

// Display formulas wider than their line are shown in lines (at their relations, or a long sum at its + and −),
// and smaller if still too wide, not scrolled sideways (line-breaks.mjs, fit-formulas.ts). The blog's pages use the same
// fit-formulas.ts on what the build drew (packages/markdown/test: the lines drawn hidden after the formula).

const CHAIN = String.raw`g_x = 4(-1.953125) + 7.5 + 0.3125 = -7.8125 + 7.5 + 0.3125 = 0.3125 - 0.3125 + 0.0000 + 0.0000 + 0.0000 = 0`;
const SUM = String.raw`E(\zeta) = \frac{\zeta^2}{2} - Z\zeta + \frac{5}{8}\zeta + \sum_{i=1}^{N} \sum_{j>i}^{N} \frac{1}{r_{ij}} + \sum_{i}\left(-\frac{1}{2}\nabla_i^2 - \sum_A \frac{Z_A}{r_{iA}}\right) + \int \rho(\mathbf{r})\, v(\mathbf{r})\, d\mathbf{r} + E_{xc}[\rho]`;

const FORMULAS = `\n$$\n${CHAIN}\n$$\n\n$$\n${SUM}\n$$\n\n$$\nE = mc^2\n$$\n`;

test.beforeEach(() => {
	resetFixture();
	appendToFixture(FORMULAS);
});

/** What each display formula shows: as written or in lines, how big, and whether it still runs past its line. */
async function shown(page: Page, within: Locator) {
	await page.waitForTimeout(300);
	return within.locator('.katex-display:not(.katex-broken)').evaluateAll((displays) =>
		displays.map((display) => {
			const lines = display.nextElementSibling?.classList.contains('katex-broken') ? (display.nextElementSibling as HTMLElement) : null;
			const visible = lines && !lines.hidden ? lines : (display as HTMLElement);
			const formula = visible.querySelector<HTMLElement>(':scope > .katex')!;
			return { lines: visible === lines, size: visible.style.fontSize || '1', overflows: formula.scrollWidth > visible.clientWidth + 1 };
		}),
	);
}

test('in the Studio, formulas wider than the page are in lines, not scrolled; one that fits stays as written', async ({ page }) => {
	await page.setViewportSize({ width: 1000, height: 900 });
	await openStudio(page);
	const editor = page.locator('.editor-scroll');
	await editor.locator('.pm-display-math').last().scrollIntoViewIfNeeded();
	const [chain, sum, short] = (await shown(page, editor)).slice(-3);
	expect(chain).toMatchObject({ lines: true, overflows: false });
	expect(sum).toMatchObject({ lines: true, overflows: false });
	expect(short).toEqual({ lines: false, size: '1', overflows: false });
});
