/**
 * The outline at the editor's right edge, as the blog has it: a mark per
 * heading, the current one darker, and their titles on hover, each taking
 * the editor to its heading. It follows the article as it is edited.
 *
 * A book's (a window of it in the editor, book-window.ts): all its headings, not the window's; one outside the window
 * taken to by the window opened there first (`book.reveal`).
 */
export type OutlineBook = {
	/** The book's headings, all of them; null for an article held whole. */
	headings(): Array<{ level: number; text: string; at: number }> | null;
	/** Where its window starts (characters before it). */
	start(): number | null;
	/** Its window opened at `at`. */
	reveal(at: number): Promise<void>;
};

export function createOutline(scroller: HTMLElement, rail: HTMLElement, book?: OutlineBook) {
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
	 * near the screen (near-screen.ts), and one just opened is still drawing those far from it, which changes the
	 * heights round the heading, so a smooth scroll's end, worked out at the start, is off: there it goes at once,
	 * then again, as long as what is drawn round it moves it.
	 */
	function reach(heading: HTMLElement): void {
		if (!heading.closest('.is-long') && !heading.parentElement?.querySelector('.is-waiting')) {
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

	/** A book's headings, all of them (null: an article's, those in the editor), and how many are before its window. */
	let all: Array<{ level: number; text: string; at: number }> | null = null;
	let before = 0;

	function mark(): void {
		const here = current();
		const index = here ? headings.indexOf(here) + (all ? before : 0) : -1;
		[...list.children].forEach((item, at) => item.querySelector('a')?.toggleAttribute('aria-current', at === index));
		[...marks.children].forEach((line, at) => line.toggleAttribute('data-current', at === index));
	}

	function draw(): void {
		const found = [...scroller.querySelectorAll<HTMLElement>('.ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3')]
			.filter((heading) => heading.textContent?.trim());
		headings = found;
		all = book?.headings() ?? null;
		const start = book?.start() ?? 0;
		before = all ? all.filter((heading) => heading.at < start).length : 0;
		const listed = all ?? found.map((heading) => ({ level: Number(heading.tagName[1]), text: heading.textContent!.trim(), at: -1 }));
		// The body's highest heading is the outline's first level.
		const top = Math.min(...listed.map((heading) => heading.level));
		rail.hidden = listed.length < 2;
		list.replaceChildren(...listed.map((heading, index) => {
			const item = document.createElement('li');
			item.classList.toggle('child', heading.level > top);
			const link = document.createElement('a');
			link.href = '#';
			link.textContent = heading.text;
			link.addEventListener('click', (event) => {
				event.preventDefault();
				void go(index);
			});
			item.append(link);
			return item;
		}));
		marks.replaceChildren(...listed.map((heading) => {
			const line = document.createElement('i');
			line.classList.toggle('child', heading.level > top);
			return line;
		}));
		mark();
	}

	/** To the `index`th heading listed: in the editor, or (a book's, outside its window) once the window is there. */
	async function go(index: number): Promise<void> {
		if (!all) {
			if (headings[index]) reach(headings[index]!);
			return;
		}
		const shown = headings[index - before];
		const wanted = all[index]!;
		if (shown && shown.textContent?.trim() === wanted.text) {
			reach(shown);
			return;
		}
		await book!.reveal(wanted.at);
		draw();
		const there = headings.find((heading) => heading.textContent?.trim() === wanted.text);
		if (there) reach(there);
	}

	/** When the article began to change, since it was last drawn. */
	let since = 0;
	// Drawn a moment after the article last changed, or each second while it goes on changing (a long one comes in a
	// part at a time).
	new MutationObserver(() => {
		if (!timer) since = performance.now();
		window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			timer = 0;
			draw();
		}, Math.min(250, Math.max(0, since + 1000 - performance.now())));
	}).observe(scroller, { childList: true, subtree: true, characterData: true });
	scroller.addEventListener('scroll', mark, { passive: true });
	draw();
	return {
		/** Draws the outline now, not a moment after the article last changed. */
		draw,
	};
}
