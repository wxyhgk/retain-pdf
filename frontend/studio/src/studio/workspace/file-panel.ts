import {
	createArticleFolder,
	listArticleFiles,
	moveArticleFile,
	revealArticleFile,
	trashArticleFile,
	uploadArticleFile,
} from '../api/client';
import { movedPath, referencedPaths } from '../shared/article-references.mjs';
import { trackWrite } from '../state/writes';
import type { ArticleFileEntry } from '../types';
import { showContextMenu, type MenuItem } from './context-menu';
import { droppedItems, pickedItems, type UploadItem } from './dropped-files';
import {
	buildFileTree,
	extension,
	fileName,
	formatSize,
	isImage,
	isUnused,
	markdownReference,
	parentPath,
	referenceCount,
	STUDIO_FILE_DRAG_TYPE,
	uploadFolderFor,
	visibleNodes,
	type FileNode,
} from './file-tree';

/** What the file panel needs from the editor around it. */
export type FilePanelHost = {
	/** The open article's Markdown as edited, saved or not. */
	source(): string;
	/** The revision the editor last loaded or saved. */
	revision(): string;
	/** Saves what is waiting to be saved, so a move rewrites the article as the author sees it. */
	settle(): Promise<unknown>;
	/**
	 * `from` is now `to`. `rewritten` says the server changed `index.md` to
	 * follow it; the editor reloads, keeping unsaved edits pointed at the new name.
	 */
	moved(from: string, to: string, rewritten: boolean): Promise<void>;
};

const STATUS_CLEAR_MS = 6000;
const FINDER = /Mac/u.test(navigator.platform) ? '在 Finder 中显示' : '在文件管理器中显示';
const STRUCTURE_EXTENSIONS = new Set(['mol', 'sdf', 'xyz', 'pdb', 'mol2', 'cif', 'cube', 'gjf', 'com', 'smi', 'smiles']);

type Editing = { kind: 'rename'; path: string } | { kind: 'folder'; parent: string };

function fileIcon(node: FileNode, open: boolean): string {
	if (node.entry.kind === 'directory') return open ? '▾' : '▸';
	if (isImage(node.entry.path)) return '▣';
	if (STRUCTURE_EXTENSIONS.has(extension(node.entry.path))) return '⬡';
	return '▤';
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The 文件 tab: the open article's folder as a tree. Files can be uploaded
 * (button, or dropped from the desktop), renamed, moved by dragging onto a
 * folder, and moved to the trash; folders can be made. Files in `img/` and
 * `assets/` that the article does not use are dimmed, and removing one it
 * does use asks first. The article's own files and its three folders are
 * listed but stay put.
 */
export function createFilePanel(pane: HTMLElement, host: FilePanelHost) {
	const rootLabel = pane.querySelector<HTMLElement>('#files-root')!;
	const tree = pane.querySelector<HTMLElement>('#file-tree')!;
	const status = pane.querySelector<HTMLElement>('#files-status')!;
	const uploadButton = pane.querySelector<HTMLButtonElement>('#upload-files')!;
	const folderButton = pane.querySelector<HTMLButtonElement>('#new-folder')!;
	const refreshButton = pane.querySelector<HTMLButtonElement>('#refresh-files')!;
	const uploadInput = pane.querySelector<HTMLInputElement>('#file-upload-input')!;
	const folderInput = document.createElement('input');
	folderInput.type = 'file';
	folderInput.multiple = true;
	folderInput.webkitdirectory = true;
	folderInput.hidden = true;
	pane.append(folderInput);

	let slug: string | null = null;
	let entries: ArticleFileEntry[] = [];
	let referenced = new Set<string>();
	let selected: string | null = null;
	let editing: Editing | null = null;
	let uploadTarget: ArticleFileEntry | null = null;
	let loadSequence = 0;
	let statusTimer = 0;
	let sourceTimer = 0;
	/** Open folders, per article, for as long as the page is open. */
	const expandedByArticle = new Map<string, Set<string>>();
	/** One change at a time, so a listing never lands between two of them. */
	let queue: Promise<unknown> = Promise.resolve();

	const expanded = (): Set<string> => {
		if (!slug) return new Set();
		let set = expandedByArticle.get(slug);
		if (!set) expandedByArticle.set(slug, (set = new Set(['img', 'assets'])));
		return set;
	};
	const entryAt = (path: string | null): ArticleFileEntry | null => entries.find((entry) => entry.path === path) ?? null;

	function setStatus(text: string, state: '' | 'busy' | 'error' = ''): void {
		window.clearTimeout(statusTimer);
		status.textContent = text;
		status.dataset.state = state;
		if (text && state === '') statusTimer = window.setTimeout(() => setStatus(''), STATUS_CLEAR_MS);
	}

	/** Runs a change, reporting it in the status line, then lists the folder again. */
	function run(busyText: string, task: () => Promise<string | void>): Promise<void> {
		const article = slug;
		const next = queue.then(async () => {
			if (!article || article !== slug) return;
			setStatus(busyText, 'busy');
			try {
				const done = await task();
				setStatus(done ?? '');
			} catch (error) {
				setStatus(errorMessage(error, '操作失败'), 'error');
			}
			if (article === slug) await refresh();
		});
		queue = next.catch(() => {});
		return next;
	}

	async function refresh(): Promise<void> {
		const article = slug;
		const sequence = ++loadSequence;
		if (!article) return;
		try {
			const listed = await listArticleFiles(article);
			if (sequence !== loadSequence || article !== slug) return;
			entries = listed;
			if (selected && !entryAt(selected)) selected = null;
			render();
		} catch (error) {
			if (sequence === loadSequence) setStatus(errorMessage(error, '无法列出文件'), 'error');
		}
	}

	function render(): void {
		const hadFocus = tree.contains(document.activeElement);
		tree.replaceChildren();
		uploadButton.disabled = folderButton.disabled = refreshButton.disabled = !slug;
		if (!slug) {
			rootLabel.textContent = '未打开文章';
			tree.append(element('p', 'file-tree-empty', '打开一篇文章后，这里显示它的文件夹。'));
			return;
		}
		rootLabel.textContent = `blog/${slug}/`;
		const list = element('ul', 'file-tree-list');
		list.setAttribute('role', 'tree');
		list.setAttribute('aria-label', `blog/${slug}/ 的文件`);
		const open = expanded();
		const rows = visibleNodes(buildFileTree(entries), open);
		for (const node of rows) {
			const isOpen = open.has(node.entry.path);
			list.append(row(node, isOpen));
			if (editing?.kind === 'folder' && editing.parent === node.entry.path) list.append(newFolderRow(editing.parent, node.depth + 1));
			else if (node.entry.kind === 'directory' && isOpen && !node.children.length) list.append(emptyFolderRow(node));
		}
		tree.append(list);
		const focusable = list.querySelector<HTMLElement>('.file-row.is-selected') ?? list.querySelector<HTMLElement>('.file-row');
		if (focusable) focusable.tabIndex = 0;
		const input = list.querySelector<HTMLInputElement>('.file-name-input');
		if (input) {
			input.focus();
			const name = input.value;
			const dot = editing?.kind === 'rename' && entryAt(editing.path)?.kind === 'file' ? name.lastIndexOf('.') : -1;
			input.setSelectionRange(0, dot > 0 ? dot : name.length);
		} else if (hadFocus) focusable?.focus();
	}

	function row(node: FileNode, open: boolean): HTMLLIElement {
		const { entry } = node;
		const item = element('li', 'file-row');
		item.setAttribute('role', 'treeitem');
		item.setAttribute('aria-level', String(node.depth + 1));
		item.setAttribute('aria-selected', String(entry.path === selected));
		item.dataset.path = entry.path;
		item.tabIndex = -1;
		item.style.setProperty('--depth', String(node.depth));
		item.classList.toggle('is-selected', entry.path === selected);
		item.classList.toggle('is-folder', entry.kind === 'directory');
		item.classList.toggle('is-locked', Boolean(entry.locked));
		if (entry.kind === 'directory') item.setAttribute('aria-expanded', String(open));
		const unused = isUnused(entry, referenced);
		item.classList.toggle('is-unused', unused);

		item.append(element('span', 'file-icon', fileIcon(node, open)));
		if (editing?.kind === 'rename' && editing.path === entry.path) {
			item.append(nameInput(node.name, (name) => renameTo(entry, name)));
		} else {
			item.append(element('span', 'file-name', node.name));
			const meta = entry.kind === 'directory'
				? (node.children.length ? String(node.children.length) : '空')
				: entry.size !== undefined ? formatSize(entry.size) : '';
			item.append(element('span', 'file-meta', meta));
			const actions = element('span', 'file-row-actions');
			if (entry.kind === 'directory') actions.append(rowButton('file-row-upload', '⤒', `上传文件到 ${node.name}/`));
			actions.append(rowButton('file-row-menu', '⋯', `${node.name} 的操作`));
			item.append(actions);
		}
		item.title = unused ? `${entry.path}\n正文没有引用它` : entry.path;
		if (!entry.locked) item.draggable = true;
		return item;
	}

	function rowButton(className: string, text: string, label: string): HTMLButtonElement {
		const button = element('button', className, text);
		button.type = 'button';
		button.tabIndex = -1;
		button.title = label;
		button.setAttribute('aria-label', label);
		return button;
	}

	/** Under an open, empty folder: somewhere obvious to drop files, or to click to choose them. */
	function emptyFolderRow(node: FileNode): HTMLLIElement {
		const item = element('li', 'file-row-empty');
		item.setAttribute('role', 'none');
		item.dataset.dropFolder = node.entry.path;
		item.style.setProperty('--depth', String(node.depth + 1));
		const button = element('button', 'file-empty-upload', '拖文件到这里，或点击上传');
		button.type = 'button';
		button.tabIndex = -1;
		button.addEventListener('click', (event) => {
			event.stopPropagation();
			chooseUpload(node.entry);
		});
		item.append(button);
		return item;
	}

	function newFolderRow(parent: string, depth: number): HTMLLIElement {
		const item = element('li', 'file-row is-folder is-editing');
		item.style.setProperty('--depth', String(depth));
		item.append(element('span', 'file-icon', '▸'), nameInput('', (name) => createFolder(parent, name)));
		return item;
	}

	function nameInput(value: string, commit: (name: string) => void): HTMLInputElement {
		const input = element('input', 'file-name-input');
		input.value = value;
		input.spellcheck = false;
		input.setAttribute('aria-label', value ? `重命名 ${value}` : '新文件夹名称');
		let done = false;
		const finish = (save: boolean) => {
			if (done) return;
			done = true;
			const name = input.value.trim();
			editing = null;
			if (save && name && name !== value) commit(name);
			else render();
		};
		input.addEventListener('keydown', (event) => {
			event.stopPropagation();
			if (event.isComposing) return;
			if (event.key === 'Enter') {
				event.preventDefault();
				finish(true);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				finish(false);
			}
		});
		input.addEventListener('blur', () => finish(true));
		input.addEventListener('click', (event) => event.stopPropagation());
		input.addEventListener('dblclick', (event) => event.stopPropagation());
		return input;
	}

	function select(path: string | null, focus = false): void {
		selected = path;
		for (const item of tree.querySelectorAll<HTMLElement>('.file-row[data-path]')) {
			const isSelected = item.dataset.path === path;
			item.classList.toggle('is-selected', isSelected);
			item.setAttribute('aria-selected', String(isSelected));
			item.tabIndex = isSelected ? 0 : -1;
			if (isSelected && focus) item.focus();
		}
	}

	function toggle(entry: ArticleFileEntry, open?: boolean): void {
		const set = expanded();
		if (open ?? !set.has(entry.path)) set.add(entry.path);
		else set.delete(entry.path);
		render();
	}

	// —— Changes ——

	/**
	 * Uploads one after another, showing how far along they are. A folder
	 * dropped or chosen whole stays together: in the folder it was dropped on,
	 * or in `assets/`; single files go where `uploadFolderFor` says.
	 */
	function upload(items: readonly UploadItem[], target: ArticleFileEntry | null): void {
		if (!items.length) return;
		const total = items.reduce((sum, item) => sum + item.file.size, 0) || 1;
		void run(`正在上传 ${items.length} 个文件…`, async () => {
			const stored: string[] = [];
			let sent = 0;
			for (const [index, { file, subfolder }] of items.entries()) {
				const folder = target || !subfolder ? uploadFolderFor(target, file) : 'assets';
				const progress = (loaded: number) => {
					const percent = Math.min(100, Math.floor(((sent + loaded) / total) * 100));
					const what = items.length === 1 ? file.name : `${index + 1}/${items.length}`;
					setStatus(`正在上传 ${what} · ${percent}%`, 'busy');
				};
				try {
					const result = await uploadArticleFile(slug!, folder, file, { subfolder, onProgress: progress });
					stored.push(result.path);
					for (let path = parentPath(result.path); path; path = parentPath(path)) expanded().add(path);
				} catch (error) {
					const done = stored.length ? `已上传 ${stored.length} 个，` : '';
					throw new Error(`${done}${file.name} 没有传上去：${errorMessage(error, '上传失败')}`);
				}
				sent += file.size;
			}
			selected = stored[stored.length - 1];
			const renamed = items.length === 1 && fileName(stored[0]) !== items[0].file.name;
			return stored.length === 1 ? `已上传 ${stored[0]}${renamed ? '（已改名）' : ''}` : `已上传 ${stored.length} 个文件`;
		});
	}

	function move(entry: ArticleFileEntry, to: string): void {
		if (to === entry.path) return;
		const from = entry.path;
		void run(`正在移动 ${fileName(from)}…`, async () => {
			await host.settle();
			// The move and the reload after it are one write of the Studio's own.
			const result = await trackWrite(async () => {
				const moved = await moveArticleFile(slug!, from, to, host.revision());
				await host.moved(from, moved.path, moved.references > 0 || moved.views > 0);
				return moved;
			});
			// Open folders and the selection follow the move.
			const set = expanded();
			for (const path of [...set]) {
				const next = movedPath(path, from, result.path);
				if (next === null) continue;
				set.delete(path);
				set.add(next);
			}
			set.add(parentPath(result.path));
			selected = result.path;
			return result.references ? `已移动到 ${result.path}，正文里 ${result.references} 处引用已同步修改` : `已移动到 ${result.path}`;
		});
	}

	function renameTo(entry: ArticleFileEntry, name: string): void {
		const parent = parentPath(entry.path);
		move(entry, parent ? `${parent}/${name}` : name);
	}

	function moveInto(entry: ArticleFileEntry, folder: ArticleFileEntry): void {
		if (folder.kind !== 'directory' || parentPath(entry.path) === folder.path) return;
		if (folder.path === entry.path || folder.path.startsWith(`${entry.path}/`)) return;
		move(entry, `${folder.path}/${fileName(entry.path)}`);
	}

	function createFolder(parent: string, name: string): void {
		void run('正在新建文件夹…', async () => {
			const result = await createArticleFolder(slug!, `${parent}/${name}`);
			expanded().add(parent);
			selected = result.path;
			return `已新建 ${result.path}`;
		});
	}

	function startNewFolder(target: ArticleFileEntry | null): void {
		const parent = target?.kind === 'directory' ? target.path : target && parentPath(target.path) ? parentPath(target.path) : 'assets';
		expanded().add(parent);
		editing = { kind: 'folder', parent };
		render();
	}

	function startRename(entry: ArticleFileEntry): void {
		if (entry.locked) return;
		editing = { kind: 'rename', path: entry.path };
		render();
	}

	function trash(entry: ArticleFileEntry): void {
		if (entry.locked) return;
		const name = fileName(entry.path);
		const uses = referenceCount(host.source(), entry.path);
		const what = entry.kind === 'directory' ? `文件夹「${name}」及其中所有文件` : `「${name}」`;
		const warning = uses
			? `正文里有 ${uses} 处引用${entry.kind === 'directory' ? '这个文件夹里的文件' : '它'}，删除后它们会失效。\n\n确定把${what}移到回收站吗？`
			: `把${what}移到回收站？\n文件会移到项目的 .studio-trash/ 文件夹，需要时可以从那里找回。`;
		if (!confirm(warning)) return;
		void run(`正在删除 ${name}…`, async () => {
			await trashArticleFile(slug!, entry.path);
			if (selected === entry.path) selected = parentPath(entry.path) || null;
			return `已把 ${entry.path} 移到 .studio-trash/`;
		});
	}

	function reveal(path: string): void {
		const article = slug!;
		revealArticleFile(article, path).catch((error) => setStatus(errorMessage(error, '无法打开文件管理器'), 'error'));
	}

	async function copy(text: string, what: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			setStatus(`已复制${what}`);
		} catch {
			setStatus('浏览器不允许写入剪贴板', 'error');
		}
	}

	function openFile(entry: ArticleFileEntry): void {
		const [root, ...rest] = entry.path.split('/');
		if (entry.kind !== 'file' || (root !== 'img' && root !== 'assets')) return;
		const url = `/api/studio/articles/${encodeURIComponent(slug!)}/files/${root}/${rest.map(encodeURIComponent).join('/')}`;
		window.open(url, '_blank', 'noopener');
	}

	function chooseUpload(target: ArticleFileEntry | null, folders = false): void {
		uploadTarget = target;
		(folders ? folderInput : uploadInput).click();
	}

	function menuFor(entry: ArticleFileEntry | null): MenuItem[] {
		if (!entry) {
			return [
				{ label: '上传文件…', action: () => chooseUpload(null) },
				{ label: '上传文件夹…', action: () => chooseUpload(null, true) },
				{ label: '新建文件夹', action: () => startNewFolder(null) },
				'separator',
				{ label: FINDER, action: () => reveal('') },
			];
		}
		const items: MenuItem[] = [];
		const published = entry.path.startsWith('img/') || entry.path.startsWith('assets/');
		if (entry.kind === 'directory') {
			items.push(
				{ label: '上传文件到这里…', action: () => chooseUpload(entry) },
				{ label: '上传文件夹到这里…', action: () => chooseUpload(entry, true) },
				{ label: '新建子文件夹', action: () => startNewFolder(entry) },
			);
		} else {
			const reference = markdownReference(entry.path);
			if (published) items.push({ label: '在新标签页打开', action: () => openFile(entry) });
			if (reference) items.push({ label: '复制 Markdown 引用', action: () => void copy(reference, ' Markdown 引用') });
		}
		items.push({ label: '复制路径', action: () => void copy(entry.kind === 'directory' ? `./${entry.path}/` : `./${entry.path}`, '路径') });
		if (!entry.locked) items.push({ label: '重命名', hint: 'F2', action: () => startRename(entry) });
		items.push('separator', { label: FINDER, action: () => reveal(entry.path) });
		if (!entry.locked) items.push('separator', { label: '移到回收站', hint: '⌫', danger: true, action: () => trash(entry) });
		return items;
	}

	// —— Events ——

	const rowOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.file-row[data-path]') : null);
	const entryOf = (target: EventTarget | null): ArticleFileEntry | null => entryAt(rowOf(target)?.dataset.path ?? null);

	tree.addEventListener('click', (event) => {
		const entry = entryOf(event.target);
		if (!entry) return select(null);
		if ((event.target as Element).closest('.file-row-menu')) {
			select(entry.path);
			showContextMenu(menuFor(entry), event.target as HTMLElement);
			return;
		}
		if ((event.target as Element).closest('.file-row-upload')) {
			select(entry.path);
			chooseUpload(entry);
			return;
		}
		select(entry.path, true);
		if (entry.kind === 'directory') toggle(entry);
	});
	tree.addEventListener('dblclick', (event) => {
		const entry = entryOf(event.target);
		if (entry?.kind === 'file') openFile(entry);
	});
	tree.addEventListener('contextmenu', (event) => {
		if (!slug || (event.target as Element).closest('.file-name-input')) return;
		event.preventDefault();
		const entry = entryOf(event.target);
		if (entry) select(entry.path, true);
		showContextMenu(menuFor(entry), { x: event.clientX, y: event.clientY });
	});
	tree.addEventListener('keydown', (event) => {
		const current = rowOf(event.target);
		const entry = entryAt(current?.dataset.path ?? null);
		if (!current || !entry || event.isComposing) return;
		const rows = [...tree.querySelectorAll<HTMLElement>('.file-row[data-path]')];
		const index = rows.indexOf(current);
		const focusRow = (target: HTMLElement | undefined) => {
			if (!target) return;
			event.preventDefault();
			select(target.dataset.path!, true);
		};
		const open = expanded().has(entry.path);
		switch (event.key) {
			case 'ArrowDown': return focusRow(rows[index + 1]);
			case 'ArrowUp': return focusRow(rows[index - 1]);
			case 'Home': return focusRow(rows[0]);
			case 'End': return focusRow(rows[rows.length - 1]);
			case 'ArrowRight':
				event.preventDefault();
				if (entry.kind === 'directory' && !open) toggle(entry, true);
				else if (entry.kind === 'directory') focusRow(rows[index + 1]);
				return;
			case 'ArrowLeft':
				event.preventDefault();
				if (entry.kind === 'directory' && open) toggle(entry, false);
				else focusRow(rows.find((item) => item.dataset.path === parentPath(entry.path)));
				return;
			case 'Enter':
				event.preventDefault();
				if (entry.kind === 'directory') toggle(entry);
				else openFile(entry);
				return;
			case 'F2':
				event.preventDefault();
				return startRename(entry);
			case 'Delete':
			case 'Backspace':
				event.preventDefault();
				return trash(entry);
			case 'ContextMenu':
				event.preventDefault();
				return showContextMenu(menuFor(entry), current);
			default:
				if (event.key === 'F10' && event.shiftKey) {
					event.preventDefault();
					showContextMenu(menuFor(entry), current);
				}
		}
	});

	// Dragging: rows onto folders move them; files from the desktop upload where they land.
	let dropRow: HTMLElement | null = null;
	const markDrop = (target: HTMLElement | null) => {
		if (dropRow === target) return;
		dropRow?.classList.remove('is-drop-target');
		tree.classList.toggle('is-drop-target', target === tree);
		dropRow = target;
		if (target && target !== tree) target.classList.add('is-drop-target');
	};
	/** The folder a drop here means: a folder row itself, the folder a file is in, or the empty folder a hint is under. */
	const dropFolder = (target: EventTarget | null): HTMLElement | null => {
		const hint = target instanceof Element ? target.closest<HTMLElement>('[data-drop-folder]') : null;
		if (hint) return tree.querySelector<HTMLElement>(`.file-row[data-path="${CSS.escape(hint.dataset.dropFolder!)}"]`);
		const entry = entryAt(rowOf(target)?.dataset.path ?? null);
		if (!entry) return null;
		const path = entry.kind === 'directory' ? entry.path : parentPath(entry.path);
		return path ? tree.querySelector<HTMLElement>(`.file-row[data-path="${CSS.escape(path)}"]`) : null;
	};

	tree.addEventListener('dragstart', (event) => {
		const entry = entryOf(event.target);
		if (!entry || entry.locked || !event.dataTransfer) return;
		event.dataTransfer.setData(STUDIO_FILE_DRAG_TYPE, entry.path);
		// Copy: dropped into the editor, the row inserts a reference and the file stays.
		event.dataTransfer.effectAllowed = 'copyMove';
		select(entry.path);
	});
	tree.addEventListener('dragover', (event) => {
		const types = event.dataTransfer?.types ?? [];
		const internal = types.includes(STUDIO_FILE_DRAG_TYPE);
		if (!slug || (!internal && !types.includes('Files'))) return;
		event.preventDefault();
		const folder = dropFolder(event.target);
		markDrop(folder ?? (internal ? null : tree));
		event.dataTransfer!.dropEffect = internal ? (folder ? 'move' : 'none') : 'copy';
	});
	tree.addEventListener('dragleave', (event) => {
		if (!tree.contains(event.relatedTarget as Node)) markDrop(null);
	});
	tree.addEventListener('dragend', () => markDrop(null));
	tree.addEventListener('drop', (event) => {
		const transfer = event.dataTransfer;
		markDrop(null);
		if (!slug || !transfer) return;
		event.preventDefault();
		const folder = entryAt(dropFolder(event.target)?.dataset.path ?? null);
		const dragged = entryAt(transfer.getData(STUDIO_FILE_DRAG_TYPE) || null);
		if (dragged) {
			if (folder) moveInto(dragged, folder);
			return;
		}
		void droppedItems(transfer).then((items) => upload(items, folder));
	});

	uploadButton.addEventListener('click', () => chooseUpload(entryAt(selected)));
	folderButton.addEventListener('click', () => startNewFolder(entryAt(selected)));
	refreshButton.addEventListener('click', () => void refresh());
	uploadInput.addEventListener('change', () => {
		const files = [...(uploadInput.files ?? [])];
		uploadInput.value = '';
		upload(files.map((file) => ({ file, subfolder: '' })), uploadTarget);
	});
	folderInput.addEventListener('change', () => {
		const files = [...(folderInput.files ?? [])];
		folderInput.value = '';
		upload(pickedItems(files), uploadTarget);
	});

	render();

	return {
		/** List this article's folder; `null` when no article is open. */
		show(article: string | null): void {
			if (article !== slug) {
				slug = article;
				entries = [];
				selected = null;
				editing = null;
				setStatus('');
			}
			referenced = referencedPaths(host.source());
			render();
			void refresh();
		},
		/** List the folder again, after something outside the panel changed it. */
		refresh,
		/** The article's text changed: which files it uses may have too. */
		sourceChanged(): void {
			window.clearTimeout(sourceTimer);
			sourceTimer = window.setTimeout(() => {
				const next = referencedPaths(host.source());
				if (next.size === referenced.size && [...next].every((path) => referenced.has(path))) return;
				referenced = next;
				if (!editing) render();
			}, 250);
		},
	};
}
