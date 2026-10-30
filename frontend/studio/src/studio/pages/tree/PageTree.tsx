import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { ArrowUpToLine, ChevronRight, Copy, Ellipsis, FileText, FolderInput, GitCommitHorizontal, Merge, Plus, Star, Table2, Trash2 } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { showContextMenu, type MenuItem } from '../../common/context-menu';
import { useStore, type Store } from '../../shell/store';
import type { ArticleSummary } from '../../types';
import { within, type TreeTable } from './page-tree';
import type { TreeActions, TreeState } from './tree-state';

/** Where on a page what is dragged is let go of: just above it, under it, just below it. */
type DropZone = 'before' | 'into' | 'after';
/** What a page dragged in the list carries: its folder name. */
const DRAGGED_TYPE = 'application/x-studio-page';

/** A page being dragged, and the pages that go with it (the pages chosen, when it is one of them). */
type Drag = { slug: string; group: string[] };

/** How many pages are under `slug`, all the way down (the rows of its databases too). */
function countUnder(state: TreeState, slug: string): number {
	const pages = [...(state.tree.children.get(slug) ?? []), ...(state.tree.tables.get(slug) ?? []).flatMap((table) => table.rows)];
	return pages.reduce((total, child) => total + 1 + countUnder(state, child.slug), 0);
}

type RowProps = {
	article: ArticleSummary;
	depth: number;
	state: TreeState;
	actions: TreeActions;
	drag: Drag | null;
	setDrag(drag: Drag | null): void;
	drop: { slug: string; zone: DropZone } | null;
	setDrop(drop: { slug: string; zone: DropZone } | null): void;
	/** Over a page that takes it: not the room below the pages. */
	overPage(): void;
};

function Row({ article, depth, state, actions, drag, setDrag, drop, setDrop, overPage }: RowProps) {
	const { host } = actions;
	const { tree, folded, chosen, git, articles } = state;
	const active = article.slug === state.selected;
	const under = tree.children.get(article.slug) ?? [];
	const tables = tree.tables.get(article.slug) ?? [];
	const isFolded = folded.has(article.slug);
	const uncommitted = git?.changed[article.slug];
	const committable = Boolean(git?.available && (uncommitted || git.vanished.length));

	/** What can be done to it (or, one of several chosen, to them all), from the right button, the menu key or ⋯. */
	function menu(at: { x: number; y: number } | HTMLElement): void {
		if (chosen.size > 1 && chosen.has(article.slug)) {
			const group = actions.topmost(chosen);
			const pages = group.map((slug) => articles.find((entry) => entry.slug === slug)!).filter(Boolean);
			showContextMenu([
				{ label: t('移到…（{count} 篇）', { count: group.length }), icon: FolderInput, action: () => host.moveTo(group) },
				{ label: t('移到最上层'), icon: ArrowUpToLine, action: () => host.move(group, '') },
				'separator',
				{ label: t('移到回收站（{count} 篇）', { count: group.length }), danger: true, icon: Trash2, action: () => host.removeMany(pages) },
			], at);
			return;
		}
		const items: MenuItem[] = [
			...(committable ? [{ label: t('提交到 git…'), icon: GitCommitHorizontal, action: () => host.commit(article) }, 'separator' as const] : []),
			{ label: t('在下面新建页面'), icon: Plus, action: () => host.createChild(article) },
			...(host.toggleFavorite ? [{ label: host.isFavorite?.(article.slug) ? t('移出常用') : t('加入常用'), icon: Star, action: () => host.toggleFavorite!(article.slug) }] : []),
			{ label: t('移到…'), icon: FolderInput, action: () => host.moveTo([article.slug]) },
			...(article.parent ? [{ label: t('移到最上层'), icon: ArrowUpToLine, action: () => host.move([article.slug], '') }, { label: t('并入上级页面…'), icon: Merge, action: () => host.merge(article) }] : []),
			'separator',
			{ label: t('复制一份'), icon: Copy, action: () => host.duplicate(article) },
			'separator',
			{ label: t('移到回收站'), danger: true, icon: Trash2, action: () => host.remove(article) },
		];
		showContextMenu(items, at);
	}

	function keyDown(event: KeyboardEvent<HTMLButtonElement>): void {
		if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
			event.preventDefault();
			menu(event.currentTarget);
			return;
		}
		if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
		// The tree from the keyboard (as SiYuan has it): ↑↓ from page to page, → unfolds (or goes in), ← folds (or goes up
		// to the page it is under), ⌫ deletes.
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const rows = [...document.querySelectorAll<HTMLElement>('#article-list .page-row')];
			rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
		} else if (event.key === 'ArrowRight') {
			if (!under.length && !tables.length) return;
			if (isFolded) actions.setFolded(article.slug, false);
			else if (under.length) actions.focusRow(under[0]!.slug);
		} else if (event.key === 'ArrowLeft') {
			const up = tree.placedUnder(article);
			if ((under.length || tables.length) && !isFolded) actions.setFolded(article.slug, true);
			else if (up) actions.focusRow(up);
			else return;
		} else if (event.key === 'Backspace' || event.key === 'Delete') {
			if (chosen.size > 1 && chosen.has(article.slug)) host.removeMany(actions.topmost(chosen).map((slug) => articles.find((entry) => entry.slug === slug)!).filter(Boolean));
			else host.remove(article);
		} else if (event.key === 'Escape' && chosen.size) {
			actions.unchoose();
		} else return;
		event.preventDefault();
	}

	// Where on the page it is let go of says where it goes (as SiYuan has it): its top quarter, just above it (under the
	// same page); its bottom quarter, just below; between, under it.
	function zoneAt(event: DragEvent<HTMLElement>): DropZone | null {
		if (!drag || drag.group.some((slug) => within(articles, article.slug, slug))) return null;
		const box = event.currentTarget.getBoundingClientRect();
		const at = box.height ? (event.clientY - box.top) / box.height : 0.5;
		const zone: DropZone = at < 0.25 ? 'before' : at > 0.75 ? 'after' : 'into';
		const page = articles.find((entry) => entry.slug === drag.slug);
		// Into the page it is under already: nothing to do.
		if (zone === 'into' && drag.group.length === 1 && page?.parent === article.slug) return null;
		return zone;
	}

	const marked = drop?.slug === article.slug ? ` is-drop-${drop.zone}` : '';
	return (
		<div className="page-branch">
			<div
				className={`page-item${active ? ' active' : ''}${chosen.has(article.slug) ? ' is-chosen' : ''}${under.length || tables.length ? ' has-children' : ''}${marked}`}
				data-slug={article.slug}
				data-draft={article.draft !== false ? '' : undefined}
				style={{ '--depth': String(depth) } as CSSProperties}
				draggable
				onDragStart={(event) => {
					setDrag({ slug: article.slug, group: chosen.has(article.slug) && chosen.size > 1 ? actions.topmost(chosen) : [article.slug] });
					event.dataTransfer.setData(DRAGGED_TYPE, article.slug);
					event.dataTransfer.effectAllowed = 'move';
				}}
				onDragEnd={() => {
					setDrag(null);
					setDrop(null);
				}}
				onDragOver={(event) => {
					const zone = zoneAt(event);
					if (!zone) return;
					event.preventDefault();
					event.stopPropagation();
					overPage();
					if (drop?.slug !== article.slug || drop.zone !== zone) setDrop({ slug: article.slug, zone });
				}}
				onDragLeave={(event) => {
					if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
						if (drop?.slug === article.slug) setDrop(null);
					}
				}}
				onDrop={(event) => {
					setDrop(null);
					const zone = zoneAt(event);
					if (!zone || !drag) return;
					event.preventDefault();
					event.stopPropagation();
					const group = drag.group;
					setDrag(null);
					actions.unchoose();
					if (zone === 'into') host.move(group, article.slug);
					else host.move(group, tree.placedUnder(article), { [zone]: article.slug });
				}}
			>
				{/* The pages under it: shown or folded by the triangle beside it. */}
				{under.length || tables.length ? (
					<button
						type="button"
						className="page-toggle"
						aria-label={isFolded ? t('展开「{title}」下面的页面', { title: article.title }) : t('收起「{title}」下面的页面', { title: article.title })}
						aria-expanded={!isFolded}
						onClick={() => actions.setFolded(article.slug, !isFolded)}
					>
						<ChevronRight aria-hidden />
					</button>
				) : (
					<button type="button" className="page-toggle" tabIndex={-1} aria-hidden disabled />
				)}
				<button
					type="button"
					className={`page-row${active ? ' active' : ''}`}
					aria-current={active ? 'page' : 'false'}
					onClick={(event: MouseEvent) => {
						if (actions.choose(article.slug, event)) return;
						actions.open(article.slug);
					}}
					onContextMenu={(event) => {
						event.preventDefault();
						menu({ x: event.clientX, y: event.clientY });
					}}
					onKeyDown={keyDown}
				>
					<span className={`page-icon${article.icon ? ' is-emoji' : ''}`}>{article.icon || <FileText aria-hidden />}</span>
					<span className="page-title" title={article.draft !== false ? t('{title}（草稿，尚未发布）', { title: article.title }) : article.title}>
						{article.title}
					</span>
					{/* Folded: how many pages are under it, beside its title. */}
					{(under.length > 0 || tables.length > 0) && isFolded && (
						<span className="page-count" title={t('下面有 {count} 个页面', { count: countUnder(state, article.slug) })}>
							{countUnder(state, article.slug)}
						</span>
					)}
					{uncommitted && (
						<span className={`page-git is-${uncommitted}`} title={uncommitted === 'new' ? t('新文章，还没提交到 git') : t('有改动还没提交到 git')}>
							●
						</span>
					)}
				</button>
				{/* A new page under it, at once, and what else can be done to it: shown on hover, as in Notion. */}
				<button type="button" className="page-add" title={t('在下面新建页面')} aria-label={t('在「{title}」下面新建页面', { title: article.title })} onClick={() => host.createChild(article)}>
					<Plus aria-hidden />
				</button>
				<button type="button" className="page-more" title={t('更多操作')} aria-label={t('{title} 的更多操作', { title: article.title })} onClick={(event) => menu(event.currentTarget)}>
					<Ellipsis aria-hidden />
				</button>
			</div>
			{!isFolded && under.map((child) => <Row key={child.slug} article={child} depth={depth + 1} state={state} actions={actions} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} overPage={overPage} />)}
			{!isFolded &&
				tables.map((table) => (
					<Table key={table.key} table={table} depth={depth + 1} state={state} actions={actions}>
						{table.rows.map((child) => <Row key={child.slug} article={child} depth={depth + 2} state={state} actions={actions} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} overPage={overPage} />)}
					</Table>
				))}
		</div>
	);
}

/**
 * A database of a page in the tree, as Notion's sidebar has one: its name with a table's icon, its rows under it
 * (folded until opened, how many beside it then); clicked, its page opened at it.
 */
function Table({ table, depth, state, actions, children }: { table: TreeTable; depth: number; state: TreeState; actions: TreeActions; children: ReactNode }) {
	const open = state.opened.has(table.key);
	const title = table.title || t('无标题数据库');
	return (
		<div className="page-branch">
			<div className={`page-item is-database${table.rows.length ? ' has-children' : ''}`} data-database={table.key} style={{ '--depth': String(depth) } as CSSProperties}>
				{table.rows.length ? (
					<button
						type="button"
						className="page-toggle"
						aria-label={open ? t('收起「{title}」的行', { title }) : t('展开「{title}」的行', { title })}
						aria-expanded={open}
						onClick={() => actions.setOpened(table.key, !open)}
					>
						<ChevronRight aria-hidden />
					</button>
				) : (
					<button type="button" className="page-toggle" tabIndex={-1} aria-hidden disabled />
				)}
				<button
					type="button"
					className="page-row"
					onClick={() => {
						if (actions.host.openDatabase) actions.host.openDatabase(table.page, table.id);
						else actions.open(table.page);
					}}
					onKeyDown={(event) => {
						if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
						// As a page's: ↑↓ from row to row, → shows its rows, ← hides them.
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							const rows = [...document.querySelectorAll<HTMLElement>('#article-list .page-row')];
							rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
						} else if (event.key === 'ArrowRight' && table.rows.length && !open) actions.setOpened(table.key, true);
						else if (event.key === 'ArrowLeft' && open) actions.setOpened(table.key, false);
						else return;
						event.preventDefault();
					}}
				>
					<span className="page-icon">
						<Table2 aria-hidden />
					</span>
					<span className="page-title">{title}</span>
					{table.rows.length > 0 && !open && (
						<span className="page-count" title={t('{count} 行', { count: table.rows.length })}>
							{table.rows.length}
						</span>
					)}
				</button>
			</div>
			{open && children}
		</div>
	);
}

/**
 * The pages in the left column, as a tree: each opened by a click, chosen with ⌘ or ⇧ to move or delete together,
 * dragged above, into or below another, folded, gone through from the keyboard; its menu from the right button. `root`
 * is the element it is drawn in (#article-list), marked while a page is dragged.
 */
export function PageTree({ store, actions, root }: { store: Store<TreeState>; actions: TreeActions; root: HTMLElement }) {
	const live = useStore(store);
	const [drag, setDrag] = useState<Drag | null>(null);
	const [drop, setDrop] = useState<{ slug: string; zone: DropZone } | null>(null);
	const [dropTop, setDropTop] = useState(false);
	// What changes while a page is dragged waits for the drop: the page moved from under the pointer would end the drag.
	const kept = useRef(live);
	if (!drag) kept.current = live;
	const state = kept.current;

	useEffect(() => {
		root.classList.toggle('is-dragging-page', Boolean(drag));
		root.classList.toggle('is-drop-top', dropTop);
	}, [drag, dropTop]);
	// The open page in sight in the list: the page opened from elsewhere (a link, ⌘K) is found there.
	useEffect(() => {
		root.querySelector('.page-item.active')?.scrollIntoView({ block: 'nearest' });
	}, [state.selected]);
	useEffect(() => {
		if (state.focus) root.querySelector<HTMLElement>(`.page-item[data-slug="${CSS.escape(state.focus.slug)}"] .page-row`)?.focus();
	}, [state.focus]);
	// The room below the pages: a page dropped there goes to the top. Listened to on the list itself, where React hears
	// the pages' too (first): one a page took (its default prevented) is that page's.
	useEffect(() => {
		const toTop = () => {
			const page = state.articles.find((article) => article.slug === drag?.slug);
			return Boolean(drag && (page?.parent || drag.group.length > 1));
		};
		const over = (event: globalThis.DragEvent) => {
			if (event.defaultPrevented || !toTop()) return;
			event.preventDefault();
			setDropTop(true);
		};
		const leave = (event: globalThis.DragEvent) => {
			if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) setDropTop(false);
		};
		const dropped = (event: globalThis.DragEvent) => {
			setDropTop(false);
			if (event.defaultPrevented || !toTop() || !drag) return;
			event.preventDefault();
			const group = drag.group;
			setDrag(null);
			actions.unchoose();
			actions.host.move(group, '');
		};
		root.addEventListener('dragover', over);
		root.addEventListener('dragleave', leave);
		root.addEventListener('drop', dropped);
		return () => {
			root.removeEventListener('dragover', over);
			root.removeEventListener('dragleave', leave);
			root.removeEventListener('drop', dropped);
		};
	}, [drag, state.articles]);

	if (!state.articles.length) return state.read ? <p className="article-list-empty">{t('还没有文章。点击 ＋ 创建第一篇笔记。')}</p> : null;
	return (
		<div className="page-list">
			{state.tree.roots.map((article) => (
				<Row key={article.slug} article={article} depth={0} state={state} actions={actions} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} overPage={() => setDropTop(false)} />
			))}
		</div>
	);
}
