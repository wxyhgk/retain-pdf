/**
 * Display formulas wider than their line: KaTeX cannot break one, so a long
 * one would scroll sideways. Instead, first its lines (`.katex-broken`, drawn
 * hidden after it: broken at its relations, line-breaks.mjs), then smaller,
 * down to 60 % of the text's size, no smaller (still readable); only past
 * that does it scroll.
 */

const SMALLEST = 0.6;

const fits = (display: HTMLElement) => {
	// `.katex` is as wide as its content, at least the line (global.css).
	const formula = display.querySelector<HTMLElement>(':scope > .katex');
	return !formula || !display.clientWidth || formula.scrollWidth <= display.clientWidth + 1;
};

/** Smaller until it fits, no smaller than SMALLEST. */
function shrink(display: HTMLElement): void {
	const formula = display.querySelector<HTMLElement>(':scope > .katex');
	if (!formula || !display.clientWidth) return;
	const scale = Math.max(SMALLEST, Math.floor((display.clientWidth / formula.scrollWidth) * 100) / 100);
	display.style.fontSize = `${scale}em`;
}

/** One display formula (`.katex-display`) fitted to the width it has: as written, in lines, or smaller. */
export function fitFormula(display: HTMLElement): void {
	if (display.classList.contains('katex-broken')) return;
	const next = display.nextElementSibling;
	const lines = next instanceof HTMLElement && next.classList.contains('katex-broken') ? next : null;
	display.hidden = false;
	display.style.fontSize = '';
	if (lines) lines.hidden = true;
	if (fits(display)) return;
	if (!lines) return shrink(display);
	display.hidden = true;
	lines.hidden = false;
	lines.style.fontSize = '';
	if (!fits(lines)) shrink(lines);
}

/** Keeps the display formulas under `root` fitted: those there, those that come, and when its width changes. Returns what stops it. */
export function keepFormulasFitted(root: HTMLElement): () => void {
	let frame = 0;
	let width = root.clientWidth;
	const fitAll = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			for (const display of root.querySelectorAll<HTMLElement>('.katex-display')) fitFormula(display);
		});
	};
	const resized = new ResizeObserver(() => {
		if (root.clientWidth === width) return;
		width = root.clientWidth;
		fitAll();
	});
	resized.observe(root);
	// A formula drawn (or drawn again, as it is edited); not the size this sets, which changes no nodes.
	const added = new MutationObserver((changes) => {
		if (changes.some((change) => [...change.addedNodes].some((node) => node instanceof Element && (node.matches('.katex-display, .katex') || node.querySelector('.katex-display'))))) fitAll();
	});
	added.observe(root, { childList: true, subtree: true });
	fitAll();
	// Its fonts come later than its boxes: measured again once they are in.
	void document.fonts?.ready.then(fitAll);
	return () => {
		cancelAnimationFrame(frame);
		resized.disconnect();
		added.disconnect();
	};
}
