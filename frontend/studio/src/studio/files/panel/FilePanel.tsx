import { Fragment, useLayoutEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { showContextMenu } from '../../common/context-menu';
import { useStore, type Store } from '../../shell/store';
import type { ArticleFileEntry } from '../../types';
import { fileBlock, isImage, parentPath, STUDIO_FILE_DRAG_TYPE } from '../article-files';
import { droppedItems } from '../dropped-files';
import { buildFileTree, formatSize, isUnused, visibleNodes, type FileNode } from '../file-tree';
import { NameInput } from '../shared/NameInput';
import { useDropZone } from '../shared/use-drop-zone';
import type { FilePanelActions, FilePanelState } from './file-panel-state';

function fileIcon(node: FileNode, open: boolean): string {
	if (node.entry.kind === 'directory') return open ? '▾' : '▸';
	if (isImage(node.entry.path)) return '▣';
	// A file a plugin's block shows has its mark (a structure file: ⬡).
	return fileBlock(node.entry.path)?.icon || '▤';
}

const rowOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.file-row[data-path]') : null);

/** The folder a drop here means: a folder row itself, the folder a file is in, or the empty folder a hint is under. */
function dropFolder(target: EventTarget | null, entryAt: (path: string | null) => ArticleFileEntry | null): string | null {
	const hint = target instanceof Element ? target.closest<HTMLElement>('[data-drop-folder]') : null;
	if (hint) return hint.dataset.dropFolder!;
	const entry = entryAt(rowOf(target)?.dataset.path ?? null);
	if (!entry) return null;
	return (entry.kind === 'directory' ? entry.path : parentPath(entry.path)) || null;
}

/** The 文件 tab (file-panel-state.ts): the toolbar, the open article's folder as a tree, and what was last done. */
export function FilePanel({ store, actions }: { store: Store<FilePanelState>; actions: FilePanelActions }) {
	const state = useStore(store);
	const { slug, entries, referenced, selected, editing, open, status, focus } = state;
	const tree = useRef<HTMLDivElement>(null);
	const nodes = useMemo(() => visibleNodes(buildFileTree(entries), open), [entries, open]);
	const order = nodes.map((node) => node.entry.path);
	// Whether the tree had the keys before this drawing: a row they were on may be gone after it (moved, renamed).
	const hadFocus = typeof document !== 'undefined' && Boolean(tree.current?.contains(document.activeElement));

	useLayoutEffect(() => {
		const list = tree.current;
		if (!list || !hadFocus || list.contains(document.activeElement)) return;
		(list.querySelector<HTMLElement>('.file-row.is-selected') ?? list.querySelector<HTMLElement>('.file-row[data-path]'))?.focus();
	});
	useLayoutEffect(() => {
		if (focus) tree.current?.querySelector<HTMLElement>(`.file-row[data-path="${CSS.escape(focus.path)}"]`)?.focus();
	}, [focus]);

	const drop = useDropZone({
		accepts: (types) => Boolean(store.get().slug) && (types.includes(STUDIO_FILE_DRAG_TYPE) || types.includes('Files')),
		over(target, types) {
			const folder = dropFolder(target, actions.entryAt);
			return folder ?? (types.includes(STUDIO_FILE_DRAG_TYPE) ? null : '');
		},
		effect: (types, over) => (types.includes(STUDIO_FILE_DRAG_TYPE) ? (over ? 'move' : 'none') : 'copy'),
		drop(transfer, _over, target) {
			if (!store.get().slug) return false;
			const folder = actions.entryAt(dropFolder(target, actions.entryAt));
			const dragged = actions.entryAt(transfer.getData(STUDIO_FILE_DRAG_TYPE) || null);
			if (dragged) {
				if (folder) actions.moveInto(dragged, folder);
			} else void droppedItems(transfer).then((items) => actions.upload(items, folder));
			return true;
		},
	});

	function onClick(event: MouseEvent) {
		const entry = actions.entryAt(rowOf(event.target)?.dataset.path ?? null);
		if (!entry) return actions.select(null);
		const target = event.target as Element;
		if (target.closest('.file-row-menu')) {
			actions.select(entry.path);
			showContextMenu(actions.menuFor(entry), target as HTMLElement);
			return;
		}
		if (target.closest('.file-row-upload')) {
			actions.select(entry.path);
			actions.chooseUpload(entry);
			return;
		}
		actions.select(entry.path, true);
		if (entry.kind === 'directory') actions.toggle(entry);
	}

	function onKeyDown(event: KeyboardEvent) {
		const current = rowOf(event.target);
		const entry = actions.entryAt(current?.dataset.path ?? null);
		if (!current || !entry || event.nativeEvent.isComposing) return;
		const index = order.indexOf(entry.path);
		const go = (path: string | undefined) => {
			if (path === undefined) return;
			event.preventDefault();
			actions.select(path, true);
		};
		const isOpen = open.has(entry.path);
		switch (event.key) {
			case 'ArrowDown': return go(order[index + 1]);
			case 'ArrowUp': return go(order[index - 1]);
			case 'Home': return go(order[0]);
			case 'End': return go(order[order.length - 1]);
			case 'ArrowRight':
				event.preventDefault();
				if (entry.kind === 'directory' && !isOpen) actions.toggle(entry, true);
				else if (entry.kind === 'directory') go(order[index + 1]);
				return;
			case 'ArrowLeft':
				event.preventDefault();
				if (entry.kind === 'directory' && isOpen) actions.toggle(entry, false);
				else go(order.find((path) => path === parentPath(entry.path)));
				return;
			case 'Enter':
				event.preventDefault();
				if (entry.kind === 'directory') actions.toggle(entry);
				else actions.openFile(entry);
				return;
			case 'F2':
				event.preventDefault();
				return actions.startRename(entry);
			case 'Delete':
			case 'Backspace':
				event.preventDefault();
				return actions.trash(entry);
			case 'ContextMenu':
				event.preventDefault();
				return showContextMenu(actions.menuFor(entry), current);
			default:
				if (event.key === 'F10' && event.shiftKey) {
					event.preventDefault();
					showContextMenu(actions.menuFor(entry), current);
				}
		}
	}

	const focusable = selected && order.includes(selected) ? selected : order[0];

	function row(node: FileNode) {
		const { entry } = node;
		const isOpen = open.has(entry.path);
		const unused = referenced !== null && isUnused(entry, referenced);
		const renaming = editing?.kind === 'rename' && editing.path === entry.path;
		const className = ['file-row', entry.path === selected && 'is-selected', entry.kind === 'directory' && 'is-folder', entry.locked && 'is-locked', unused && 'is-unused', drop.lit === entry.path && 'is-drop-target'].filter(Boolean).join(' ');
		const button = (name: string, text: string, label: string) => (
			<button className={name} type="button" tabIndex={-1} title={label} aria-label={label}>
				{text}
			</button>
		);
		return (
			<li
				className={className}
				role="treeitem"
				aria-level={node.depth + 1}
				aria-selected={entry.path === selected}
				aria-expanded={entry.kind === 'directory' ? isOpen : undefined}
				data-path={entry.path}
				tabIndex={entry.path === focusable ? 0 : -1}
				style={{ '--depth': node.depth } as CSSProperties}
				title={unused ? t('{path}\n正文没有引用它', { path: entry.path }) : entry.path}
				draggable={!entry.locked && !renaming}
				onDragStart={(event) => {
					if (entry.locked) return;
					event.dataTransfer.setData(STUDIO_FILE_DRAG_TYPE, entry.path);
					// Copy: dropped into the editor, the row inserts a reference and the file stays.
					event.dataTransfer.effectAllowed = 'copyMove';
					actions.select(entry.path);
				}}
			>
				<span className="file-icon">{fileIcon(node, isOpen)}</span>
				{renaming ? (
					<NameInput className="file-name-input" value={node.name} label={t('重命名 {name}', { name: node.name })} keepExtension={entry.kind === 'file'} onDone={actions.named} />
				) : (
					<>
						<span className="file-name">{node.name}</span>
						<span className="file-meta">{entry.kind === 'directory' ? (node.children.length ? String(node.children.length) : t('空')) : entry.size !== undefined ? formatSize(entry.size) : ''}</span>
						<span className="file-row-actions">
							{entry.kind === 'directory' && button('file-row-upload', '⤒', t('上传文件到 {name}/', { name: node.name }))}
							{button('file-row-menu', '⋯', t('{name} 的操作', { name: node.name }))}
						</span>
					</>
				)}
			</li>
		);
	}

	/** Under a row: the new folder being named there, or, under an open empty folder, somewhere to drop files. */
	function under(node: FileNode) {
		const { entry } = node;
		const depth = { '--depth': node.depth + 1 } as CSSProperties;
		if (editing?.kind === 'folder' && editing.parent === entry.path) {
			return (
				<li className="file-row is-folder is-editing" style={depth}>
					<span className="file-icon">▸</span>
					<NameInput className="file-name-input" value="" label={t('新文件夹名称')} keepExtension={false} onDone={actions.named} />
				</li>
			);
		}
		if (entry.kind !== 'directory' || !open.has(entry.path) || node.children.length) return null;
		return (
			<li className="file-row-empty" role="none" data-drop-folder={entry.path} style={depth}>
				<button
					className="file-empty-upload"
					type="button"
					tabIndex={-1}
					onClick={(event) => {
						event.stopPropagation();
						actions.chooseUpload(entry);
					}}
				>
					{t('拖文件到这里，或点击上传')}
				</button>
			</li>
		);
	}

	return (
		<>
			<header className="pane-toolbar">
				<span id="files-root" className="pane-path">
					{slug ? `blog/${slug}/` : t('未打开文章')}
				</span>
				<div className="pane-actions">
					<button id="upload-files" type="button" title={t('上传文件；文件和整个文件夹也可以直接拖进来')} aria-label={t('上传文件')} disabled={!slug} onClick={() => actions.chooseUpload(actions.entryAt(store.get().selected))}>
						⤒
					</button>
					<button id="new-folder" type="button" title={t('新建文件夹')} aria-label={t('新建文件夹')} disabled={!slug} onClick={() => actions.startNewFolder(actions.entryAt(store.get().selected))}>
						＋
					</button>
					<button id="refresh-files" type="button" title={t('重新读取文件夹')} aria-label={t('刷新')} disabled={!slug} onClick={actions.refresh}>
						↻
					</button>
				</div>
				<input
					id="file-upload-input"
					ref={(input) => {
						actions.pickers.files = input;
					}}
					type="file"
					multiple
					hidden
					onChange={(event) => {
						const files = [...(event.currentTarget.files ?? [])];
						event.currentTarget.value = '';
						actions.picked(files, false);
					}}
				/>
				<input
					ref={(input) => {
						if (input) input.webkitdirectory = true;
						actions.pickers.folders = input;
					}}
					type="file"
					multiple
					hidden
					onChange={(event) => {
						const files = [...(event.currentTarget.files ?? [])];
						event.currentTarget.value = '';
						actions.picked(files, true);
					}}
				/>
			</header>
			<div
				id="file-tree"
				ref={tree}
				className={drop.lit === '' ? 'file-tree is-drop-target' : 'file-tree'}
				onClick={onClick}
				onDoubleClick={(event) => {
					const entry = actions.entryAt(rowOf(event.target)?.dataset.path ?? null);
					if (entry?.kind === 'file') actions.openFile(entry);
				}}
				onContextMenu={(event) => {
					if (!store.get().slug || (event.target as Element).closest('.file-name-input')) return;
					event.preventDefault();
					const entry = actions.entryAt(rowOf(event.target)?.dataset.path ?? null);
					if (entry) actions.select(entry.path, true);
					showContextMenu(actions.menuFor(entry), { x: event.clientX, y: event.clientY });
				}}
				onKeyDown={onKeyDown}
				{...drop.handlers}
			>
				{slug ? (
					<ul className="file-tree-list" role="tree" aria-label={t('blog/{slug}/ 的文件', { slug })}>
						{nodes.map((node) => (
							<Fragment key={node.entry.path}>
								{row(node)}
								{under(node)}
							</Fragment>
						))}
					</ul>
				) : (
					<p className="file-tree-empty">{t('打开一篇文章后，这里显示它的文件夹。')}</p>
				)}
			</div>
			<p id="files-status" className="files-status" role="status" aria-live="polite" data-state={status.state}>
				{status.text}
			</p>
		</>
	);
}
