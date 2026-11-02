/**
 * Where each article was being read, as SiYuan keeps it: going back to an article (from the tree, ‹ ›, a link) shows it
 * where it was left, not at its top. Kept as the block at the top of the editor and how far into it, not as a height:
 * a long article is drawn a part at a time, and its formulas as they come near (a height is not where it was till the
 * whole is drawn). Kept in this browser, for the last `KEPT` articles read.
 */
const KEY = 'studio.readingPlace';
const KEPT = 200;

type Place = { block: number; offset: number; at: number };

function read(): Record<string, Place> {
	try {
		const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return kept && typeof kept === 'object' ? kept : {};
	} catch {
		return {};
	}
}

function write(places: Record<string, Place>): void {
	const newest = Object.entries(places).sort(([, left], [, right]) => right.at - left.at).slice(0, KEPT);
	try {
		localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(newest)));
	} catch {
		// Not kept (a private window): from the top next time.
	}
}

export function createReadingPlace(scroller: HTMLElement) {
	let slug: string | null = null;
	/** Where the article being opened is to be shown, till it is, or the author moves in it first. */
	let wanted: Place | null = null;
	let timer = 0;
	const blocks = () => scroller.querySelector('.ProseMirror')?.children ?? null;

	/** The block at the top of the editor, and how far down it the top is. */
	function here(): Place | null {
		const shown = blocks();
		if (!shown?.length) return null;
		const top = scroller.getBoundingClientRect().top;
		for (let index = 0; index < shown.length; index += 1) {
			const box = shown[index]!.getBoundingClientRect();
			if (box.bottom > top) return { block: index, offset: Math.round(top - box.top), at: Date.now() };
		}
		return null;
	}

	function keep(): void {
		window.clearTimeout(timer);
		if (!slug || wanted) return;
		const place = here();
		if (!place) return;
		const places = read();
		// At the very top: nothing to keep.
		if (scroller.scrollTop < 8) delete places[slug];
		else places[slug] = place;
		write(places);
	}

	scroller.addEventListener('scroll', () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(keep, 300);
	}, { passive: true });
	// The author moves in it: where it was to be shown is theirs to say now.
	for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const) scroller.addEventListener(type, () => (wanted = null), { passive: true });

	return {
		/** Another article is about to be shown: where this one was read kept first. */
		leave(): void {
			keep();
			slug = null;
			wanted = null;
		},
		/** `next` is being opened: where it was left is looked up now (before anything scrolls it). */
		enter(next: string): void {
			slug = next;
			wanted = read()[next] ?? null;
		},
		/**
		 * Shown (its first part, or all of it): taken where it was left, if the block is there yet. Called again once a
		 * long article is all there; `done` then: what scrolls it from now on is kept.
		 */
		show(done = false): void {
			const place = wanted;
			const block = place ? (blocks()?.[place.block] as HTMLElement | undefined) : undefined;
			if (place && block) scroller.scrollTop += block.getBoundingClientRect().top - scroller.getBoundingClientRect().top + place.offset;
			if (done) wanted = null;
		},
	};
}
