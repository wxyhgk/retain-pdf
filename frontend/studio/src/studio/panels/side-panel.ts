import { STUDIO_PANELS, type StudioPanel } from '@blog/kernel/ui.ts';
import { shell as shellState, type SideTab } from '../shell/shell-state.ts';
import { t } from '@blog/i18n/index.mjs';

type PanelLayout = { open: boolean; tab: string; width: number };

const STORAGE_KEY = 'studio.side-panel';
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_LAYOUT: PanelLayout = { open: true, tab: 'files', width: 340 };
/** Below this the panel floats over the editor instead of taking a column. */
const NARROW = window.matchMedia('(max-width: 1100px)');
/** The Studio's own tabs' names. */
const STUDIO_LABELS: Record<(typeof STUDIO_PANELS)[number], string> = { ai: 'AI', files: t('文件'), terminal: t('终端'), drive: t('资料库') };

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

/** A tab (the shell draws it: shell/SideTabs.tsx) and its pane; a plugin's is drawn the first time it is shown. */
type Tab = { tab: SideTab; pane: HTMLElement; panel?: StudioPanel; drawn?: boolean; undraw?: (() => void) | void; onScreen?: boolean };

/**
 * The right column: the AI, the open article's files, a terminal and the
 * drive, as tabs that can be resized and collapsed, then the plugins' tabs
 * (`ctx.panels`, `setPanels`). The Studio's tabs' contents are `ai-panel.ts`,
 * `file-panel.ts`, `terminal.ts` and `drive-browser.ts`; `shown` is told which
 * of them is on screen, each time the panel is laid out. The tabs, the toggle in the bar above and × are the
 * shell's (shell-state.ts); it calls `choose`, `toggle` and `close`.
 */
export function createSidePanel(shell: HTMLElement, { shown: onShown }: { shown?: (tab: string) => void } = {}) {
	const panel = shell.querySelector<HTMLElement>('#side-panel')!;
	const resizer = panel.querySelector<HTMLElement>('.side-panel-resizer')!;
	// The Studio's own tabs (STUDIO_PANELS); the plugins' (`ctx.panels`) come after them.
	const tabs = new Map<string, Tab>(
		STUDIO_PANELS.map((name) => [name, { tab: { key: name, label: STUDIO_LABELS[name], id: `side-tab-${name}`, controls: `side-${name}` }, pane: panel.querySelector(`#side-${name}`)! }]),
	);

	const layout = readLayout();

	/** Tabs whose pane is shown elsewhere for now (the AI tab's, whole in the middle: AI 问答): not shown here. */
	const lent = new Set<string>();

	/** The tab shown: the one chosen, or the files while it is not there (yet), or lent. */
	const shown = () => (tabs.has(layout.tab) && !lent.has(layout.tab) ? layout.tab : 'files');

	/** Tells a plugin's pane it came on screen or left it, once per change. */
	function tellScreen(entry: Tab, onScreen: boolean): void {
		if (!entry.panel || Boolean(entry.onScreen) === onScreen) return;
		entry.onScreen = onScreen;
		try {
			if (onScreen) entry.panel.shown?.(entry.pane);
			else entry.panel.hidden?.(entry.pane);
		} catch (error) {
			console.error(`[plugins] 面板 ${entry.panel.key}`, error); // i18n-ignore: developer log
		}
	}

	/** A plugin's pane, filled by it; what goes wrong is said in the pane. */
	function draw(entry: Tab): void {
		if (entry.drawn || !entry.panel) return;
		entry.drawn = true;
		try {
			entry.undraw = entry.panel.draw(entry.pane);
		} catch (error) {
			console.error(`[plugins] 面板 ${entry.panel.key}`, error); // i18n-ignore: developer log
			const message = document.createElement('p');
			message.className = 'side-pane-error';
			message.textContent = t('面板没能画出来：{error}', { error: error instanceof Error ? error.message : String(error) });
			entry.pane.replaceChildren(message);
		}
	}

	function applyLayout(): void {
		shell.style.setProperty('--panel-width', `${layout.width}px`);
		shell.classList.toggle('panel-collapsed', !layout.open);
		panel.inert = !layout.open;
		const current = shown();
		const listed = [...tabs].filter(([name]) => !lent.has(name)).map(([, entry]) => entry.tab);
		const before = shellState.get().tabs;
		const same = listed.length === before.length && listed.every((tab, at) => tab === before[at]);
		shellState.set({ panelOpen: layout.open, tab: current, ...(same ? {} : { tabs: listed }) });
		for (const [name, entry] of tabs) {
			if (lent.has(name)) continue;
			const selected = name === current;
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

	resizer.addEventListener('pointerdown', (event) => {
		if (event.button !== 0 || NARROW.matches) return;
		event.preventDefault();
		resizer.setPointerCapture(event.pointerId);
		shell.classList.add('is-resizing');
		const right = shell.getBoundingClientRect().right;
		// While dragged, what is in the middle keeps its width (shown more or less of, not laid out again: an article's
		// formulas laid out again at each step took half a second each); laid out once, let go.
		const held = [...shell.querySelectorAll<HTMLElement>('.editor-scroll, .chat-view')].filter((element) => element.offsetWidth > 0);
		for (const element of held) {
			const width = `${element.offsetWidth}px`;
			const height = `${element.offsetHeight}px`;
			// Its size fixed and its layout its own: what changes around it does not reach in.
			Object.assign(element.style, { width, minWidth: width, maxWidth: width, height, minHeight: height, maxHeight: height, contain: 'strict' });
		}
		// Only the width, once a frame: the panel's tabs and the shell's state once it is let go.
		let wanted = layout.width;
		let frame = 0;
		const move = (moveEvent: PointerEvent) => {
			wanted = clampWidth(right - moveEvent.clientX);
			// The columns themselves, not --panel-width: a custom property is inherited, so changing it has the style of
			// every element of the page worked out again (thousands, in an article with formulas: half a second a step).
			frame ||= requestAnimationFrame(() => {
				frame = 0;
				layout.width = wanted;
				shell.style.gridTemplateColumns = `var(--sidebar) minmax(0, 1fr) ${wanted}px`;
			});
		};
		const end = () => {
			resizer.removeEventListener('pointermove', move);
			cancelAnimationFrame(frame);
			for (const element of held) Object.assign(element.style, { width: '', minWidth: '', maxWidth: '', height: '', minHeight: '', maxHeight: '', contain: '' });
			shell.classList.remove('is-resizing');
			shell.style.gridTemplateColumns = '';
			update({ width: wanted });
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
			console.error(`[plugins] 面板 ${name}`, error); // i18n-ignore: developer log
		}
		entry.pane.remove();
	}

	return {
		/** The tab chosen (the shell's tabs). */
		choose: (tab: string): void => update({ tab }),
		/** The panel opened, or closed (the toggle in the bar). */
		toggle: (): void => update({ open: !layout.open }),
		close: (): void => update({ open: false }),
		/**
		 * The tab's pane shown elsewhere (`lent`: moved out of the panel by the caller), its tab away meanwhile, the
		 * files shown in its place when it was the one chosen; or back. The tab chosen stays chosen.
		 */
		lend(tab: string, isLent: boolean): void {
			const entry = tabs.get(tab);
			if (!entry) return;
			if (isLent) {
				lent.add(tab);
				entry.pane.hidden = false;
			} else {
				lent.delete(tab);
			}
			applyLayout();
		},
		/** Opens the panel on this tab; throws when there is none by this name. */
		show(tab: string): void {
			if (!tabs.has(tab)) throw new Error(t('没有叫 {tab} 的面板', { tab }));
			update({ open: true, tab });
		},
		/**
		 * The plugins' tabs are these now, in this order: those gone are taken
		 * out (with what they drew), new ones put in after the Studio's own.
		 * The tab chosen stays chosen, also while its plugin is away.
		 */
		setPanels(panels: StudioPanel[]): void {
			for (const [name, entry] of tabs) if (entry.panel && !panels.includes(entry.panel)) removeTab(name, entry);
			for (const added of panels) {
				if (tabs.has(added.key)) continue;
				const tab = { key: added.key, label: added.label, icon: added.icon, id: `side-tab-plugin-${added.key}`, controls: `side-plugin-${added.key}` };
				const pane = document.createElement('section');
				pane.id = tab.controls;
				pane.className = 'side-pane plugin-pane';
				pane.setAttribute('role', 'tabpanel');
				pane.setAttribute('aria-labelledby', tab.id);
				pane.hidden = true;
				panel.append(pane);
				tabs.set(added.key, { tab, pane, panel: added });
			}
			// In the order given, after the Studio's own (the arrow keys go through them so too).
			const ordered = [...tabs].filter(([, entry]) => !entry.panel).concat(panels.map((added) => [added.key, tabs.get(added.key)!]));
			tabs.clear();
			for (const [name, entry] of ordered) tabs.set(name, entry);
			applyLayout();
		},
	};
}
