/**
 * Keeps the text in view where it is when something above it changes height: a picture or a formula
 * drawn, a widget loaded, a code block put to sleep. Chrome does it by itself (scroll anchoring);
 * WebKit, which shows the Studio in the Mac app, doesn't, and the page jumps. Where the browser
 * doesn't, it is done here, much as Chrome does it: the first block in view is the anchor, and when
 * it moves by more than the reader scrolled, the scroll takes up the rest, before the page is drawn.
 */
export function anchorScroll(scroller: HTMLElement): void {
	let anchor: Element | null = null;
	/** Where the anchor was on the screen, and the scroll then. */
	let anchorTop = 0;
	let anchorScrollTop = 0;

	/** The first block of the article, or the page's header, whose bottom is in view. */
	function choose(): void {
		const top = scroller.getBoundingClientRect().top;
		anchor = null;
		anchorScrollTop = scroller.scrollTop;
		for (const block of scroller.querySelectorAll('.document-header, .ProseMirror > *')) {
			const box = block.getBoundingClientRect();
			if (box.height > 0 && box.bottom > top) {
				anchor = block;
				anchorTop = box.top;
				return;
			}
		}
	}

	/** After a scroll or a change of size (both may come in one frame): puts back what the layout moved. */
	function settle(): void {
		// At the very top there is nothing to keep: what is above is the page's start (Chrome leaves it too).
		if (anchor?.isConnected && scroller.scrollTop > 0 && getComputedStyle(scroller).overflowAnchor !== 'auto') {
			const scrolled = scroller.scrollTop - anchorScrollTop;
			const moved = anchor.getBoundingClientRect().top - (anchorTop - scrolled);
			if (Math.abs(moved) >= 1) scroller.scrollTop += moved;
		}
		choose();
	}

	scroller.addEventListener('scroll', settle, { passive: true });
	// Anything above the anchor changing height changes the height of one of these (the header, the
	// editor holding the article). Told after layout and before paint: the scroll is put right before
	// the jump is ever seen.
	const sizes = new ResizeObserver(settle);
	for (const child of scroller.children) sizes.observe(child);
	choose();
}
