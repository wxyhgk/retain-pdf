export type SidePanelTab = 'files' | 'terminal';

type PanelLayout = { open: boolean; tab: SidePanelTab; width: number };

const STORAGE_KEY = 'studio.side-panel';
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_LAYOUT: PanelLayout = { open: true, tab: 'files', width: 340 };
/** Below this the panel floats over the editor instead of taking a column. */
const NARROW = window.matchMedia('(max-width: 1100px)');

function clampWidth(width: number): number {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

function readLayout(): PanelLayout {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PanelLayout> | null;
		return {
			open: typeof saved?.open === 'boolean' ? saved.open : DEFAULT_LAYOUT.open,
			tab: saved?.tab === 'terminal' ? 'terminal' : 'files',
			width: typeof saved?.width === 'number' ? clampWidth(saved.width) : DEFAULT_LAYOUT.width,
		};
	} catch {
		return { ...DEFAULT_LAYOUT };
	}
}

function writeLayout(layout: PanelLayout): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
	} catch {
		// Private windows may refuse storage; the layout then lasts for this visit only.
	}
}

/**
 * The right column: the open article's files and a terminal, as tabs that
 * can be resized and collapsed. The tabs' contents are `file-panel.ts` and
 * `terminal.ts`.
 */
export function createSidePanel(shell: HTMLElement) {
	const panel = shell.querySelector<HTMLElement>('#side-panel')!;
	const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-side-panel')!;
	const closeButton = panel.querySelector<HTMLButtonElement>('#close-side-panel')!;
	const resizer = panel.querySelector<HTMLElement>('.side-panel-resizer')!;
	const tabs = new Map<SidePanelTab, { tab: HTMLButtonElement; pane: HTMLElement }>([
		['files', { tab: panel.querySelector('#side-tab-files')!, pane: panel.querySelector('#side-files')! }],
		['terminal', { tab: panel.querySelector('#side-tab-terminal')!, pane: panel.querySelector('#side-terminal')! }],
	]);

	const layout = readLayout();

	function applyLayout(): void {
		shell.style.setProperty('--panel-width', `${layout.width}px`);
		shell.classList.toggle('panel-collapsed', !layout.open);
		panel.inert = !layout.open;
		toggleButton.setAttribute('aria-pressed', String(layout.open));
		toggleButton.setAttribute('aria-label', layout.open ? '收起右侧面板' : '展开右侧面板');
		for (const [name, { tab, pane }] of tabs) {
			const selected = name === layout.tab;
			tab.setAttribute('aria-selected', String(selected));
			tab.tabIndex = selected ? 0 : -1;
			pane.hidden = !selected;
		}
	}

	function update(change: Partial<PanelLayout>, persist = true): void {
		Object.assign(layout, change);
		applyLayout();
		if (persist) writeLayout(layout);
	}

	for (const [name, { tab }] of tabs) {
		tab.addEventListener('click', () => update({ tab: name }));
		tab.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			const next: SidePanelTab = name === 'files' ? 'terminal' : 'files';
			update({ tab: next });
			tabs.get(next)!.tab.focus();
		});
	}
	toggleButton.addEventListener('click', () => update({ open: !layout.open }));
	closeButton.addEventListener('click', () => update({ open: false }));
	resizer.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || NARROW.matches) return;
		event.preventDefault();
		resizer.setPointerCapture(event.pointerId);
		shell.classList.add('is-resizing');
		const right = shell.getBoundingClientRect().right;
		const move = (moveEvent: PointerEvent) => update({ width: clampWidth(right - moveEvent.clientX) }, false);
		const end = () => {
			resizer.removeEventListener('pointermove', move);
			shell.classList.remove('is-resizing');
			writeLayout(layout);
		};
		resizer.addEventListener('pointermove', move);
		resizer.addEventListener('pointerup', end, { once: true });
		resizer.addEventListener('pointercancel', end, { once: true });
	});
	resizer.addEventListener('dblclick', () => update({ width: DEFAULT_LAYOUT.width }));
	resizer.addEventListener('keydown', (event) => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		update({ width: clampWidth(layout.width + (event.key === 'ArrowLeft' ? 24 : -24)) });
	});

	// A floating panel starts closed on a narrow window, whatever was saved.
	if (NARROW.matches) layout.open = false;
	applyLayout();
}
