import {
	chooseDriveFolder,
	createDriveFolder,
	driveFileUrl,
	driveInfo,
	listDrive,
	moveDriveFile,
	restoreDriveFile,
	revealDriveFile,
	setDriveFolder,
	trashDriveFile,
	uploadDriveFile,
	type DriveEntry,
	type DriveInfo,
} from '../api/client';
import { officeKind } from '@blog/office/kinds.mjs';
import { openOfficeFile } from '@blog/office/viewer.ts';
import { DRIVE_DRAG_TYPE, extension, fileName, parentPath } from './article-files';
import { showContextMenu, type MenuItem } from '../common/context-menu';
import { formatSize } from './file-tree';
import { showToast } from '../common/toast';
import './drive.css';

/**
 * The drive (资料库, drive.mjs) as a file browser: its folders one at a
 * time, files opened in the page (office files) or a new tab, uploads
 * dropped in, and the usual renaming, moving and trashing. Shown as a page
 * of its own (`page`) and, smaller, in the side panel (`pane`), from where
 * a file is dragged into the article; one change shows in both.
 */

export type DriveBrowserHost = {
	/** The article open in the editor, to put files into; null with none. */
	article(): { slug: string; title: string } | null;
	/** Copies a file of the drive into the article and puts it where the caret is. */
	insertIntoArticle(path: string): Promise<void>;
	/** The browser changed the drive (it shows that itself): the other one shows it too. */
	changed(): void;
	/** Asks the terminal's AI about a file: its path typed in, for the author to finish. */
	askAI(path: string): void;
	/** The folder shown changed (the page keeps it in the address). */
	navigated?(folder: string): void;
};

/** A short mark for what kind of file this is, drawn on its icon. */
function typeMark(path: string): string {
	const kind = officeKind(path);
	if (kind === 'document') return 'DOC';
	if (kind === 'slides') return 'PPT';
	if (kind === 'sheet') return 'XLS';
	return extension(path).slice(0, 4).toUpperCase();
}

const DATE = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const OLD_DATE = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });

function when(modified: number): string {
	const date = new Date(modified);
	return (date.getFullYear() === new Date().getFullYear() ? DATE : OLD_DATE).format(date);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const made = document.createElement(tag);
	if (className) made.className = className;
	if (text) made.textContent = text;
	return made;
}

function button(label: string, title: string): HTMLButtonElement {
	const made = element('button', 'drive-button', label);
	made.type = 'button';
	made.title = title;
	made.setAttribute('aria-label', title);
	return made;
}

const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);
const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function createDriveBrowser(root: HTMLElement, host: DriveBrowserHost, { mode }: { mode: 'page' | 'pane' }) {
	let info: DriveInfo | null = null;
	let folder = '';
	let entries: DriveEntry[] = [];
	let selected: string | null = null;
	/** Bumped by every listing: an older one that answers late is dropped. */
	let listing = 0;

	root.classList.add('drive', `drive--${mode}`);
	const bar = element('header', 'drive-bar');
	const crumbs = element('nav', 'drive-crumbs');
	crumbs.setAttribute('aria-label', '资料库路径');
	const actions = element('div', 'drive-actions');
	const upload = button('⤒', '上传文件到这个文件夹；也可以直接把文件拖进来');
	const newFolder = button('＋', '新建文件夹');
	const refresh = button('↻', '重新读取');
	const reveal = button('◳', '在 Finder 中显示');
	if (mode === 'page') {
		reveal.textContent = '在 Finder 中显示';
		upload.textContent = '上传';
		newFolder.textContent = '新建文件夹';
	}
	actions.append(upload, newFolder, refresh, reveal);
	bar.append(crumbs, actions);
	const setup = element('div', 'drive-setup');
	const list = element('div', 'drive-list');
	list.setAttribute('role', 'listbox');
	list.setAttribute('aria-label', '资料库里的文件');
	list.tabIndex = 0;
	const status = element('p', 'drive-status');
	status.setAttribute('role', 'status');
	status.setAttribute('aria-live', 'polite');
	const picker = element('input');
	picker.type = 'file';
	picker.multiple = true;
	picker.hidden = true;
	root.replaceChildren(bar, setup, list, status, picker);

	function say(text: string, kind: 'busy' | 'error' | '' = ''): void {
		status.textContent = text;
		status.dataset.kind = kind;
	}

	function showSetup(): void {
		bar.hidden = true;
		list.hidden = true;
		setup.hidden = false;
		const intro = element('p', '', '资料库是你电脑上的一个文件夹，比如放在 iCloud 云盘或 Dropbox 里，由它们负责同步。Studio 在这里浏览、预览里面的文件，并把它们用进文章。');
		const choose = element('button', 'drive-primary', '选择文件夹…');
		choose.type = 'button';
		const typed = element('form', 'drive-typed');
		const input = element('input');
		input.type = 'text';
		input.placeholder = '或者输入文件夹的完整路径，如 /Users/me/Library/Mobile Documents/com~apple~CloudDocs/资料';
		input.setAttribute('aria-label', '资料库文件夹路径');
		const use = element('button', 'drive-button', '使用');
		use.type = 'submit';
		typed.append(input, use);
		const use_ = async (task: () => Promise<DriveInfo>) => {
			say('正在设置…', 'busy');
			try {
				const chosen = await task();
				if (chosen.cancelled) return say('');
				info = chosen;
				say('');
				host.changed();
				await open('');
			} catch (error) {
				say(message(error, '设置失败'), 'error');
			}
		};
		choose.addEventListener('click', () => void use_(chooseDriveFolder));
		typed.addEventListener('submit', (event) => {
			event.preventDefault();
			if (input.value.trim()) void use_(() => setDriveFolder(input.value.trim()));
		});
		setup.replaceChildren(element('h2', '', '选择资料库文件夹'), intro, choose, typed);
	}

	function drawCrumbs(): void {
		const parts = folder ? folder.split('/') : [];
		const items = [{ label: info?.name ?? '资料库', path: '' }, ...parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join('/') }))];
		crumbs.replaceChildren(
			...items.flatMap((item, index) => {
				const link = element('button', 'drive-crumb', item.label);
				link.type = 'button';
				link.dataset.path = item.path;
				if (index === items.length - 1) link.setAttribute('aria-current', 'page');
				link.addEventListener('click', () => void open(item.path));
				return index ? [element('span', 'drive-crumb-separator', '/'), link] : [link];
			}),
		);
	}

	function row(entry: DriveEntry): HTMLElement {
		const item = element('div', 'drive-row');
		item.setAttribute('role', 'option');
		item.dataset.path = entry.path;
		item.dataset.kind = entry.kind;
		item.draggable = true;
		item.tabIndex = -1;
		item.setAttribute('aria-selected', String(entry.path === selected));
		item.title = entry.path;
		const icon = element('span', 'drive-icon');
		icon.dataset.kind = entry.kind;
		if (entry.kind === 'file') icon.textContent = typeMark(entry.path);
		item.append(icon, element('span', 'drive-name', fileName(entry.path)));
		if (mode === 'page') {
			item.append(element('span', 'drive-date', when(entry.modified)), element('span', 'drive-size', entry.kind === 'file' ? formatSize(entry.size ?? 0) : ''));
		}
		return item;
	}

	function draw(): void {
		drawCrumbs();
		if (!entries.length) {
			list.replaceChildren(element('p', 'drive-empty', '这个文件夹是空的。把文件拖到这里上传。'));
			return;
		}
		const rows = entries.map(row);
		if (mode === 'page') {
			const head = element('div', 'drive-row drive-head');
			head.setAttribute('aria-hidden', 'true');
			head.append(element('span'), element('span', 'drive-name', '名称'), element('span', 'drive-date', '修改时间'), element('span', 'drive-size', '大小'));
			list.replaceChildren(head, ...rows);
		} else list.replaceChildren(...rows);
	}

	/** Shows `next`, read afresh. */
	async function open(next: string, { quiet = false } = {}): Promise<void> {
		const at = ++listing;
		try {
			info ??= await driveInfo();
			if (at !== listing) return;
			if (!info.root) return showSetup();
			setup.hidden = true;
			bar.hidden = false;
			list.hidden = false;
			reveal.hidden = info.fixed;
			if (!quiet) say('正在读取…', 'busy');
			const read = await listDrive(next);
			if (at !== listing) return;
			if (next !== folder) selected = null;
			folder = next;
			entries = read;
			if (selected && !entries.some((entry) => entry.path === selected)) selected = null;
			say('');
			draw();
			host.navigated?.(folder);
		} catch (error) {
			if (at !== listing) return;
			// The folder went away (moved in Finder, trashed from the other browser): its parent instead.
			if (next && /不存在/u.test(message(error, ''))) return open(parentPath(next), { quiet });
			say(message(error, '读取资料库失败'), 'error');
		}
	}

	function entryAt(target: EventTarget | null): DriveEntry | null {
		const path = target instanceof Element ? target.closest<HTMLElement>('.drive-row:not(.drive-head)')?.dataset.path : undefined;
		return entries.find((entry) => entry.path === path) ?? null;
	}

	function select(path: string | null): void {
		selected = path;
		for (const item of list.querySelectorAll<HTMLElement>('.drive-row:not(.drive-head)')) item.setAttribute('aria-selected', String(item.dataset.path === path));
	}

	/** A folder opened, a file shown: office files in the page, the rest in a new tab. */
	function activate(entry: DriveEntry): void {
		if (entry.kind === 'directory') return void open(entry.path);
		const url = driveFileUrl(entry.path);
		if (officeKind(entry.path)) void openOfficeFile(url, fileName(entry.path));
		else window.open(url, '_blank', 'noopener');
	}

	/** Runs a change, says how it went, and shows the drive as it is after. */
	async function change(busy: string, task: () => Promise<string | void>): Promise<void> {
		say(busy, 'busy');
		try {
			const done = await task();
			await open(folder, { quiet: true });
			say(done ?? '');
			host.changed();
		} catch (error) {
			say(message(error, '操作失败'), 'error');
			await open(folder, { quiet: true });
		}
	}

	function rename(entry: DriveEntry, then?: () => void): void {
		const item = list.querySelector<HTMLElement>(`.drive-row[data-path="${CSS.escape(entry.path)}"]`);
		const name = item?.querySelector<HTMLElement>('.drive-name');
		if (!item || !name) return;
		const input = element('input', 'drive-name-input');
		const old = fileName(entry.path);
		input.value = old;
		input.setAttribute('aria-label', '新名称');
		name.replaceWith(input);
		item.draggable = false;
		input.focus();
		const dot = entry.kind === 'file' ? old.lastIndexOf('.') : -1;
		input.setSelectionRange(0, dot > 0 ? dot : old.length);
		let done = false;
		const finish = (keep: boolean) => {
			if (done) return;
			done = true;
			const next = input.value.trim();
			if (!keep || !next || next === old) {
				input.replaceWith(name);
				item.draggable = true;
				then?.();
				return;
			}
			void change(`正在重命名…`, async () => {
				const { path } = await moveDriveFile(entry.path, join(parentPath(entry.path), next));
				selected = path;
				return `已重命名为 ${next}`;
			}).then(() => then?.());
		};
		input.addEventListener('keydown', (event) => {
			event.stopPropagation();
			if (event.key === 'Enter' && !event.isComposing) finish(true);
			if (event.key === 'Escape') finish(false);
		});
		input.addEventListener('blur', () => finish(true));
	}

	function trash(entry: DriveEntry): void {
		void change(`正在删除 ${fileName(entry.path)}…`, async () => {
			const { trashed } = await trashDriveFile(entry.path);
			showToast(`已把 ${fileName(entry.path)} 移到资料库的回收站`, {
				action: {
					label: '撤销',
					run: () => void change('正在放回…', async () => {
						await restoreDriveFile(trashed);
						return `已放回 ${fileName(entry.path)}`;
					}),
				},
			});
		});
	}

	async function createFolder(): Promise<void> {
		const names = new Set(entries.map((entry) => fileName(entry.path)));
		let name = '新建文件夹';
		for (let count = 2; names.has(name); count += 1) name = `新建文件夹 ${count}`;
		await change('正在新建文件夹…', async () => {
			const { path } = await createDriveFolder(join(folder, name));
			selected = path;
		});
		const made = entries.find((entry) => entry.path === selected);
		if (made) rename(made);
	}

	function uploadFiles(files: readonly File[], into: string): void {
		if (!files.length) return;
		void change(files.length === 1 ? `正在上传 ${files[0]!.name}…` : `正在上传 ${files.length} 个文件…`, async () => {
			for (const [index, file] of files.entries()) {
				await uploadDriveFile(into, file, {
					onProgress: (loaded, total) => say(`正在上传 ${file.name}（${index + 1}/${files.length}）${total ? ` ${Math.round((loaded / total) * 100)}%` : ''}`, 'busy'),
				});
			}
			return files.length === 1 ? `已上传 ${files[0]!.name}` : `已上传 ${files.length} 个文件`;
		});
	}

	function menu(entry: DriveEntry | null, at: { x: number; y: number } | HTMLElement): void {
		const article = host.article();
		const items: MenuItem[] = [];
		if (entry) {
			items.push({ label: entry.kind === 'directory' ? '打开' : officeKind(entry.path) ? '预览' : '在新标签页打开', action: () => activate(entry) });
			if (entry.kind === 'file' && article) {
				items.push({ label: `插入到《${article.title}》`, action: () => void insert(entry) });
			}
			if (entry.kind === 'file') items.push({ label: '问 AI', hint: '终端', action: () => host.askAI(entry.path) });
			items.push('separator', { label: '重命名', hint: 'F2', action: () => rename(entry) });
			if (!info?.fixed) items.push({ label: '在 Finder 中显示', action: () => void revealDriveFile(entry.path).catch((error) => say(message(error, '打不开'), 'error')) });
			items.push({ label: '复制路径', action: () => void navigator.clipboard.writeText(`${info?.root ?? ''}/${entry.path}`).then(() => say('已复制路径')) });
			items.push('separator', { label: '移到回收站', danger: true, action: () => trash(entry) });
		} else {
			items.push({ label: '上传文件…', action: () => picker.click() }, { label: '新建文件夹', action: () => void createFolder() }, { label: '重新读取', action: () => void open(folder) });
		}
		showContextMenu(items, at);
	}

	async function insert(entry: DriveEntry): Promise<void> {
		say(`正在把 ${fileName(entry.path)} 放进文章…`, 'busy');
		try {
			await host.insertIntoArticle(entry.path);
			say(`已复制到文章并插入：${fileName(entry.path)}`);
		} catch (error) {
			say(message(error, '插入失败'), 'error');
		}
	}

	list.addEventListener('click', (event) => {
		const entry = entryAt(event.target);
		select(entry?.path ?? null);
	});
	list.addEventListener('dblclick', (event) => {
		const entry = entryAt(event.target);
		if (entry) activate(entry);
	});
	list.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		const entry = entryAt(event.target);
		if (entry) select(entry.path);
		menu(entry, { x: event.clientX, y: event.clientY });
	});
	list.addEventListener('keydown', (event) => {
		if ((event.target as HTMLElement).tagName === 'INPUT') return;
		const index = entries.findIndex((entry) => entry.path === selected);
		const current = entries[index] ?? null;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = entries[Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
			if (next) {
				select(next.path);
				list.querySelector<HTMLElement>(`.drive-row[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: 'nearest' });
			}
		} else if (event.key === 'Enter' && current) {
			event.preventDefault();
			activate(current);
		} else if (event.key === 'F2' && current) {
			event.preventDefault();
			rename(current);
		} else if ((event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey)) && current) {
			event.preventDefault();
			trash(current);
		} else if (event.key === 'Backspace' && folder) {
			event.preventDefault();
			void open(parentPath(folder));
		}
	});

	// Dragging: a row out (into the article, or onto a folder here), files in from the desktop.
	list.addEventListener('dragstart', (event) => {
		const entry = entryAt(event.target);
		if (!entry || !event.dataTransfer) return;
		event.dataTransfer.setData(DRIVE_DRAG_TYPE, entry.path);
		event.dataTransfer.setData('text/plain', fileName(entry.path));
		event.dataTransfer.effectAllowed = 'copyMove';
	});
	const dropFolder = (target: EventTarget | null): string => {
		const entry = entryAt(target);
		return entry?.kind === 'directory' ? entry.path : folder;
	};
	list.addEventListener('dragover', (event) => {
		const types = event.dataTransfer?.types ?? [];
		if (!types.includes('Files') && !types.includes(DRIVE_DRAG_TYPE)) return;
		event.preventDefault();
		event.dataTransfer!.dropEffect = types.includes('Files') ? 'copy' : 'move';
		for (const item of list.querySelectorAll('.is-drop-target')) item.classList.remove('is-drop-target');
		const entry = entryAt(event.target);
		(entry?.kind === 'directory' ? list.querySelector(`.drive-row[data-path="${CSS.escape(entry.path)}"]`) : list)?.classList.add('is-drop-target');
	});
	list.addEventListener('dragleave', (event) => {
		if (!list.contains(event.relatedTarget as Node | null)) for (const item of [list, ...list.querySelectorAll('.is-drop-target')]) item.classList.remove('is-drop-target');
	});
	list.addEventListener('drop', (event) => {
		for (const item of [list, ...list.querySelectorAll('.is-drop-target')]) item.classList.remove('is-drop-target');
		const transfer = event.dataTransfer;
		if (!transfer) return;
		const into = dropFolder(event.target);
		const moved = transfer.getData(DRIVE_DRAG_TYPE);
		if (moved) {
			event.preventDefault();
			if (parentPath(moved) === into || into === moved || into.startsWith(`${moved}/`)) return;
			void change(`正在移动 ${fileName(moved)}…`, async () => {
				await moveDriveFile(moved, join(into, fileName(moved)));
				return `已移到 ${into || info?.name || '资料库'}`;
			});
			return;
		}
		if (!transfer.files.length) return;
		event.preventDefault();
		const folders = [...transfer.items].filter((item) => item.webkitGetAsEntry?.()?.isDirectory).length;
		if (folders) say('暂时不能上传整个文件夹：可以在 Finder 里直接把它拖进资料库文件夹', 'error');
		uploadFiles([...transfer.items].filter((item) => item.kind === 'file' && !item.webkitGetAsEntry?.()?.isDirectory).map((item) => item.getAsFile()!).filter(Boolean), into);
	});

	upload.addEventListener('click', () => picker.click());
	picker.addEventListener('change', () => {
		uploadFiles([...(picker.files ?? [])], folder);
		picker.value = '';
	});
	newFolder.addEventListener('click', () => void createFolder());
	refresh.addEventListener('click', () => void open(folder));
	reveal.addEventListener('click', () => void revealDriveFile(folder).catch((error) => say(message(error, '打不开'), 'error')));
	// What syncing or Finder changed while the window was elsewhere.
	window.addEventListener('focus', () => {
		if (info?.root && !root.closest('[hidden]')) void open(folder, { quiet: true });
	});

	return {
		/** Shows a folder of the drive (the drive itself by default), read afresh. */
		open: (next = folder) => open(next),
		/** Shows the folder a file is in, the file selected. */
		async reveal(path: string): Promise<void> {
			await open(parentPath(path));
			select(path);
			list.querySelector<HTMLElement>(`.drive-row[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'nearest' });
			list.focus();
		},
		/** The drive changed elsewhere: shows it as it is now. */
		refresh: () => {
			info = null;
			return open(folder, { quiet: true });
		},
	};
}
