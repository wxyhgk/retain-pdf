import { t } from '@blog/i18n/index.mjs';
import { movedPath, studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { officeKind, tableSource } from '@blog/office/kinds.mjs';
import {
	articleFileHead,
	createArticleFolder,
	listArticleFiles,
	moveArticleFile,
	restoreArticleFile,
	revealArticleFile,
	trashArticleFile,
	uploadArticleFile,
} from '../../api/client.ts';
import type { MenuItem } from '../../common/context-menu.ts';
import { showToast } from '../../common/toast.ts';
import { createStore, type Store } from '../../shell/store.ts';
import { trackWrite } from '../../state/writes.ts';
import type { ArticleFileEntry } from '../../types.ts';
import { fileName, markdownReference, parentPath, readMarkdownReference } from '../article-files.ts';
import { pickedItems, type UploadItem } from '../dropped-files.ts';
import { referenceCount, uploadFolderFor } from '../file-tree.ts';
import { referencedFilesReader } from '../referenced-files.ts';
import { errorMessage, NO_STATUS, statusLine, type Status } from '../shared/status.ts';
import { markdownTable, parseDelimited } from '../table-text.ts';

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
	/** Puts Markdown into the article where the caret is (a table made from a file). */
	insertMarkdown(markdown: string): void;
	/** Shows a Word, PowerPoint or Excel file in the page. */
	viewOffice(url: string, name: string): void;
	/** A workbook's first sheet as rows (office-viewer.ts). */
	sheetRows(url: string): Promise<string[][]>;
	/** A PDF of the article (its path in it) read by PaddleOCR into a page under the article. */
	ocr(path: string): void;
};

/** A name being typed: a file's new one, or a new folder's under `parent`. */
export type Editing = { kind: 'rename'; path: string } | { kind: 'folder'; parent: string };

/** What the file panel shows (FilePanel.tsx draws it). */
export type FilePanelState = {
	/** The open article; null with none. */
	slug: string | null;
	entries: ArticleFileEntry[];
	/** The files the article names; null till they are read. */
	referenced: ReadonlySet<string> | null;
	selected: string | null;
	editing: Editing | null;
	/** The folders open. */
	open: ReadonlySet<string>;
	status: Status;
	/** A row to take the keys once drawn, counted so each ask is one. */
	focus: { path: string; asked: number } | null;
};

const STATUS_CLEAR_MS = 6000;
const FINDER = () => (/Mac/u.test(navigator.platform) ? t('在 Finder 中显示') : t('在文件管理器中显示'));

/**
 * The 文件 tab's state, and what changes it: the open article's folder as a tree. Files can be uploaded (button, or
 * dropped from the desktop), renamed, moved by dragging onto a folder, and moved to the trash; folders can be made.
 * Files in `img/` and `assets/` that the article does not use are dimmed, and removing one it does use asks first. The
 * article's own files and its three folders are listed but stay put.
 */
export function createFilePanelState(host: FilePanelHost) {
	const store: Store<FilePanelState> = createStore<FilePanelState>({ slug: null, entries: [], referenced: null, selected: null, editing: null, open: new Set(), status: NO_STATUS, focus: null });
	const get = store.get;
	const readReferenced = referencedFilesReader();
	/** Open folders, per article, for as long as the page is open. */
	const openByArticle = new Map<string, Set<string>>();
	/** One change at a time, so a listing never lands between two of them. */
	let queue: Promise<unknown> = Promise.resolve();
	let loadSequence = 0;
	let sourceTimer = 0;
	let uploadTarget: ArticleFileEntry | null = null;
	/** The hidden file inputs (FilePanel.tsx), to choose files or a whole folder with. */
	const pickers: { files: HTMLInputElement | null; folders: HTMLInputElement | null } = { files: null, folders: null };

	const setStatus = statusLine((status) => store.set({ status }), STATUS_CLEAR_MS);
	const entryAt = (path: string | null): ArticleFileEntry | null => get().entries.find((entry) => entry.path === path) ?? null;

	/** The open folders of the article shown, changed by `change`. */
	function opened(change?: (set: Set<string>) => void): void {
		const { slug } = get();
		if (!slug) return;
		let set = openByArticle.get(slug);
		if (!set) openByArticle.set(slug, (set = new Set(PUBLISHED_FOLDERS)));
		change?.(set);
		store.set({ open: new Set(set) });
	}

	/** Runs a change, reporting it in the status line, then lists the folder again. */
	function run(busyText: string, task: () => Promise<string | void>): Promise<void> {
		const article = get().slug;
		const next = queue.then(async () => {
			if (!article || article !== get().slug) return;
			setStatus(busyText, 'busy');
			try {
				const done = await task();
				setStatus(done ?? '');
			} catch (error) {
				setStatus(errorMessage(error, t('操作失败')), 'error');
			}
			if (article === get().slug) await refresh();
		});
		queue = next.catch(() => {});
		return next;
	}

	async function refresh(): Promise<void> {
		const article = get().slug;
		const sequence = ++loadSequence;
		if (!article) return;
		try {
			const listed = await listArticleFiles(article);
			if (sequence !== loadSequence || article !== get().slug) return;
			const { selected } = get();
			store.set({ entries: listed, selected: selected && listed.some((entry) => entry.path === selected) ? selected : null });
		} catch (error) {
			if (sequence === loadSequence) setStatus(errorMessage(error, t('无法列出文件')), 'error');
		}
	}

	function select(path: string | null, focus = false): void {
		store.set({ selected: path });
		if (focus && path) store.set({ focus: { path, asked: (get().focus?.asked ?? 0) + 1 } });
	}

	function toggle(entry: ArticleFileEntry, open?: boolean): void {
		opened((set) => {
			if (open ?? !set.has(entry.path)) set.add(entry.path);
			else set.delete(entry.path);
		});
	}

	/**
	 * Uploads one after another, showing how far along they are. A folder
	 * dropped or chosen whole stays together: in the folder it was dropped on,
	 * or in `assets/`; single files go where `uploadFolderFor` says.
	 */
	function upload(items: readonly UploadItem[], target: ArticleFileEntry | null): void {
		if (!items.length) return;
		const slug = get().slug!;
		const total = items.reduce((sum, item) => sum + item.file.size, 0) || 1;
		void run(t('正在上传 {count} 个文件…', { count: items.length }), async () => {
			const stored: string[] = [];
			let sent = 0;
			for (const [index, { file, subfolder }] of items.entries()) {
				const folder = target || !subfolder ? uploadFolderFor(target, file) : 'assets';
				const progress = (loaded: number) => {
					const percent = Math.min(100, Math.floor(((sent + loaded) / total) * 100));
					setStatus(items.length === 1 ? t('正在上传 {name} · {percent}%', { name: file.name, percent }) : t('正在上传 {index}/{count} · {percent}%', { index: index + 1, count: items.length, percent }), 'busy');
				};
				try {
					const result = await uploadArticleFile(slug, folder, file, { subfolder, onProgress: progress });
					stored.push(result.path);
					opened((set) => {
						for (let path = parentPath(result.path); path; path = parentPath(path)) set.add(path);
					});
				} catch (error) {
					const said = { count: stored.length, name: file.name, error: errorMessage(error, t('上传失败')) };
					throw new Error(stored.length ? t('已上传 {count} 个，{name} 没有传上去：{error}', said) : t('{name} 没有传上去：{error}', said));
				}
				sent += file.size;
			}
			store.set({ selected: stored[stored.length - 1] });
			const renamed = items.length === 1 && fileName(stored[0]) !== items[0].file.name;
			if (stored.length !== 1) return t('已上传 {count} 个文件', { count: stored.length });
			return renamed ? t('已上传 {path}（已改名）', { path: stored[0] }) : t('已上传 {path}', { path: stored[0] });
		});
	}

	function move(entry: ArticleFileEntry, to: string): void {
		if (to === entry.path) return;
		const from = entry.path;
		const slug = get().slug!;
		void run(t('正在移动 {name}…', { name: fileName(from) }), async () => {
			await host.settle();
			// The move and the reload after it are one write of the Studio's own.
			const result = await trackWrite(async () => {
				const moved = await moveArticleFile(slug, from, to, host.revision());
				await host.moved(from, moved.path, moved.references > 0 || moved.views > 0);
				return moved;
			});
			// Open folders and the selection follow the move.
			opened((set) => {
				for (const path of [...set]) {
					const next = movedPath(path, from, result.path);
					if (next === null) continue;
					set.delete(path);
					set.add(next);
				}
				set.add(parentPath(result.path));
			});
			store.set({ selected: result.path });
			return result.references ? t('已移动到 {path}，正文里 {references} 处引用已同步修改', { path: result.path, references: result.references }) : t('已移动到 {path}', { path: result.path });
		});
	}

	function moveInto(entry: ArticleFileEntry, folder: ArticleFileEntry): void {
		if (folder.kind !== 'directory' || parentPath(entry.path) === folder.path) return;
		if (folder.path === entry.path || folder.path.startsWith(`${entry.path}/`)) return;
		move(entry, `${folder.path}/${fileName(entry.path)}`);
	}

	function createFolder(parent: string, name: string): void {
		const slug = get().slug!;
		void run(t('正在新建文件夹…'), async () => {
			const result = await createArticleFolder(slug, `${parent}/${name}`);
			opened((set) => set.add(parent));
			store.set({ selected: result.path });
			return t('已新建 {path}', { path: result.path });
		});
	}

	function startNewFolder(target: ArticleFileEntry | null): void {
		const parent = target?.kind === 'directory' ? target.path : target && parentPath(target.path) ? parentPath(target.path) : 'assets';
		opened((set) => set.add(parent));
		store.set({ editing: { kind: 'folder', parent } });
	}

	function startRename(entry: ArticleFileEntry): void {
		if (!entry.locked) store.set({ editing: { kind: 'rename', path: entry.path } });
	}

	function trash(entry: ArticleFileEntry): void {
		if (entry.locked) return;
		const name = fileName(entry.path);
		const uses = referenceCount(host.source(), entry.path);
		const folder = entry.kind === 'directory';
		const warning = uses
			? folder
				? t('正文里有 {count} 处引用这个文件夹里的文件，删除后它们会失效。\n\n确定把文件夹「{name}」及其中所有文件移到回收站吗？', { count: uses, name })
				: t('正文里有 {count} 处引用它，删除后它们会失效。\n\n确定把「{name}」移到回收站吗？', { count: uses, name })
			: folder
				? t('把文件夹「{name}」及其中所有文件移到回收站？\n删除后可以撤销；回收站（项目的 .studio-trash/）里的文件保留 30 天。', { name })
				: t('把「{name}」移到回收站？\n删除后可以撤销；回收站（项目的 .studio-trash/）里的文件保留 30 天。', { name });
		if (!confirm(warning)) return;
		const article = get().slug!;
		void run(t('正在删除 {name}…', { name }), async () => {
			const { trashed } = await trashArticleFile(article, entry.path);
			if (get().selected === entry.path) store.set({ selected: parentPath(entry.path) || null });
			showToast(t('已删除 {path}', { path: entry.path }), { action: { label: t('撤销'), run: () => restore(article, trashed, entry.path) } });
			return t('已把 {path} 移到 .studio-trash/', { path: entry.path });
		});
	}

	function restore(article: string, trashed: string, path: string): void {
		// Another article open by now: put the file back all the same.
		if (article !== get().slug) {
			restoreArticleFile(article, trashed).then(
				() => showToast(t('已恢复 {path}', { path })),
				(error) => showToast(errorMessage(error, t('恢复失败')), true),
			);
			return;
		}
		void run(t('正在恢复 {name}…', { name: fileName(path) }), async () => {
			await restoreArticleFile(article, trashed);
			store.set({ selected: path });
			return t('已恢复 {path}', { path });
		});
	}

	function reveal(path: string): void {
		revealArticleFile(get().slug!, path).catch((error) => setStatus(errorMessage(error, t('无法打开文件管理器')), 'error'));
	}

	async function copy(text: string, done: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			setStatus(done);
		} catch {
			setStatus(t('浏览器不允许写入剪贴板'), 'error');
		}
	}

	/** Opens a file: an office file in the page's viewer, the rest in a new tab. */
	function openFile(entry: ArticleFileEntry): void {
		const [root] = entry.path.split('/');
		const slug = get().slug;
		if (!slug || entry.kind !== 'file' || !PUBLISHED_FOLDERS.includes(root)) return;
		if (officeKind(entry.path)) host.viewOffice(studioFileUrl(slug, entry.path), fileName(entry.path));
		else window.open(studioFileUrl(slug, entry.path), '_blank', 'noopener');
	}

	/** A spreadsheet's first sheet, or a CSV/TSV file, put into the article as a Markdown table. */
	function insertTable(entry: ArticleFileEntry): void {
		const source = tableSource(entry.path);
		const article = get().slug;
		if (!source || !article) return;
		void run(t('正在读取 {name}…', { name: fileName(entry.path) }), async () => {
			const url = studioFileUrl(article, entry.path);
			let rows: string[][];
			if (source.sheet) rows = await host.sheetRows(url);
			else {
				const response = await fetch(url, { cache: 'no-store' });
				if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? t('读不到 {path}', { path: entry.path }));
				rows = parseDelimited(await response.text(), source.delimiter);
			}
			if (!rows.length) throw new Error(t('{name} 里没有数据', { name: fileName(entry.path) }));
			host.insertMarkdown(markdownTable(rows));
			return t('已插入 {count} 行的表格', { count: rows.length - 1 });
		});
	}

	function chooseUpload(target: ArticleFileEntry | null, folders = false): void {
		uploadTarget = target;
		(folders ? pickers.folders : pickers.files)?.click();
	}

	function menuFor(entry: ArticleFileEntry | null): MenuItem[] {
		if (!entry) {
			return [
				{ label: t('上传文件…'), action: () => chooseUpload(null) },
				{ label: t('上传文件夹…'), action: () => chooseUpload(null, true) },
				{ label: t('新建文件夹'), action: () => startNewFolder(null) },
				'separator',
				{ label: FINDER(), action: () => reveal('') },
			];
		}
		const items: MenuItem[] = [];
		const published = entry.path.startsWith('img/') || entry.path.startsWith('assets/');
		if (entry.kind === 'directory') {
			items.push(
				{ label: t('上传文件到这里…'), action: () => chooseUpload(entry) },
				{ label: t('上传文件夹到这里…'), action: () => chooseUpload(entry, true) },
				{ label: t('新建子文件夹'), action: () => startNewFolder(entry) },
			);
		} else {
			const reference = markdownReference(entry.path);
			if (published) items.push({ label: officeKind(entry.path) ? t('预览') : t('在新标签页打开'), action: () => openFile(entry) });
			if (published && tableSource(entry.path)) items.push({ label: t('插入为表格'), action: () => insertTable(entry) });
			if (/\.pdf$/iu.test(entry.path)) items.push({ label: t('OCR 成子页面（PaddleOCR）'), action: () => host.ocr(entry.path) });
			// A plugin's block may tell the file by what it says (a Gaussian output among other logs): read when copied.
			const article = get().slug;
			if (reference && article) items.push({ label: t('复制 Markdown 引用'), action: () => void readMarkdownReference(entry.path, (path) => articleFileHead(article, path)).then((read) => copy(read ?? reference, t('已复制 Markdown 引用'))) });
		}
		items.push({ label: t('复制路径'), action: () => void copy(entry.kind === 'directory' ? `./${entry.path}/` : `./${entry.path}`, t('已复制路径')) });
		if (!entry.locked) items.push({ label: t('重命名'), hint: 'F2', action: () => startRename(entry) });
		items.push('separator', { label: FINDER(), action: () => reveal(entry.path) });
		if (!entry.locked) items.push('separator', { label: t('移到回收站'), hint: '⌫', danger: true, action: () => trash(entry) });
		return items;
	}

	const actions = {
		pickers,
		entryAt,
		select,
		toggle,
		openFile,
		menuFor,
		chooseUpload,
		startNewFolder,
		startRename,
		trash,
		upload,
		moveInto,
		refresh: () => void refresh(),
		/** The name typed is done with: kept (a name), or given up (null). */
		named(name: string | null): void {
			const { editing } = get();
			store.set({ editing: null });
			if (!editing || name === null) return;
			if (editing.kind === 'folder') return createFolder(editing.parent, name);
			const entry = entryAt(editing.path);
			if (!entry) return;
			const parent = parentPath(entry.path);
			move(entry, parent ? `${parent}/${name}` : name);
		},
		/** Files chosen with the hidden inputs: one by one, or a whole folder. */
		picked(files: File[], folders: boolean): void {
			upload(folders ? pickedItems(files) : files.map((file) => ({ file, subfolder: '' })), uploadTarget);
		},
	};

	/** What the Studio around it asks of the panel. */
	const api = {
		/** List this article's folder; `null` when no article is open. Done when it is listed. */
		show(article: string | null): Promise<void> {
			if (article !== get().slug) {
				store.set({ slug: article, entries: [], selected: null, editing: null, referenced: null });
				setStatus('');
				if (article) opened();
				else store.set({ open: new Set() });
			}
			return refresh();
		},
		/** List the folder again, after something outside the panel changed it. */
		refresh,
		/** The article's text changed: which files it uses may have too. */
		sourceChanged(): void {
			window.clearTimeout(sourceTimer);
			sourceTimer = window.setTimeout(() => {
				const next = readReferenced(host.source());
				const { referenced } = get();
				if (next.size === referenced?.size && [...next].every((path) => referenced.has(path))) return;
				store.set({ referenced: next });
			}, 250);
		},
	};

	return { store, actions, api };
}

export type FilePanelActions = ReturnType<typeof createFilePanelState>['actions'];
