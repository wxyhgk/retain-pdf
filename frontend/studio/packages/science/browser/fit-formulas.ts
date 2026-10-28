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

/**
 * Keeps the display formulas under `root` fitted: those there, those that come, and when its width changes. Only those
 * on the screen or near it, as it scrolls: measuring one lays it out, and a book has thousands, off the screen and not
 * laid out (content-visibility). They are found by halving their list, in page order (not watched one by one: the
 * browser would work out where each of thousands is at every frame of a scroll). Returns what stops it.
 */
/** How long a width stays unchanged before the formulas are fitted to it, in ms. */
const SETTLE = 150;

export function keepFormulasFitted(root: HTMLElement): () => void {
	let width = root.clientWidth;
	/** The formulas, in page order; null when they changed and are to be listed again. */
	let displays: HTMLElement[] | null = null;
	let fitted = new WeakSet<HTMLElement>();
	let frame = 0;
	// Where a formula is: its holder's place (the formula itself is hidden while its lines show).
	const placeOf = (display: HTMLElement) => (display.parentElement ?? display).getBoundingClientRect();
	const fitNear = () => {
		frame = 0;
		displays ??= [...root.querySelectorAll<HTMLElement>('.katex-display:not(.katex-broken)')];
		const all = displays;
		const margin = window.innerHeight;
		let low = 0;
		let high = all.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (placeOf(all[middle]!).bottom > -margin) high = middle;
			else low = middle + 1;
		}
		for (let index = low; index < all.length; index += 1) {
			const display = all[index]!;
			if (!display.isConnected) {
				displays = null;
				continue;
			}
			if (placeOf(display).top > window.innerHeight + margin) break;
			if (fitted.has(display)) continue;
			fitted.add(display);
			fitFormula(display);
		}
	};
	const soon = () => {
		frame ||= requestAnimationFrame(fitNear);
	};
	/** All to be fitted again (the width changed, the fonts came). */
	const again = () => {
		fitted = new WeakSet();
		soon();
	};
	// Fitted again once the width has settled: fitting each measures it, which lays out the page each time, so at every
	// step of a resize (a panel dragged, the window sized) it would take half a second.
	let settling = 0;
	const resized = new ResizeObserver(() => {
		if (root.clientWidth === width) return;
		width = root.clientWidth;
		clearTimeout(settling);
		settling = window.setTimeout(again, SETTLE);
	});
	resized.observe(root);
	// A formula drawn (or drawn again, as it is edited); not the size this sets, which changes no nodes.
	const added = new MutationObserver((changes) => {
		const drawn = changes.some((change) => [...change.addedNodes].some((node) => node instanceof Element && (node.matches('.katex-display, .katex') || node.querySelector('.katex-display'))));
		if (!drawn) return;
		displays = null;
		soon();
	});
	added.observe(root, { childList: true, subtree: true });
	// Scrolls of the page or of whatever holds `root` (scroll events do not bubble; they are caught on the way down).
	document.addEventListener('scroll', soon, { capture: true, passive: true });
	window.addEventListener('resize', soon);
	soon();
	// Its fonts come later than its boxes: measured again once they are in.
	void document.fonts?.ready.then(again);
	return () => {
		cancelAnimationFrame(frame);
		clearTimeout(settling);
		resized.disconnect();
		added.disconnect();
		document.removeEventListener('scroll', soon, { capture: true });
		window.removeEventListener('resize', soon);
	};
}
