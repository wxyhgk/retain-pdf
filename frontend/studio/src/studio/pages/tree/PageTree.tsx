import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';

import { showContextMenu, type MenuItem } from '../../common/context-menu';
import { useStore, type Store } from '../../shell/store';
import type { ArticleSummary } from '../../types';
import { within } from './page-tree';
import type { TreeActions, TreeState } from './tree-state';

/** Where on a page what is dragged is let go of: just above it, under it, just below it. */
type DropZone = 'before' | 'into' | 'after';
/** What a page dragged in the list carries: its folder name. */
const DRAGGED_TYPE = 'application/x-studio-page';

/** A page being dragged, and the pages that go with it (the pages chosen, when it is one of them). */
type Drag = { slug: string; group: string[] };

/** How many pages are under `slug`, all the way down. */
function countUnder(state: TreeState, slug: string): number {
	return (state.tree.children.get(slug) ?? []).reduce((total, child) => total + 1 + countUnder(state, child.slug), 0);
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
	const isFolded = folded.has(article.slug);
	const uncommitted = git?.changed[article.slug];
	const committable = Boolean(git?.available && (uncommitted || git.vanished.length));

	/** What can be done to it (or, one of several chosen, to them all), from the right button, the menu key or ⋯. */
	function menu(at: { x: number; y: number } | HTMLElement): void {
		if (chosen.size > 1 && chosen.has(article.slug)) {
			const group = actions.topmost(chosen);
			const pages = group.map((slug) => articles.find((entry) => entry.slug === slug)!).filter(Boolean);
			showContextMenu([
				{ label: `移到…（${group.length} 篇）`, action: () => host.moveTo(group) },
				{ label: '移到最上层', action: () => host.move(group, '') },
				'separator',
				{ label: `移到回收站（${group.length} 篇）`, danger: true, action: () => host.removeMany(pages) },
			], at);
			return;
		}
		const items: MenuItem[] = [
			...(committable ? [{ label: '提交到 git…', action: () => host.commit(article) }, 'separator' as const] : []),
			{ label: '在下面新建页面', action: () => host.createChild(article) },
			{ label: '移到…', action: () => host.moveTo([article.slug]) },
			...(article.parent ? [{ label: '移到最上层', action: () => host.move([article.slug], '') }, { label: '并入上级页面…', action: () => host.merge(article) }] : []),
			'separator',
			{ label: '改文件夹名…', action: () => host.rename(article) },
			{ label: '复制一份', action: () => host.duplicate(article) },
			'separator',
			{ label: '移到回收站', danger: true, action: () => host.remove(article) },
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
			if (!under.length) return;
			if (isFolded) actions.setFolded(article.slug, false);
			else actions.focusRow(under[0]!.slug);
		} else if (event.key === 'ArrowLeft') {
			const up = tree.placedUnder(article);
			if (under.length && !isFolded) actions.setFolded(article.slug, true);
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
				className={`page-item${active ? ' active' : ''}${chosen.has(article.slug) ? ' is-chosen' : ''}${marked}`}
				data-slug={article.slug}
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
				{under.length ? (
					<button
						type="button"
						className="page-toggle"
						aria-label={isFolded ? `展开「${article.title}」下面的页面` : `收起「${article.title}」下面的页面`}
						aria-expanded={!isFolded}
						onClick={() => actions.setFolded(article.slug, !isFolded)}
					>
						{isFolded ? '▸' : '▾'}
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
					<span className={`page-icon${article.icon ? ' is-emoji' : ''}`}>{article.icon || '▤'}</span>
					<span className="page-title">{article.title}</span>
					{/* Folded: how many pages are under it, beside its title. */}
					{under.length > 0 && isFolded && (
						<span className="page-count" title={`下面有 ${countUnder(state, article.slug)} 个页面`}>
							{countUnder(state, article.slug)}
						</span>
					)}
					{article.draft !== false && (
						<span className="page-draft" title="尚未发布">
							草稿
						</span>
					)}
					{uncommitted && (
						<span className={`page-git is-${uncommitted}`} title={uncommitted === 'new' ? '新文章，还没提交到 git' : '有改动还没提交到 git'}>
							●
						</span>
					)}
				</button>
				{/* A new page under it, at once, and what else can be done to it: shown on hover, as in Notion. */}
				<button type="button" className="page-add" title="在下面新建页面" aria-label={`在「${article.title}」下面新建页面`} onClick={() => host.createChild(article)}>
					＋
				</button>
				<button type="button" className="page-more" title="更多操作" aria-label={`${article.title} 的更多操作`} onClick={(event) => menu(event.currentTarget)}>
					⋯
				</button>
			</div>
			{!isFolded && under.map((child) => <Row key={child.slug} article={child} depth={depth + 1} state={state} actions={actions} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} overPage={overPage} />)}
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

	if (!state.articles.length) return state.read ? <p className="article-list-empty">还没有文章。点击 ＋ 创建第一篇笔记。</p> : null;
	return (
		<div className="page-list">
			{state.tree.roots.map((article) => (
				<Row key={article.slug} article={article} depth={0} state={state} actions={actions} drag={drag} setDrag={setDrag} drop={drop} setDrop={setDrop} overPage={() => setDropTop(false)} />
			))}
		</div>
	);
}
