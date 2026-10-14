import type { ArticleFiles } from '../types';

export type SidePanelTab = 'files' | 'terminal';

type PanelLayout = { open: boolean; tab: SidePanelTab; width: number };

const STORAGE_KEY = 'studio.side-panel';
const MIN_WIDTH = 260;
const MAX_WIDTH = 720;
const DEFAULT_LAYOUT: PanelLayout = { open: true, tab: 'files', width: 340 };
/** Below this the panel floats over the editor instead of taking a column. */
const NARROW = window.matchMedia('(max-width: 1100px)');

const FOLDERS: ReadonlyArray<{ key: keyof ArticleFiles; label: string; hint: string }> = [
	{ key: 'img', label: 'img', hint: '图片' },
	{ key: 'assets', label: 'assets', hint: '结构和数据文件' },
	{ key: 'ai', label: 'ai', hint: 'AI 工作区，不发布' },
];

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

function fileIcon(name: string): string {
	const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return '▣';
	if (['mol', 'sdf', 'xyz', 'pdb', 'mol2', 'cif', 'cube', 'gjf', 'com', 'smi', 'smiles'].includes(extension)) return '⬡';
	return '▤';
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/**
 * The right column: the open article's folder and a terminal, as tabs.
 * This is the layout only. The folder is listed read-only and the terminal
 * is a placeholder until they are wired to the dev server.
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
	const filesRoot = panel.querySelector<HTMLElement>('#files-root')!;
	const fileTree = panel.querySelector<HTMLElement>('#file-tree')!;
	const terminalCwd = panel.querySelector<HTMLElement>('#terminal-cwd')!;
	const cwdOptions = [...panel.querySelectorAll<HTMLButtonElement>('[data-cwd]')];

	const layout = readLayout();
	let articleSlug: string | null = null;
	let cwd: 'root' | 'article' = 'root';

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

	function renderTerminalCwd(): void {
		const article = articleSlug ? `blog/${articleSlug}/` : null;
		terminalCwd.textContent = cwd === 'article' && article ? article : '仓库根目录';
		for (const option of cwdOptions) {
			option.setAttribute('aria-checked', String(option.dataset.cwd === cwd));
			option.disabled = option.dataset.cwd === 'article' && !article;
		}
	}

	function renderFiles(files: ArticleFiles | null): void {
		fileTree.replaceChildren();
		if (!articleSlug || !files) {
			filesRoot.textContent = '未打开文章';
			fileTree.append(element('p', 'file-tree-empty', '打开一篇文章后，这里显示它的文件夹。'));
			return;
		}
		filesRoot.textContent = `blog/${articleSlug}/`;
		const list = element('ul', 'file-tree-list');
		list.setAttribute('role', 'tree');
		list.append(fileRow('index.md', '▤', 0, '正文'));
		for (const folder of FOLDERS) {
			const entries = [...files[folder.key]].sort((left, right) => left.localeCompare(right));
			const row = fileRow(`${folder.label}/`, '▾', 0, entries.length ? String(entries.length) : '空');
			row.classList.add('is-folder');
			row.title = folder.hint;
			list.append(row);
			for (const entry of entries) list.append(fileRow(entry, fileIcon(entry), 1));
		}
		fileTree.append(list);
	}

	function fileRow(name: string, icon: string, depth: number, meta?: string): HTMLLIElement {
		const row = element('li', 'file-row');
		row.setAttribute('role', 'treeitem');
		row.style.setProperty('--depth', String(depth));
		row.append(element('span', 'file-icon', icon), element('span', 'file-name', name));
		if (meta) row.append(element('span', 'file-meta', meta));
		return row;
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
	for (const option of cwdOptions) {
		option.addEventListener('click', () => {
			cwd = option.dataset.cwd === 'article' ? 'article' : 'root';
			renderTerminalCwd();
		});
	}

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
	renderFiles(null);
	renderTerminalCwd();

	return {
		/** Show the open article's folder; `null` when no article is open. */
		showArticle(slug: string | null, files: ArticleFiles | null): void {
			articleSlug = slug;
			renderFiles(files);
			renderTerminalCwd();
		},
	};
}
