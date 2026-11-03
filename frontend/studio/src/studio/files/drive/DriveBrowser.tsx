import { useEffect, useLayoutEffect, useRef } from 'react';
import { FolderPlus, FolderSearch, RefreshCw, Upload, type LucideIcon } from 'lucide-react';

import { locale, t } from '@blog/i18n/index.mjs';
import { officeKind } from '@blog/office/kinds.mjs';
import { useStore, type Store } from '../../shell/store';
import type { DriveEntry } from '../../api/client';
import { DRIVE_DRAG_TYPE, extension, fileName, parentPath } from '../article-files';
import { formatSize } from '../file-tree';
import { NameInput } from '../shared/NameInput';
import { useDropZone } from '../shared/use-drop-zone';
import type { DriveActions, DriveState } from './drive-state';

/** A short mark for what kind of file this is, drawn on its icon. */
function typeMark(path: string): string {
	const kind = officeKind(path);
	if (kind === 'document') return 'DOC';
	if (kind === 'slides') return 'PPT';
	if (kind === 'sheet') return 'XLS';
	return extension(path).slice(0, 4).toUpperCase();
}

const DATE = new Intl.DateTimeFormat(locale(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const OLD_DATE = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'numeric', day: 'numeric' });

function when(modified: number): string {
	const date = new Date(modified);
	return (date.getFullYear() === new Date().getFullYear() ? DATE : OLD_DATE).format(date);
}

const rowOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.drive-row:not(.drive-head)') : null);

/**
 * A drive browser (drive-state.ts): shown as a page of its own (`page`) and, smaller, in the side panel (`pane`), from
 * where a file is dragged into the article; one change shows in both.
 */
export function DriveBrowser({ store, actions, mode }: { store: Store<DriveState>; actions: DriveActions; mode: 'page' | 'pane' }) {
	const { info, folder, entries, selected, renaming, status, shown } = useStore(store);
	const list = useRef<HTMLDivElement>(null);
	const entryAt = (target: EventTarget | null): DriveEntry | null => entries.find((entry) => entry.path === rowOf(target)?.dataset.path) ?? null;

	useLayoutEffect(() => {
		if (!shown) return;
		list.current?.querySelector<HTMLElement>(`.drive-row[data-path="${CSS.escape(shown.path)}"]`)?.scrollIntoView({ block: 'nearest' });
		if (shown.focus) list.current?.focus();
	}, [shown]);
	// What syncing or Finder changed while the window was elsewhere.
	useEffect(() => {
		const again = () => {
			const { info: now, folder: at } = store.get();
			if (now?.root && list.current && !list.current.closest('[hidden]')) actions.open(at);
		};
		window.addEventListener('focus', again);
		return () => window.removeEventListener('focus', again);
	}, []);

	const drop = useDropZone({
		accepts: (types) => types.includes('Files') || types.includes(DRIVE_DRAG_TYPE),
		over(target) {
			const entry = entryAt(target);
			return entry?.kind === 'directory' ? entry.path : '';
		},
		effect: (types) => (types.includes('Files') ? 'copy' : 'move'),
		drop(transfer, over) {
			const into = over || store.get().folder;
			const moved = transfer.getData(DRIVE_DRAG_TYPE);
			if (moved) {
				actions.moveInto(moved, into);
				return true;
			}
			if (!transfer.files.length) return false;
			const items = [...transfer.items];
			if (items.some((item) => item.webkitGetAsEntry?.()?.isDirectory)) actions.say(t('暂时不能上传整个文件夹：可以在 Finder 里直接把它拖进资料库文件夹'), 'error');
			actions.uploadFiles(items.filter((item) => item.kind === 'file' && !item.webkitGetAsEntry?.()?.isDirectory).map((item) => item.getAsFile()!).filter(Boolean), into);
			return true;
		},
	});

	const settingUp = Boolean(info && !info.root);
	const parts = folder ? folder.split('/') : [];
	const crumbs = [{ label: info?.name ?? t('资料库'), path: '' }, ...parts.map((part, index) => ({ label: part, path: parts.slice(0, index + 1).join('/') }))];
	const button = (Icon: LucideIcon, title: string, onClick: () => void, hidden = false) => (
		<button className="drive-button" type="button" title={title} aria-label={title} hidden={hidden} onClick={onClick}>
			<Icon aria-hidden />
		</button>
	);
	const page = mode === 'page';

	return (
		<>
			<header className="drive-bar" hidden={settingUp}>
				<nav className="drive-crumbs" aria-label={t('资料库路径')}>
					{crumbs.map((crumb, index) => [
						index ? (
							<span key={`/${crumb.path}`} className="drive-crumb-separator">
								/
							</span>
						) : null,
						<button key={crumb.path} className="drive-crumb" type="button" data-path={crumb.path} aria-current={index === crumbs.length - 1 ? 'page' : undefined} onClick={() => actions.open(crumb.path)}>
							{crumb.label}
						</button>,
					])}
				</nav>
				<div className="drive-actions">
					{button(Upload, t('上传文件到这个文件夹；也可以直接把文件拖进来'), actions.chooseFiles)}
					{button(FolderPlus, t('新建文件夹'), actions.createFolder)}
					{button(RefreshCw, t('重新读取'), actions.refresh)}
					{button(FolderSearch, t('在 Finder 中显示'), actions.revealFolder, Boolean(info?.fixed))}
				</div>
			</header>
			<div className="drive-setup" hidden={!settingUp}>
				{settingUp && <Setup actions={actions} />}
			</div>
			<div
				ref={list}
				className={drop.lit === '' ? 'drive-list is-drop-target' : 'drive-list'}
				role="listbox"
				aria-label={t('资料库里的文件')}
				tabIndex={0}
				hidden={settingUp}
				onClick={(event) => actions.select(entryAt(event.target)?.path ?? null)}
				onDoubleClick={(event) => {
					const entry = entryAt(event.target);
					if (entry) actions.activate(entry);
				}}
				onContextMenu={(event) => {
					if ((event.target as Element).closest('.drive-name-input')) return;
					event.preventDefault();
					const entry = entryAt(event.target);
					if (entry) actions.select(entry.path);
					actions.menu(entry, { x: event.clientX, y: event.clientY });
				}}
				onKeyDown={(event) => {
					if ((event.target as HTMLElement).tagName === 'INPUT') return;
					const current = entries.find((entry) => entry.path === selected) ?? null;
					if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
						event.preventDefault();
						actions.step(event.key === 'ArrowDown' ? 1 : -1);
					} else if (event.key === 'Enter' && current) {
						event.preventDefault();
						actions.activate(current);
					} else if (event.key === 'F2' && current) {
						event.preventDefault();
						actions.rename(current);
					} else if ((event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey)) && current) {
						event.preventDefault();
						actions.trash(current);
					} else if (event.key === 'Backspace' && folder) {
						event.preventDefault();
						actions.open(parentPath(folder));
					}
				}}
				{...drop.handlers}
			>
				{!entries.length ? (
					<p className="drive-empty">{t('这个文件夹是空的。把文件拖到这里上传。')}</p>
				) : (
					<>
						{page && (
							<div className="drive-row drive-head" aria-hidden="true">
								<span />
								<span className="drive-name">{t('名称')}</span>
								<span className="drive-date">{t('修改时间')}</span>
								<span className="drive-size">{t('大小')}</span>
							</div>
						)}
						{entries.map((entry) => (
							<div
								key={entry.path}
								className={drop.lit === entry.path ? 'drive-row is-drop-target' : 'drive-row'}
								role="option"
								data-path={entry.path}
								data-kind={entry.kind}
								draggable={renaming !== entry.path}
								tabIndex={-1}
								aria-selected={entry.path === selected}
								title={entry.path}
								onDragStart={(event) => {
									event.dataTransfer.setData(DRIVE_DRAG_TYPE, entry.path);
									event.dataTransfer.setData('text/plain', fileName(entry.path));
									event.dataTransfer.effectAllowed = 'copyMove';
								}}
							>
								<span className="drive-icon" data-kind={entry.kind}>
									{entry.kind === 'file' ? typeMark(entry.path) : ''}
								</span>
								{renaming === entry.path ? (
									<NameInput className="drive-name-input" value={fileName(entry.path)} label={t('新名称')} keepExtension={entry.kind === 'file'} onDone={(name) => actions.renamed(entry, name)} />
								) : (
									<span className="drive-name">{fileName(entry.path)}</span>
								)}
								{page && (
									<>
										<span className="drive-date">{when(entry.modified)}</span>
										<span className="drive-size">{entry.kind === 'file' ? formatSize(entry.size ?? 0) : ''}</span>
									</>
								)}
							</div>
						))}
					</>
				)}
			</div>
			<p className="drive-status" role="status" aria-live="polite" data-state={status.state}>
				{status.text}
			</p>
			<input
				ref={(input) => {
					actions.picker.input = input;
				}}
				type="file"
				multiple
				hidden
				onChange={(event) => {
					const files = [...(event.currentTarget.files ?? [])];
					event.currentTarget.value = '';
					actions.uploadFiles(files, store.get().folder);
				}}
			/>
		</>
	);
}

/** No drive yet: a folder of the author's to choose, or to type. */
function Setup({ actions }: { actions: DriveActions }) {
	return (
		<>
			<h2>{t('选择资料库文件夹')}</h2>
			<p>{t('资料库是你电脑上的一个文件夹，比如放在 iCloud 云盘或 Dropbox 里，由它们负责同步。Studio 在这里浏览、预览里面的文件，并把它们用进页面。')}</p>
			<button className="drive-primary" type="button" onClick={actions.chooseFolder}>
				{t('选择文件夹…')}
			</button>
			<form
				className="drive-typed"
				onSubmit={(event) => {
					event.preventDefault();
					const typed = String(new FormData(event.currentTarget).get('path') ?? '').trim();
					if (typed) actions.typeFolder(typed);
				}}
			>
				<input name="path" type="text" placeholder={t('或者输入文件夹的完整路径，如 /Users/me/Library/Mobile Documents/com~apple~CloudDocs/资料')} aria-label={t('资料库文件夹路径')} />
				<button type="submit">
					{t('使用')}
				</button>
			</form>
		</>
	);
}
