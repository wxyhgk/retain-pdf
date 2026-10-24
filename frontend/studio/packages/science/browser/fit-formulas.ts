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
 * Keeps the display formulas under `root` fitted: those there, those that come, and when its width changes. Each is
 * measured as it comes near the screen, not all at once: measuring one lays it out, and a book has thousands, off
 * the screen and not laid out (content-visibility). Returns what stops it.
 */
export function keepFormulasFitted(root: HTMLElement): () => void {
	let width = root.clientWidth;
	const near = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				near.unobserve(entry.target);
				fitFormula(entry.target as HTMLElement);
			}
		},
		{ rootMargin: '100% 0px' },
	);
	/** To be fitted once near: observed afresh, so one already fitted is again (the width changed). */
	const watch = (displays: Iterable<HTMLElement>) => {
		for (const display of displays) {
			if (display.classList.contains('katex-broken')) continue;
			near.unobserve(display);
			near.observe(display);
		}
	};
	const resized = new ResizeObserver(() => {
		if (root.clientWidth === width) return;
		width = root.clientWidth;
		watch(root.querySelectorAll<HTMLElement>('.katex-display'));
	});
	resized.observe(root);
	// A formula drawn (or drawn again, as it is edited); not the size this sets, which changes no nodes.
	const added = new MutationObserver((changes) => {
		const displays = new Set<HTMLElement>();
		for (const change of changes) {
			// One drawn over before it came near is not waited for.
			for (const node of change.removedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				if (node.matches('.katex-display')) near.unobserve(node);
				else node.querySelectorAll('.katex-display').forEach((display) => near.unobserve(display));
			}
			for (const node of change.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				if (node.matches('.katex-display')) displays.add(node);
				else if (node.matches('.katex')) {
					const display = node.closest<HTMLElement>('.katex-display');
					if (display) displays.add(display);
				} else node.querySelectorAll<HTMLElement>('.katex-display').forEach((display) => displays.add(display));
			}
		}
		watch(displays);
	});
	added.observe(root, { childList: true, subtree: true });
	watch(root.querySelectorAll<HTMLElement>('.katex-display'));
	// Its fonts come later than its boxes: measured again once they are in.
	void document.fonts?.ready.then(() => watch(root.querySelectorAll<HTMLElement>('.katex-display')));
	return () => {
		near.disconnect();
		resized.disconnect();
		added.disconnect();
	};
}
