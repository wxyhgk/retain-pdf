import { test } from '@playwright/test';
import { editFixture, editor, openStudio, resetFixture, saveStatus } from './studio.ts';

// How the Studio does with a book in one article (a 500-page OCR, say): how long it takes to open, to show each key
// as typed, how long it is held up once the typing stops (the edit made into Markdown and merged), and to save.
// It measures, it does not judge (the numbers depend on the machine): run it by itself, before and after a change,
//   E2E_PERF=1 E2E_ISOLATED=1 npx playwright test -c tests/e2e/playwright.config.ts long-article
test.skip(!process.env.E2E_PERF, 'measures only when asked (E2E_PERF=1)');
// Playwright's trace copies the whole page at each step: over a book, it would be most of what is measured.
test.use({ trace: 'off' });

/** About one page of OCR: Chinese text, a few inline formulas, now and then a display formula and a table. */
function page(n: number): string {
	const sentence = '在过渡态理论中，反应速率由鞍点处的自由能垒决定，振动频率给出指前因子，我们需要仔细检查每一个虚频。';
	const para = () => `${sentence.repeat(6)}其中 $E_a = ${n}.5\\,\\mathrm{kJ/mol}$，$k = A e^{-E_a/RT}$，$\\nu_{${n}} = ${n * 3}\\,\\mathrm{cm^{-1}}$。`;
	let out = `\n## 第 ${n} 页\n\n${para()}\n\n${para()}\n\n${para()}\n`;
	if (n % 2 === 0) out += `\n$$\nk(T) = \\frac{k_B T}{h} e^{-\\Delta G^{\\ddagger}/RT} = ${n}.0 \\times 10^{3}\\,\\mathrm{s^{-1}}\n$$\n`;
	if (n % 5 === 0) out += `\n| 物种 | 能量 / Eh | 频率 |\n|---|---|---|\n| R | -188.44 | 653 |\n| TS | -188.40 | -1123 |\n| P | -188.50 | 2472 |\n`;
	return out;
}

for (const pages of [200, 500]) {
	test(`${pages} pages`, async ({ page: browser }) => {
		test.setTimeout(600_000);
		resetFixture();
		editFixture((markdown) => markdown + Array.from({ length: pages }, (_, i) => page(i + 1)).join(''));
		const started = Date.now();
		await openStudio(browser);
		await editor(browser).locator('h2', { hasText: `第 ${pages} 页` }).waitFor({ timeout: 600_000 });
		const opened = Date.now() - started;
		// Typing in the last paragraph, as a person does (a key every 120 ms): from each key to the frame that shows it.
		await editor(browser).locator('> p').last().click();
		await browser.keyboard.press('End');
		await browser.evaluate(() => {
			const lat: number[] = ((window as any).__lat = []);
			document.addEventListener('keydown', () => {
				const t = performance.now();
				requestAnimationFrame(() => requestAnimationFrame(() => lat.push(performance.now() - t)));
			}, true);
		});
		await browser.evaluate(() => {
			const long: number[] = ((window as any).__long = []);
			new PerformanceObserver((list) => list.getEntries().forEach((entry) => long.push(entry.duration))).observe({ type: 'longtask', buffered: false });
		});
		await browser.keyboard.type('abcdefghijklmnopqrst', { delay: 120 });
		await browser.waitForTimeout(5000);
		const freezes = (await browser.evaluate(() => (window as any).__long as number[])).map(Math.round).sort((x, y) => y - x);
		const keys = (await browser.evaluate(() => (window as any).__lat as number[])).map(Math.round).sort((x, y) => x - y);
		const saveStart = Date.now();
		await browser.keyboard.press('ControlOrMeta+s');
		await saveStatus(browser).filter({ hasText: '已保存' }).waitFor({ timeout: 120_000 });
		const saved = Date.now() - saveStart;
		const size = await browser.evaluate(() => ({ nodes: document.querySelectorAll('.ProseMirror *').length, katex: document.querySelectorAll('.ProseMirror .katex').length }));
		console.log(`PERF ${pages} pages: open ${opened} ms, keys median ${keys[Math.floor(keys.length / 2)]} ms, slowest ${keys.at(-1)} ms; after the typing stops, frozen ${freezes.slice(0, 3).join(', ')} ms, save ${saved} ms, DOM ${size.nodes} nodes, ${size.katex} formulas`);
	});
}
