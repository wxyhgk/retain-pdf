// 翻译 with its 笔记: RetainPDF's pages on the left, the note being written on the right, in
// the Studio's own editor; between them a line to drag (the width kept in this browser) and 收起笔记. Only in 翻译:
// the shell says `data-notes="open"`, and the page's CSS puts the two side by side (studio-page.css). A note's 书 are
// put beside it the same way (`flag: 'books'`, `data-books="open"`; book-tabs.ts), the note's width the same.
import { t } from '@blog/i18n/index.mjs';

const WIDTH_KEY = 'retainpdf-notes-width';
/** The note narrower than this, or the pages narrower than this, is not let happen while dragging. */
const NARROWEST = 320;

function keptWidth(): number | null {
	try {
		const width = Number(localStorage.getItem(WIDTH_KEY));
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
	const width = keptWidth();
	if (width) shell.style.setProperty('--notes-width', `${width}px`);
	const divider = document.createElement('div');
	divider.className = 'notes-divider';
	divider.setAttribute('role', 'separator');
	divider.setAttribute('aria-orientation', 'vertical');
	divider.setAttribute('aria-label', t('拖动改笔记的宽度'));
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
		const right = shell.querySelector<HTMLElement>('.workspace-main')!.getBoundingClientRect().right;
		const move = (moved: PointerEvent) => {
			const room = translateView.parentElement!.getBoundingClientRect().width;
			const next = Math.round(Math.min(Math.max(right - moved.clientX, NARROWEST), room - NARROWEST));
			shell.style.setProperty('--notes-width', `${next}px`);
		};
		const done = () => {
			divider.removeEventListener('pointermove', move);
			delete shell.dataset.resizingNotes;
			try {
				const kept = parseInt(shell.style.getPropertyValue('--notes-width'), 10);
				if (kept) localStorage.setItem(WIDTH_KEY, String(kept));
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
