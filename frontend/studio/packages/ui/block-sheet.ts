import './block-sheet.css';

/**
 * Where a block's details open: a large window over the page, the block's
 * kind and name at its top, its actions beside them, and its parts as tabs
 * (结果, 设置, 输出…). The card in the page stays short; double-clicking it
 * (in the Studio) or clicking it (on the blog) opens this. One sheet at a
 * time: opening another replaces what it shows.
 *
 * Esc closes it; ⌘/Ctrl+Enter runs the action marked `primary`.
 */

export type SheetTab = {
	key: string;
	label: string;
	/** Draws the tab into its panel when first shown; what it returns is called when the sheet closes. */
	draw(panel: HTMLElement): void | (() => void);
	/** A whole workspace (an editor): while it is shown the sheet is as large as the window, and the tab fills it edge to edge. */
	wide?: boolean;
};

export type SheetAction = {
	label: string;
	title?: string;
	primary?: boolean;
	/** Red: stopping or deleting something. */
	danger?: boolean;
	disabled?: boolean;
	run(): void;
};

export type SheetOptions = {
	kind: string;
	title: string;
	tabs: SheetTab[];
	/** The tab shown first; the first tab when not given. */
	initial?: string;
	actions?: SheetAction[];
	onClose?(): void;
};

export type OpenSheet = {
	/** Shows another tab. */
	select(key: string): void;
	/** Draws a tab again (its content changed), whether or not it is shown. */
	redraw(key: string): void;
	setTitle(title: string): void;
	setActions(actions: SheetAction[]): void;
	/** The tab shown. */
	current(): string;
	isOpen(): boolean;
	close(): void;
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	if (className) made.className = className;
	if (text !== undefined) made.textContent = text;
	return made;
}

let dialog: HTMLDialogElement | null = null;
/** Ends what the sheet shows now: its tabs' clean-ups and its owner's onClose. */
let ending: (() => void) | null = null;

function sheetDialog(): HTMLDialogElement {
	if (dialog?.isConnected) return dialog;
	dialog = element('dialog', 'block-sheet');
	dialog.setAttribute('aria-labelledby', 'block-sheet-title');
	dialog.addEventListener('click', (event) => {
		// A click on the backdrop, outside the window, closes it.
		if (event.target === dialog) dialog?.close();
	});
	dialog.addEventListener('close', () => {
		const end = ending;
		ending = null;
		end?.();
	});
	document.body.append(dialog);
	return dialog;
}

/** Opens the sheet with these tabs, replacing what it showed. */
export function openBlockSheet(options: SheetOptions): OpenSheet {
	const sheet = sheetDialog();
	ending?.();
	ending = null;

	const head = element('header', 'block-sheet-head');
	const kind = element('span', 'block-sheet-kind', options.kind);
	const title = element('strong', 'block-sheet-title', options.title);
	title.id = 'block-sheet-title';
	const actions = element('div', 'block-sheet-actions');
	const close = element('button', 'block-sheet-close', '×');
	close.type = 'button';
	close.setAttribute('aria-label', '关闭');
	close.addEventListener('click', () => sheet.close());
	head.append(kind, title, actions, close);

	const tabs = element('nav', 'block-sheet-tabs');
	tabs.setAttribute('role', 'tablist');
	tabs.hidden = options.tabs.length < 2;
	const body = element('div', 'block-sheet-body');
	const panels = new Map<string, HTMLElement>();
	const cleanups = new Map<string, () => void>();
	let shown = '';
	let actionList: SheetAction[] = [];

	const draw = (key: string) => {
		const tab = options.tabs.find((candidate) => candidate.key === key);
		const panel = panels.get(key);
		if (!tab || !panel) return;
		cleanups.get(key)?.();
		cleanups.delete(key);
		panel.replaceChildren();
		const cleanup = tab.draw(panel);
		if (cleanup) cleanups.set(key, cleanup);
		panel.dataset.drawn = 'true';
	};

	const select = (key: string) => {
		if (!panels.has(key)) return;
		shown = key;
		for (const button of tabs.querySelectorAll<HTMLButtonElement>('button')) {
			const selected = button.dataset.tab === key;
			button.setAttribute('aria-selected', String(selected));
			button.tabIndex = selected ? 0 : -1;
		}
		for (const [name, panel] of panels) panel.hidden = name !== key;
		sheet.classList.toggle('is-wide', Boolean(options.tabs.find((tab) => tab.key === key)?.wide));
		const panel = panels.get(key);
		if (panel && !panel.dataset.drawn) draw(key);
	};

	for (const tab of options.tabs) {
		const button = element('button', 'block-sheet-tab', tab.label);
		button.type = 'button';
		button.dataset.tab = tab.key;
		button.setAttribute('role', 'tab');
		button.addEventListener('click', () => select(tab.key));
		tabs.append(button);
		const panel = element('section', `block-sheet-panel${tab.wide ? ' is-fill' : ''}`);
		panel.setAttribute('role', 'tabpanel');
		panel.dataset.tab = tab.key;
		panel.hidden = true;
		panels.set(tab.key, panel);
		body.append(panel);
	}
	tabs.addEventListener('keydown', (event) => {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		const keys = options.tabs.map((tab) => tab.key);
		const next = keys[(keys.indexOf(shown) + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
		select(next);
		tabs.querySelector<HTMLButtonElement>(`button[data-tab="${next}"]`)?.focus();
	});

	const setActions = (list: SheetAction[]) => {
		actionList = list;
		actions.replaceChildren(...list.map((action) => {
			const button = element('button', `block-sheet-action${action.primary ? ' is-primary' : ''}${action.danger ? ' is-danger' : ''}`, action.label);
			button.type = 'button';
			button.disabled = Boolean(action.disabled);
			if (action.title) button.title = action.title;
			button.addEventListener('click', () => action.run());
			return button;
		}));
	};
	setActions(options.actions ?? []);

	const keys = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
		const primary = actionList.find((action) => action.primary && !action.disabled);
		if (!primary) return;
		event.preventDefault();
		primary.run();
	};
	sheet.addEventListener('keydown', keys);

	sheet.replaceChildren(head, tabs, body);
	let open = true;
	ending = () => {
		open = false;
		sheet.removeEventListener('keydown', keys);
		for (const cleanup of cleanups.values()) cleanup();
		cleanups.clear();
		options.onClose?.();
	};
	select(options.initial && panels.has(options.initial) ? options.initial : options.tabs[0]?.key ?? '');
	if (!sheet.open) sheet.showModal();
	// Focus on the window, not on its first control: Esc and ⌘Enter work at once, and nothing is typed into by accident.
	sheet.focus();

	return {
		select,
		redraw: (key) => {
			if (!open) return;
			const panel = panels.get(key);
			if (!panel) return;
			if (shown === key) draw(key);
			else delete panel.dataset.drawn;
		},
		setTitle: (text) => {
			title.textContent = text;
		},
		setActions: (list) => {
			if (open) setActions(list);
		},
		current: () => shown,
		isOpen: () => open,
		close: () => {
			if (open) sheet.close();
		},
	};
}
