/**
 * Keeps the text in view where it is when something above it changes height: a picture or a formula
 * drawn, a widget loaded, a code block put to sleep. Chrome does it by itself (scroll anchoring);
 * WebKit, which shows the Studio in the Mac app, doesn't, and the page jumps. Where the browser
 * doesn't, it is done here, much as Chrome does it: the first block in view is the anchor, and when
 * it moves by more than the reader scrolled, the scroll takes up the rest, before the page is drawn.
 */
/**
 * Told by what moved the text and put the scroll right itself (a book's window, a chunk put in above, studio-editor.ts):
 * the block it kept, and where on the screen it meant it to be (the scroll goes by whole pixels: what it could not put
 * right, put right later with the rest), not something to put back.
 */
export const ANCHORED = 'studio-anchored';
export type Anchored = { block: Element; top: number };

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
		const header = scroller.querySelector('.document-header');
		const headerBox = header?.getBoundingClientRect();
		if (header && headerBox && headerBox.height > 0 && headerBox.bottom > top) {
			anchor = header;
			anchorTop = headerBox.top;
			return;
		}
		const blocks = scroller.querySelector('.ProseMirror')?.children;
		if (!blocks?.length) return;
		// The blocks go down the page in order: halved till the first whose bottom is in view, not measured one by one
		// from the start (thousands, in a long article, at every scroll).
		let low = 0;
		let high = blocks.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (blocks[middle]!.getBoundingClientRect().bottom > top) high = middle;
			else low = middle + 1;
		}
		for (let index = low; index < blocks.length; index += 1) {
			const box = blocks[index]!.getBoundingClientRect();
			if (box.height > 0 && box.bottom > top) {
				anchor = blocks[index]!;
				anchorTop = box.top;
				return;
			}
		}
	}

	/**
	 * After a scroll or a change of size (both may come in one frame): puts back what the layout moved. The scroll goes
	 * by whole pixels: less than one left over is kept for the next time (each formula drawn above left some, and a
	 * few hundred of them moved the text by pixels).
	 */
	function settle(): void {
		let left = 0;
		const kept = anchor;
		// At the very top there is nothing to keep: what is above is the page's start (Chrome leaves it too).
		if (anchor?.isConnected && scroller.scrollTop > 0 && getComputedStyle(scroller).overflowAnchor !== 'auto') {
			const scrolled = scroller.scrollTop - anchorScrollTop;
			const moved = anchor.getBoundingClientRect().top - (anchorTop - scrolled);
			const before = scroller.scrollTop;
			if (Math.abs(moved) >= 1) scroller.scrollTop += moved;
			left = moved - (scroller.scrollTop - before);
		}
		choose();
		if (anchor === kept) anchorTop -= left;
	}

	/** Told where a block is meant to be (ANCHORED): that is what is kept from now on. */
	function told(event: Event): void {
		const meant = (event as CustomEvent<Anchored | undefined>).detail;
		choose();
		if (meant?.block.isConnected && meant.block === anchor) anchorTop = meant.top;
	}

	scroller.addEventListener('scroll', settle, { passive: true });
	scroller.addEventListener(ANCHORED, told);
	// Anything above the anchor changing height changes the height of one of these (the header, the
	// editor holding the article). Told after layout and before paint: the scroll is put right before
	// the jump is ever seen.
	const sizes = new ResizeObserver(settle);
	for (const child of scroller.children) sizes.observe(child);
	choose();
}
