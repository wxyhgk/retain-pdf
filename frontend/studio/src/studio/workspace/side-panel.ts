import { STUDIO_PANELS, type StudioPanel } from '@blog/kernel/ui.ts';

type PanelLayout = { open: boolean; tab: string; width: number };

const STORAGE_KEY = 'studio.side-panel';
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_LAYOUT: PanelLayout = { open: true, tab: 'files', width: 340 };
/** Below this the panel floats over the editor instead of taking a column. */
const NARROW = window.matchMedia('(max-width: 1100px)');

function clampWidth(width: number): number {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

/** As it was left; the tab may be a plugin's, shown once its plugin has put it in. */
function readLayout(): PanelLayout {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PanelLayout> | null;
		return {
			open: typeof saved?.open === 'boolean' ? saved.open : DEFAULT_LAYOUT.open,
			tab: typeof saved?.tab === 'string' && /^[a-z][\w-]*$/u.test(saved.tab) ? saved.tab : DEFAULT_LAYOUT.tab,
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

/** A tab and its pane; a plugin's is drawn the first time it is shown. */
type Tab = { tab: HTMLButtonElement; pane: HTMLElement; panel?: StudioPanel; drawn?: boolean; undraw?: (() => void) | void; onScreen?: boolean };

/**
 * The right column: the AI, the open article's files, a terminal and the
 * drive, as tabs that can be resized and collapsed, then the plugins' tabs
 * (`ctx.panels`, `setPanels`). The Studio's tabs' contents are `ai-panel.ts`,
 * `file-panel.ts`, `terminal.ts` and `drive-browser.ts`; `shown` is told which
 * of them is on screen, each time the panel is laid out.
 */
export function createSidePanel(shell: HTMLElement, { shown: onShown }: { shown?: (tab: string) => void } = {}) {
	const panel = shell.querySelector<HTMLElement>('#side-panel')!;
	const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-side-panel')!;
	const closeButton = panel.querySelector<HTMLButtonElement>('#close-side-panel')!;
	const resizer = panel.querySelector<HTMLElement>('.side-panel-resizer')!;
	const tabList = panel.querySelector<HTMLElement>('.side-tabs')!;
	// The Studio's own tabs (STUDIO_PANELS); the plugins' (`ctx.panels`) come after them.
	const tabs = new Map<string, Tab>(
		STUDIO_PANELS.map((name) => [name, { tab: panel.querySelector(`#side-tab-${name}`)!, pane: panel.querySelector(`#side-${name}`)! }]),
	);

	const layout = readLayout();

	/** The tab shown: the one chosen, or the files while it is not there (yet). */
	const shown = () => (tabs.has(layout.tab) ? layout.tab : 'files');

	/** Tells a plugin's pane it came on screen or left it, once per change. */
	function tellScreen(entry: Tab, onScreen: boolean): void {
		if (!entry.panel || Boolean(entry.onScreen) === onScreen) return;
		entry.onScreen = onScreen;
		try {
			if (onScreen) entry.panel.shown?.(entry.pane);
			else entry.panel.hidden?.(entry.pane);
		} catch (error) {
			console.error(`[plugins] 面板 ${entry.panel.key}`, error);
		}
	}

	/** A plugin's pane, filled by it; what goes wrong is said in the pane. */
	function draw(entry: Tab): void {
		if (entry.drawn || !entry.panel) return;
		entry.drawn = true;
		try {
			entry.undraw = entry.panel.draw(entry.pane);
		} catch (error) {
			console.error(`[plugins] 面板 ${entry.panel.key}`, error);
			const message = document.createElement('p');
			message.className = 'side-pane-error';
			message.textContent = `面板没能画出来：${error instanceof Error ? error.message : String(error)}`;
			entry.pane.replaceChildren(message);
		}
	}

	function applyLayout(): void {
		shell.style.setProperty('--panel-width', `${layout.width}px`);
		shell.classList.toggle('panel-collapsed', !layout.open);
		panel.inert = !layout.open;
		toggleButton.setAttribute('aria-pressed', String(layout.open));
		toggleButton.setAttribute('aria-label', layout.open ? '收起右侧面板' : '展开右侧面板');
		const current = shown();
		for (const [name, entry] of tabs) {
			const selected = name === current;
			entry.tab.setAttribute('aria-selected', String(selected));
			entry.tab.tabIndex = selected ? 0 : -1;
			entry.pane.hidden = !selected;
			if (selected && layout.open) draw(entry);
			if (selected && layout.open && !entry.panel) onShown?.(name);
			tellScreen(entry, selected && layout.open && entry.drawn === true);
		}
	}

	function update(change: Partial<PanelLayout>, persist = true): void {
		Object.assign(layout, change);
		applyLayout();
		if (persist) writeLayout(layout);
	}

	function bindTab(name: string, tab: HTMLButtonElement): void {
		tab.addEventListener('click', () => update({ tab: name }));
		tab.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			event.preventDefault();
			const order = [...tabs.keys()];
			const at = order.indexOf(name) + (event.key === 'ArrowRight' ? 1 : -1);
			const next = order[(at + order.length) % order.length]!;
			update({ tab: next });
			tabs.get(next)!.tab.focus();
		});
	}
	for (const [name, { tab }] of tabs) bindTab(name, tab);
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

	/** Takes a plugin's tab out, with what it drew. */
	function removeTab(name: string, entry: Tab): void {
		tabs.delete(name);
		try {
			if (typeof entry.undraw === 'function') entry.undraw();
		} catch (error) {
			console.error(`[plugins] 面板 ${name}`, error);
		}
		entry.tab.remove();
		entry.pane.remove();
	}

	return {
		/** Opens the panel on this tab; throws when there is none by this name. */
		show(tab: string): void {
			if (!tabs.has(tab)) throw new Error(`没有叫 ${tab} 的面板`);
			update({ open: true, tab });
		},
		/**
		 * The plugins' tabs are these now, in this order: those gone are taken
		 * out (with what they drew), new ones put in after the Studio's own.
		 * The tab chosen stays chosen, also while its plugin is away.
		 */
		setPanels(panels: StudioPanel[]): void {
			for (const [name, entry] of tabs) if (entry.panel && !panels.includes(entry.panel)) removeTab(name, entry);
			const close = tabList.querySelector('.side-close');
			for (const added of panels) {
				let entry = tabs.get(added.key);
				if (!entry) {
					const tab = document.createElement('button');
					tab.type = 'button';
					tab.id = `side-tab-plugin-${added.key}`;
					tab.setAttribute('role', 'tab');
					tab.setAttribute('aria-controls', `side-plugin-${added.key}`);
					tab.dataset.panel = added.key;
					tab.textContent = added.label;
					const pane = document.createElement('section');
					pane.id = `side-plugin-${added.key}`;
					pane.className = 'side-pane plugin-pane';
					pane.setAttribute('role', 'tabpanel');
					pane.setAttribute('aria-labelledby', tab.id);
					pane.hidden = true;
					panel.append(pane);
					entry = { tab, pane, panel: added };
					tabs.set(added.key, entry);
					bindTab(added.key, tab);
				}
				// In the order given, before ×.
				tabList.insertBefore(entry.tab, close);
			}
			// The arrow keys go through them in the same order.
			const ordered = [...tabs].filter(([, entry]) => !entry.panel).concat(panels.map((added) => [added.key, tabs.get(added.key)!]));
			tabs.clear();
			for (const [name, entry] of ordered) tabs.set(name, entry);
			applyLayout();
		},
	};
}
