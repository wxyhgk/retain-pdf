/**
 * The AI panel floating (显示方式 › 悬浮, as Notion's floating AI chat): a box over the Studio, at its bottom right at
 * first, moved by the panel's bar, sized from any edge or corner, where it was left the next time.
 */

type Place = { left: number; top: number; width: number; height: number };

const KEPT = 'studio.ai.float';
const SMALLEST = { width: 320, height: 280 };
const MARGIN = 12;
const EDGES = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'] as const;

function fitted(place: Place): Place {
	const width = Math.min(Math.max(place.width, SMALLEST.width), innerWidth - 2 * MARGIN);
	const height = Math.min(Math.max(place.height, SMALLEST.height), innerHeight - 2 * MARGIN);
	return { width, height, left: Math.min(Math.max(place.left, MARGIN), innerWidth - MARGIN - width), top: Math.min(Math.max(place.top, MARGIN), innerHeight - MARGIN - height) };
}

function kept(): Place {
	try {
		const place = JSON.parse(localStorage.getItem(KEPT) ?? 'null') as Place | null;
		if (place && [place.left, place.top, place.width, place.height].every(Number.isFinite)) return fitted(place);
	} catch {
		// Not kept, or unreadable: where it starts.
	}
	const width = 420;
	const height = Math.min(640, innerHeight - 120);
	return fitted({ left: innerWidth - width - 24, top: innerHeight - height - 24, width, height });
}

function keep(place: Place): void {
	try {
		localStorage.setItem(KEPT, JSON.stringify(place));
	} catch {
		// Private windows may refuse storage: it opens where it starts.
	}
}

/** The box `box` (holding the panel when it floats), moved by `handle()` (the panel's bar) and sized from its grips. */
export function floatingBox(box: HTMLElement, handle: () => HTMLElement | null): { place(): void } {
	const put = (place: Place) => Object.assign(box.style, { left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px`, height: `${place.height}px` });
	const now = (): Place => ({ left: box.offsetLeft, top: box.offsetTop, width: box.offsetWidth, height: box.offsetHeight });
	/** Follows the pointer from where it went down until it is let go, `change` given how far it went. */
	const drag = (from: PointerEvent, target: HTMLElement, change: (start: Place, dx: number, dy: number) => Place) => {
		from.preventDefault();
		const start = now();
		target.setPointerCapture(from.pointerId);
		box.classList.add('is-moving');
		const move = (event: PointerEvent) => put(fitted(change(start, event.clientX - from.clientX, event.clientY - from.clientY)));
		const up = () => {
			target.removeEventListener('pointermove', move);
			box.classList.remove('is-moving');
			keep(now());
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', up, { once: true });
		target.addEventListener('pointercancel', up, { once: true });
	};
	box.addEventListener('pointerdown', (event) => {
		const bar = handle();
		const target = event.target as HTMLElement;
		if (event.button !== 0 || !bar?.contains(target) || target.closest('button, input, select, a')) return;
		drag(event, bar, (start, dx, dy) => ({ ...start, left: start.left + dx, top: start.top + dy }));
	});
	for (const edge of EDGES) {
		const grip = document.createElement('div');
		grip.className = 'ai-float-grip';
		grip.dataset.edge = edge;
		grip.addEventListener('pointerdown', (event) =>
			drag(event, grip, (start, dx, dy) => {
				let { left, top, width, height } = start;
				if (edge.includes('e')) width = start.width + dx;
				if (edge.includes('s')) height = start.height + dy;
				if (edge.includes('w')) {
					width = Math.max(SMALLEST.width, start.width - dx);
					left = start.left + start.width - width;
				}
				if (edge.includes('n')) {
					height = Math.max(SMALLEST.height, start.height - dy);
					top = start.top + start.height - height;
				}
				return { left, top, width, height };
			}),
		);
		box.append(grip);
	}
	window.addEventListener('resize', () => {
		if (!box.hidden) put(fitted(now()));
	});
	return {
		/** Put where it was left (or where it starts), fitted to the window as it is now. */
		place: () => put(kept()),
	};
}
