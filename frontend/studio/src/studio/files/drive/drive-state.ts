import { Copy, ExternalLink, Eye, FileInput, FolderOpen, FolderPlus, FolderSearch, PenLine, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { officeKind } from '@blog/office/kinds.mjs';
import { openOfficeFile } from '@blog/office/viewer.ts';
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
	StudioApiError,
	trashDriveFile,
	uploadDriveFile,
	type DriveEntry,
	type DriveInfo,
} from '../../api/client.ts';
import { showContextMenu, type MenuItem } from '../../common/context-menu.ts';
import { showToast } from '../../common/toast.ts';
import { createStore, type Store } from '../../shell/store.ts';
import { fileName, parentPath } from '../article-files.ts';
import { errorMessage, NO_STATUS, statusLine, type Status } from '../shared/status.ts';

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

/** What a drive browser shows (DriveBrowser.tsx draws it). */
export type DriveState = {
	/** The drive's folder; null till asked. Without a root, the browser asks for one. */
	info: DriveInfo | null;
	folder: string;
	entries: DriveEntry[];
	selected: string | null;
	/** The entry being renamed. */
	renaming: string | null;
	status: Status;
	/** A row to show (and the list to take the keys, with `focus`), counted so each ask is one. */
	shown: { path: string; focus: boolean; asked: number } | null;
};

const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/**
 * The drive (资料库, drive.mjs) as a file browser: its folders one at a time, files opened in the page (office files)
 * or a new tab, uploads dropped in, and the usual renaming, moving and trashing.
 */
export function createDriveState(host: DriveBrowserHost) {
	const store: Store<DriveState> = createStore<DriveState>({ info: null, folder: '', entries: [], selected: null, renaming: null, status: NO_STATUS, shown: null });
	const get = store.get;
	const say = statusLine((status) => store.set({ status }));
	/** Bumped by every listing: an older one that answers late is dropped. */
	let listing = 0;
	/** The drive's folder may have changed elsewhere: asked again before the next listing. */
	let stale = false;
	/** The hidden file input (DriveBrowser.tsx), to choose files with. */
	const picker: { input: HTMLInputElement | null } = { input: null };

	/** Shows `next`, read afresh. */
	async function open(next: string, { quiet = false } = {}): Promise<void> {
		const at = ++listing;
		try {
			let { info } = get();
			if (!info || stale) {
				stale = false;
				info = await driveInfo();
				if (at !== listing) return;
				store.set({ info });
			}
			if (!info.root) return;
			if (!quiet) say(t('正在读取…'), 'busy');
			const read = await listDrive(next);
			if (at !== listing) return;
			let { selected } = get();
			if (next !== get().folder) selected = null;
			if (selected && !read.some((entry) => entry.path === selected)) selected = null;
			store.set({ folder: next, entries: read, selected });
			say('');
			host.navigated?.(next);
		} catch (error) {
			if (at !== listing) return;
			// The folder went away (moved in Finder, trashed from the other browser): its parent instead.
			if (next && error instanceof StudioApiError && error.status === 404) return open(parentPath(next), { quiet });
			say(errorMessage(error, t('读取资料库失败')), 'error');
		}
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
			await open(get().folder, { quiet: true });
			say(done ?? '');
			host.changed();
		} catch (error) {
			say(errorMessage(error, t('操作失败')), 'error');
			await open(get().folder, { quiet: true });
		}
	}

	function trash(entry: DriveEntry): void {
		const name = fileName(entry.path);
		void change(t('正在删除 {name}…', { name }), async () => {
			const { trashed } = await trashDriveFile(entry.path);
			showToast(t('已把 {name} 移到资料库的回收站', { name }), {
				action: {
					label: t('撤销'),
					run: () => void change(t('正在放回…'), async () => {
						await restoreDriveFile(trashed);
						return t('已放回 {name}', { name });
					}),
				},
			});
		});
	}

	async function createFolder(): Promise<void> {
		const names = new Set(get().entries.map((entry) => fileName(entry.path)));
		// Named in the Studio's language, as Finder names its own.
		let name = t('新建文件夹');
		for (let count = 2; names.has(name); count += 1) name = t('新建文件夹 {count}', { count });
		let made = '';
		await change(t('正在新建文件夹…'), async () => {
			made = (await createDriveFolder(join(get().folder, name))).path;
			store.set({ selected: made });
		});
		if (get().entries.some((entry) => entry.path === made)) store.set({ renaming: made });
	}

	function uploadFiles(files: readonly File[], into: string): void {
		if (!files.length) return;
		void change(files.length === 1 ? t('正在上传 {name}…', { name: files[0]!.name }) : t('正在上传 {count} 个文件…', { count: files.length }), async () => {
			for (const [index, file] of files.entries()) {
				await uploadDriveFile(into, file, {
					onProgress: (loaded, total) => {
						const at = { name: file.name, index: index + 1, count: files.length };
						say(total ? t('正在上传 {name}（{index}/{count}） {percent}%', { ...at, percent: Math.round((loaded / total) * 100) }) : t('正在上传 {name}（{index}/{count}）', at), 'busy');
					},
				});
			}
			return files.length === 1 ? t('已上传 {name}', { name: files[0]!.name }) : t('已上传 {count} 个文件', { count: files.length });
		});
	}

	async function insert(entry: DriveEntry): Promise<void> {
		say(t('正在把 {name} 放进页面…', { name: fileName(entry.path) }), 'busy');
		try {
			await host.insertIntoArticle(entry.path);
			say(t('已复制到页面并插入：{name}', { name: fileName(entry.path) }));
		} catch (error) {
			say(errorMessage(error, t('插入失败')), 'error');
		}
	}

	function reveal(path: string): void {
		void revealDriveFile(path).catch((error) => say(errorMessage(error, t('打不开')), 'error'));
	}

	/** The drive is set: to a folder chosen in the system's window (`chooseDriveFolder`), or typed. */
	async function setUp(task: () => Promise<DriveInfo>): Promise<void> {
		say(t('正在设置…'), 'busy');
		try {
			const chosen = await task();
			if (chosen.cancelled) return say('');
			store.set({ info: chosen });
			say('');
			host.changed();
			await open('');
		} catch (error) {
			say(errorMessage(error, t('设置失败')), 'error');
		}
	}

	const actions = {
		picker,
		open: (path: string) => void open(path),
		refresh: () => void open(get().folder),
		activate,
		select: (path: string | null) => store.set({ selected: path }),
		/** ↑ and ↓: the next row selected, and shown. */
		step(by: number): void {
			const { entries, selected } = get();
			const index = entries.findIndex((entry) => entry.path === selected);
			const next = entries[Math.max(0, Math.min(entries.length - 1, index + by))];
			if (next) store.set({ selected: next.path, shown: { path: next.path, focus: false, asked: (get().shown?.asked ?? 0) + 1 } });
		},
		rename: (entry: DriveEntry) => store.set({ renaming: entry.path }),
		/** The new name typed (null: given up). */
		renamed(entry: DriveEntry, name: string | null): void {
			store.set({ renaming: null });
			if (name === null) return;
			void change(t('正在重命名…'), async () => {
				const { path } = await moveDriveFile(entry.path, join(parentPath(entry.path), name));
				store.set({ selected: path });
				return t('已重命名为 {name}', { name });
			});
		},
		trash,
		createFolder: () => void createFolder(),
		uploadFiles,
		chooseFiles: () => picker.input?.click(),
		revealFolder: () => reveal(get().folder),
		/** A row dragged onto a folder (or the folder shown): moved there. */
		moveInto(moved: string, into: string): void {
			if (parentPath(moved) === into || into === moved || into.startsWith(`${moved}/`)) return;
			void change(t('正在移动 {name}…', { name: fileName(moved) }), async () => {
				await moveDriveFile(moved, join(into, fileName(moved)));
				return t('已移到 {folder}', { folder: into || get().info?.name || t('资料库') });
			});
		},
		say,
		chooseFolder: () => void setUp(chooseDriveFolder),
		typeFolder: (path: string) => void setUp(() => setDriveFolder(path)),
		menu(entry: DriveEntry | null, at: { x: number; y: number } | HTMLElement): void {
			const { info } = get();
			const article = host.article();
			const items: MenuItem[] = [];
			if (entry) {
				items.push({ label: entry.kind === 'directory' ? t('打开') : officeKind(entry.path) ? t('预览') : t('在新标签页打开'), icon: entry.kind === 'directory' ? FolderOpen : officeKind(entry.path) ? Eye : ExternalLink, action: () => activate(entry) });
				if (entry.kind === 'file' && article) items.push({ label: t('插入到《{title}》', { title: article.title }), icon: FileInput, action: () => void insert(entry) });
				if (entry.kind === 'file') items.push({ label: t('问 AI'), hint: t('终端'), icon: Sparkles, action: () => host.askAI(entry.path) });
				items.push('separator', { label: t('重命名'), hint: 'F2', icon: PenLine, action: () => actions.rename(entry) });
				if (!info?.fixed) items.push({ label: t('在 Finder 中显示'), icon: FolderSearch, action: () => reveal(entry.path) });
				items.push({ label: t('复制路径'), icon: Copy, action: () => void navigator.clipboard.writeText(`${info?.root ?? ''}/${entry.path}`).then(() => say(t('已复制路径'))) });
				items.push('separator', { label: t('移到回收站'), danger: true, icon: Trash2, action: () => trash(entry) });
			} else {
				items.push({ label: t('上传文件…'), icon: Upload, action: () => picker.input?.click() }, { label: t('新建文件夹'), icon: FolderPlus, action: () => void createFolder() }, { label: t('重新读取'), icon: RefreshCw, action: () => void open(get().folder) });
			}
			showContextMenu(items, at);
		},
	};

	/** What the Studio around it asks of the browser. */
	const api = {
		/** Shows a folder of the drive (the drive itself by default), read afresh. */
		open: (next = get().folder) => open(next),
		/** Shows the folder a file is in, the file selected. */
		async reveal(path: string): Promise<void> {
			await open(parentPath(path));
			store.set({ selected: path, shown: { path, focus: true, asked: (get().shown?.asked ?? 0) + 1 } });
		},
		/** The drive changed elsewhere: shows it as it is now. */
		refresh: () => {
			stale = true;
			return open(get().folder, { quiet: true });
		},
	};

	return { store, actions, api };
}

export type DriveActions = ReturnType<typeof createDriveState>['actions'];
