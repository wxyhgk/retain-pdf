/**
 * The outline at the editor's right edge, as the blog has it: a mark per
 * heading, the current one darker, and their titles on hover, each taking
 * the editor to its heading. It follows the article as it is edited.
 */
export function createOutline(scroller: HTMLElement, rail: HTMLElement) {
	const list = rail.querySelector<HTMLOListElement>('ol')!;
	const marks = rail.querySelector<HTMLElement>('.outline-marks')!;
	let headings: HTMLElement[] = [];
	let timer = 0;

	/** The heading the reader is in: the last one above the top of the view (found by halving: a book has hundreds). */
	function current(): HTMLElement | undefined {
		const limit = scroller.getBoundingClientRect().top + 88;
		let low = 0;
		let high = headings.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (headings[middle]!.getBoundingClientRect().top <= limit) low = middle + 1;
			else high = middle;
		}
		return headings[low - 1] ?? headings[0];
	}

	/**
	 * Takes the editor to `heading`: smoothly, in an article drawn whole. A long one draws its formulas as they come
	 * near the screen (near-screen.ts), which changes the heights round the heading, so a smooth scroll's end, worked
	 * out at the start, is off: there it goes at once, then again, as long as what is drawn round it moves it.
	 */
	function reach(heading: HTMLElement): void {
		if (!heading.closest('.is-long')) {
			heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
			return;
		}
		let tries = 0;
		const go = () => {
			heading.scrollIntoView({ block: 'start' });
			const top = heading.getBoundingClientRect().top;
			requestAnimationFrame(() => {
				if (Math.abs(heading.getBoundingClientRect().top - top) > 1 && ++tries < 10) go();
			});
		};
		go();
	}

	function mark(): void {
		const here = current();
		headings.forEach((heading, index) => {
			const now = heading === here;
			list.children[index]?.querySelector('a')?.toggleAttribute('aria-current', now);
			marks.children[index]?.toggleAttribute('data-current', now);
		});
	}

	function draw(): void {
		const found = [...scroller.querySelectorAll<HTMLElement>('.ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3')]
			.filter((heading) => heading.textContent?.trim());
		// The body's highest heading is the outline's first level.
		const top = Math.min(...found.map((heading) => Number(heading.tagName[1])));
		headings = found;
		rail.hidden = found.length < 2;
		list.replaceChildren(...found.map((heading) => {
			const item = document.createElement('li');
			item.classList.toggle('child', Number(heading.tagName[1]) > top);
			const link = document.createElement('a');
			link.href = '#';
			link.textContent = heading.textContent!.trim();
			link.addEventListener('click', (event) => {
				event.preventDefault();
				reach(heading);
			});
			item.append(link);
			return item;
		}));
		marks.replaceChildren(...found.map((heading) => {
			const line = document.createElement('i');
			line.classList.toggle('child', Number(heading.tagName[1]) > top);
			return line;
		}));
		mark();
	}

	new MutationObserver(() => {
		window.clearTimeout(timer);
		timer = window.setTimeout(draw, 250);
	}).observe(scroller, { childList: true, subtree: true, characterData: true });
	scroller.addEventListener('scroll', mark, { passive: true });
	draw();
	return {
		/** Draws the outline now, not a moment after the article last changed. */
		draw,
	};
}
