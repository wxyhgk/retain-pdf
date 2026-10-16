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

	/** The heading the reader is in: the last one above the top of the view. */
	function current(): HTMLElement | undefined {
		const limit = scroller.getBoundingClientRect().top + 88;
		let found: HTMLElement | undefined;
		for (const heading of headings) {
			if (heading.getBoundingClientRect().top <= limit) found = heading;
		}
		return found ?? headings[0];
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
				heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
}
