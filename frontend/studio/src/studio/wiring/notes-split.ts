// 翻译 with its 笔记: RetainPDF's pages on the left, the note being written on the right, in
// the Studio's own editor; between them a line to drag (the width kept in this browser) and 收起笔记. Only in 翻译:
// the shell says `data-notes="open"`, and the page's CSS puts the two side by side (studio-page.css). A note's 书 are
// put beside it the same way (`flag: 'books'`, `data-books="open"`; book-tabs.ts), the note's width the same.
import { t } from '@blog/i18n/index.mjs';

/** The width kept: 书库's note's; the books' beside a note (on its right since 2026-11-05: a width of their own). */
const WIDTH_KEYS = { notes: 'retainpdf-notes-width', books: 'retainpdf-books-width' } as const;
/** The note narrower than this, or the pages narrower than this, is not let happen while dragging. */
const NARROWEST = 320;

function keptWidth(flag: 'notes' | 'books'): number | null {
	try {
		const width = Number(localStorage.getItem(WIDTH_KEYS[flag]));
		return Number.isFinite(width) && width >= NARROWEST ? width : null;
	} catch {
		return null;
	}
}

export function createNotesSplit(
	shell: HTMLElement,
	translateView: HTMLElement,
	host: { close(): void },
	{ flag = 'notes', closeLabel = t('收起笔记') }: { flag?: 'notes' | 'books'; closeLabel?: string } = {},
) {
	// The width set on the grid itself, not on the shell: a custom property changed on the shell is the style of all
	// under it worked out again (the note's every formula, a frame of 0.1–0.2 s in WebKit at each step of a drag);
	// on the grid, registered not to be inherited (studio-page.css @property), it is that one element's.
	const grid = shell.querySelector<HTMLElement>('.workspace-main')!;
	const width = keptWidth(flag);
	if (width) grid.style.setProperty('--notes-width', `${width}px`);
	const divider = document.createElement('div');
	divider.className = 'notes-divider';
	divider.setAttribute('role', 'separator');
	divider.setAttribute('aria-orientation', 'vertical');
	divider.setAttribute('aria-label', flag === 'books' ? t('拖动改书的宽度') : t('拖动改笔记的宽度'));
	const close = document.createElement('button');
	close.type = 'button';
	close.id = `${flag}-close`;
	close.className = 'notes-close';
	close.title = closeLabel;
	close.setAttribute('aria-label', closeLabel);
	close.textContent = '›';
	close.addEventListener('click', () => host.close());
	close.addEventListener('pointerdown', (event) => event.stopPropagation());
	divider.append(close);
	translateView.append(divider);

	// Dragged: the pointer kept by the line (not lost into the frame), the frame not taking it meanwhile.
	divider.addEventListener('pointerdown', (event) => {
		event.preventDefault();
		divider.setPointerCapture(event.pointerId);
		shell.dataset.resizingNotes = '';
		// The note laid out at the width it had till the line is let go: at each step a whole note laid out and painted
		// again (on a Retina screen, four times the pixels) was most of what made the drag stutter; cut off, or with room
		// beside it, meanwhile, laid out once at the end.
		const note = shell.querySelector<HTMLElement>('.editor-panel .editor-scroll');
		if (note) note.style.width = `${note.getBoundingClientRect().width}px`;
		const right = grid.getBoundingClientRect().right;
		const move = (moved: PointerEvent) => {
			const room = translateView.parentElement!.getBoundingClientRect().width;
			const next = Math.round(Math.min(Math.max(right - moved.clientX, NARROWEST), room - NARROWEST));
			grid.style.setProperty('--notes-width', `${next}px`);
		};
		const done = () => {
			divider.removeEventListener('pointermove', move);
			delete shell.dataset.resizingNotes;
			note?.style.removeProperty('width');
			try {
				const kept = parseInt(grid.style.getPropertyValue('--notes-width'), 10);
				if (kept) localStorage.setItem(WIDTH_KEYS[flag], String(kept));
			} catch {
				// Not kept: this time only.
			}
		};
		divider.addEventListener('pointermove', move);
		divider.addEventListener('lostpointercapture', done, { once: true });
	});

	return {
		get open(): boolean {
			return shell.dataset[flag] === 'open';
		},
		set open(open: boolean) {
			if (open) shell.dataset[flag] = 'open';
			else delete shell.dataset[flag];
		},
	};
}
