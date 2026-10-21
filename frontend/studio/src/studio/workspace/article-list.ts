import { listArticles, type PagePlace } from '../api/client.ts';
import { comparePages } from '../../articles/page-order.mjs';
import type { ArticleProperties, ArticleSummary, GitStatus } from '../types.ts';
import { showContextMenu } from './context-menu.ts';
import type { DiskChange } from './disk-events.ts';

/** What can be done to a whole article from the list. */
export type ArticleListHost = {
	open(slug: string): void;
	rename(article: ArticleSummary): void;
	duplicate(article: ArticleSummary): void;
	remove(article: ArticleSummary): void;
	/** Commits it to git; offered when git has changes of it to commit. */
	commit(article: ArticleSummary): void;
	/** The articles, each time they are read. */
	listed?(articles: ArticleSummary[]): void;
	/** A new page under this one. */
	createChild(article: ArticleSummary): void;
	/** 并入上级页面: its text into the page it is under, as a section. */
	merge(article: ArticleSummary): void;
	/**
	 * Puts the pages (in this order) under another page (its folder name), or at the top with `parent` empty; with
	 * `place`, there among those, one after the other.
	 */
	move(slugs: string[], parent: string, place?: PagePlace): void;
	/** 「移到…」: asks where, then moves the pages there. */
	moveTo(slugs: string[]): void;
	/** Several pages to the trash, with the pages under them. */
	removeMany(articles: ArticleSummary[]): void;
};

/** Where on a page what is dragged is let go of: just above it, under it, just below it. */
type DropZone = 'before' | 'into' | 'after';

const REFRESH_DELAY_MS = 300;

/** The pages whose pages under them are hidden (folded), kept for the next visit. */
const FOLDED_KEY = 'studio.page-tree.folded';
/** What a page dragged in the list carries: its folder name. */
const DRAGGED_TYPE = 'application/x-studio-page';

function readFolded(): Set<string> {
	try {
		const kept = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]');
		return new Set(Array.isArray(kept) ? kept.filter((slug) => typeof slug === 'string') : []);
	} catch {
		return new Set();
	}
}

function keepFolded(folded: Set<string>): void {
	try {
		localStorage.setItem(FOLDED_KEY, JSON.stringify([...folded]));
	} catch {
		// Not kept: folded for this visit only.
	}
}

/**
 * The tree of pages: each under the one its `parent:` names. One whose
 * parent is not there (deleted, misspelt), or that would be under itself, is
 * at the top.
 */
export function pageTree(articles: ArticleSummary[]): { roots: ArticleSummary[]; children: Map<string, ArticleSummary[]>; placedUnder: (article: ArticleSummary) => string } {
	const bySlug = new Map(articles.map((article) => [article.slug, article]));
	const placedUnder = (article: ArticleSummary): string => {
		const parent = article.parent ?? '';
		if (!parent || !bySlug.has(parent)) return '';
		// Up the line of parents: back to itself is a loop.
		for (let at: string | undefined = parent, steps = 0; at && steps <= articles.length; at = bySlug.get(at)?.parent, steps += 1) {
			if (at === article.slug) return '';
		}
		return parent;
	};
	const roots: ArticleSummary[] = [];
	const children = new Map<string, ArticleSummary[]>();
	for (const article of [...articles].sort(comparePages)) {
		const parent = placedUnder(article);
		if (!parent) roots.push(article);
		else children.set(parent, [...(children.get(parent) ?? []), article]);
	}
	return { roots, children, placedUnder };
}

/** Articles whose title or folder holds the query, ignoring case. */
export function filterArticles(articles: ArticleSummary[], query: string): ArticleSummary[] {
	const needle = query.trim().toLocaleLowerCase('zh-CN');
	if (!needle) return articles;
	return articles.filter((article) => `${article.title}\n${article.slug}`.toLocaleLowerCase('zh-CN').includes(needle));
}

/** The pages in the sidebar. */
export function createArticleList(root: HTMLElement, host: ArticleListHost) {
	const list = root.querySelector<HTMLElement>('#article-list')!;
	let articles: ArticleSummary[] = [];
	let selected: string | null = null;
	let refreshTimer = 0;
	let git: GitStatus | null = null;

	const folded = readFolded();
	let tree: ReturnType<typeof pageTree> = { roots: [], children: new Map(), placedUnder: () => '' };
	/** The page a page shows under in the tree (its parent if that is there), empty for the top. */
	const placedUnder = (article: ArticleSummary) => tree.placedUnder(article);
	/** The page being dragged in the list, and the pages that go with it (the pages chosen, when it is one of them). */
	let dragged: string | null = null;
	let draggedGroup: string[] = [];
	/**
	 * Pages chosen (as SiYuan has it: ⌘-click one by one, ⇧-click a run of
	 * them), to move or delete together; the last one clicked, where a run starts.
	 */
	const chosen = new Set<string>();
	let chosenFrom: string | null = null;

	/** Of these pages, those not under another of them (moving or deleting that one takes them along), in the list's order. */
	function topmost(slugs: Iterable<string>): string[] {
		const all = new Set(slugs);
		const order = visibleOrder();
		const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
		return [...all]
			.filter((slug) => ![...all].some((other) => other !== slug && within(slug, other)))
			.sort((a, b) => rank(a) - rank(b));
	}

	/** The pages as the list shows them, top to bottom (folded ones' pages left out). */
	function visibleOrder(): string[] {
		return [...list.querySelectorAll<HTMLElement>('.page-item')].map((item) => item.dataset.slug ?? '');
	}

	function choose(slug: string, event: MouseEvent): boolean {
		if (event.metaKey || event.ctrlKey) {
			if (!chosen.size && selected && selected !== slug) chosen.add(selected);
			if (chosen.has(slug)) chosen.delete(slug);
			else chosen.add(slug);
			chosenFrom = slug;
		} else if (event.shiftKey) {
			const order = visibleOrder();
			const from = order.indexOf(chosenFrom ?? selected ?? slug);
			const to = order.indexOf(slug);
			if (from < 0 || to < 0) return false;
			chosen.clear();
			for (const page of order.slice(Math.min(from, to), Math.max(from, to) + 1)) chosen.add(page);
		} else return false;
		render();
		return true;
	}

	function unchoose(): void {
		if (!chosen.size) return;
		chosen.clear();
		chosenFrom = null;
		render();
	}

	/** Whether `slug` is `ancestor` or under it. */
	function within(slug: string, ancestor: string): boolean {
		const bySlug = new Map(articles.map((article) => [article.slug, article]));
		for (let at: string | undefined = slug, steps = 0; at && steps <= articles.length; at = bySlug.get(at)?.parent, steps += 1) {
			if (at === ancestor) return true;
		}
		return false;
	}

	function setFolded(slug: string, fold: boolean): void {
		if (fold) folded.add(slug);
		else folded.delete(slug);
		keepFolded(folded);
		render();
		focusRow(slug);
	}

	function focusRow(slug: string): void {
		list.querySelector<HTMLElement>(`.page-item[data-slug="${CSS.escape(slug)}"] .page-row`)?.focus();
	}

	/** How many pages are under `slug`, all the way down. */
	function countUnder(slug: string): number {
		return (tree.children.get(slug) ?? []).reduce((total, child) => total + 1 + countUnder(child.slug), 0);
	}

	function row(article: ArticleSummary, depth: number): HTMLElement {
		const active = article.slug === selected;
		const open = document.createElement('button');
		open.type = 'button';
		open.className = `page-row${active ? ' active' : ''}`;
		open.setAttribute('aria-current', active ? 'page' : 'false');
		const icon = document.createElement('span');
		icon.className = `page-icon${article.icon ? ' is-emoji' : ''}`;
		icon.textContent = article.icon || '▤';
		const title = document.createElement('span');
		title.className = 'page-title';
		title.textContent = article.title;
		open.append(icon, title);
		if (article.draft !== false) {
			const draft = document.createElement('span');
			draft.className = 'page-draft';
			draft.textContent = '草稿';
			draft.title = '尚未发布';
			open.append(draft);
		}
		const uncommitted = git?.changed[article.slug];
		if (uncommitted) {
			const mark = document.createElement('span');
			mark.className = `page-git is-${uncommitted}`;
			mark.textContent = '●';
			mark.title = uncommitted === 'new' ? '新文章，还没提交到 git' : '有改动还没提交到 git';
			open.append(mark);
		}
		open.addEventListener('click', (event) => {
			if (choose(article.slug, event)) return;
			unchoose();
			chosenFrom = article.slug;
			host.open(article.slug);
		});
		// Right-click, or the menu key: what else can be done to it.
		const committable = Boolean(git?.available && (uncommitted || git.vanished.length));
		const menu = (at: { x: number; y: number } | HTMLElement) => {
			// One of several chosen: what is done to them all.
			if (chosen.size > 1 && chosen.has(article.slug)) {
				const group = topmost(chosen);
				const pages = group.map((slug) => articles.find((entry) => entry.slug === slug)!).filter(Boolean);
				showContextMenu([
					{ label: `移到…（${group.length} 篇）`, action: () => host.moveTo(group) },
					{ label: '移到最上层', action: () => host.move(group, '') },
					'separator',
					{ label: `移到回收站（${group.length} 篇）`, danger: true, action: () => host.removeMany(pages) },
				], at);
				return;
			}
			singleMenu(at);
		};
		const singleMenu = (at: { x: number; y: number } | HTMLElement) => showContextMenu([
			...(committable ? [{ label: '提交到 git…', action: () => host.commit(article) }, 'separator' as const] : []),
			{ label: '在下面新建页面', action: () => host.createChild(article) },
			{ label: '移到…', action: () => host.moveTo([article.slug]) },
			...(article.parent ? [{ label: '移到最上层', action: () => host.move([article.slug], '') }, { label: '并入上级页面…', action: () => host.merge(article) }] : []),
			'separator',
			{ label: '改文件夹名…', action: () => host.rename(article) },
			{ label: '复制一份', action: () => host.duplicate(article) },
			'separator',
			{ label: '移到回收站', danger: true, action: () => host.remove(article) },
		], at);
		open.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			menu({ x: event.clientX, y: event.clientY });
		});
		open.addEventListener('keydown', (event) => {
			if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
				event.preventDefault();
				menu(open);
				return;
			}
			if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
			// The tree from the keyboard (as SiYuan has it): ↑↓ from page to page, → unfolds (or goes in), ← folds
			// (or goes up to the page it is under), ⌫ deletes.
			const under = tree.children.get(article.slug) ?? [];
			const folded_ = folded.has(article.slug);
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				const rows = [...list.querySelectorAll<HTMLElement>('.page-row')];
				rows[rows.indexOf(open) + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
			} else if (event.key === 'ArrowRight') {
				if (!under.length) return;
				if (folded_) setFolded(article.slug, false);
				else focusRow(under[0]!.slug);
			} else if (event.key === 'ArrowLeft') {
				if (under.length && !folded_) setFolded(article.slug, true);
				else if (placedUnder(article)) focusRow(placedUnder(article));
				else return;
			} else if (event.key === 'Backspace' || event.key === 'Delete') {
				if (chosen.size > 1 && chosen.has(article.slug)) host.removeMany(topmost(chosen).map((slug) => articles.find((entry) => entry.slug === slug)!).filter(Boolean));
				else host.remove(article);
			} else if (event.key === 'Escape' && chosen.size) {
				unchoose();
			} else return;
			event.preventDefault();
		});
		// The same menu, from a ⋯ that shows on hover, as in Notion.
		const more = document.createElement('button');
		more.type = 'button';
		more.className = 'page-more';
		more.textContent = '⋯';
		more.title = '更多操作';
		more.setAttribute('aria-label', `${article.title} 的更多操作`);
		more.addEventListener('click', () => menu(more));
		// A new page under it, at once: the ＋ that shows on hover, as in Notion.
		const add = document.createElement('button');
		add.type = 'button';
		add.className = 'page-add';
		add.textContent = '＋';
		add.title = '在下面新建页面';
		add.setAttribute('aria-label', `在「${article.title}」下面新建页面`);
		add.addEventListener('click', () => host.createChild(article));
		const item = document.createElement('div');
		item.className = `page-item${active ? ' active' : ''}${chosen.has(article.slug) ? ' is-chosen' : ''}`;
		item.dataset.slug = article.slug;
		item.style.setProperty('--depth', String(depth));
		// The pages under it: shown or folded by the triangle beside it.
		const under = tree.children.get(article.slug) ?? [];
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'page-toggle';
		if (under.length) {
			const isFolded = folded.has(article.slug);
			// Folded: how many pages are under it, beside its title.
			if (isFolded) {
				const count = document.createElement('span');
				count.className = 'page-count';
				count.textContent = String(countUnder(article.slug));
				count.title = `下面有 ${count.textContent} 个页面`;
				title.after(count);
			}
			toggle.textContent = isFolded ? '▸' : '▾';
			toggle.setAttribute('aria-label', isFolded ? `展开「${article.title}」下面的页面` : `收起「${article.title}」下面的页面`);
			toggle.setAttribute('aria-expanded', String(!isFolded));
			toggle.addEventListener('click', () => setFolded(article.slug, !folded.has(article.slug)));
		} else {
			toggle.tabIndex = -1;
			toggle.setAttribute('aria-hidden', 'true');
			toggle.disabled = true;
		}
		item.append(toggle, open, add, more);
		// Dragged onto another page: under it. Onto the list's room below the pages: at the top.
		item.draggable = true;
		item.addEventListener('dragstart', (event) => {
			dragged = article.slug;
			draggedGroup = chosen.has(article.slug) && chosen.size > 1 ? topmost(chosen) : [article.slug];
			event.dataTransfer?.setData(DRAGGED_TYPE, article.slug);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
			list.classList.add('is-dragging-page');
		});
		item.addEventListener('dragend', () => {
			dragged = null;
			draggedGroup = [];
			list.classList.remove('is-dragging-page');
			if (renderLater) {
				renderLater = false;
				render();
			}
			list.querySelectorAll('.is-drop-into, .is-drop-before, .is-drop-after').forEach((element) => element.classList.remove('is-drop-into', 'is-drop-before', 'is-drop-after'));
			list.classList.remove('is-drop-top');
		});
		// Where on the page it is let go of says where it goes (as SiYuan has it): its top fifth, just above it
		// (under the same page); its bottom fifth, just below; between, under it.
		const zoneAt = (event: DragEvent): DropZone | null => {
			if (!dragged || draggedGroup.some((slug) => within(article.slug, slug))) return null;
			const box = item.getBoundingClientRect();
			const at = box.height ? (event.clientY - box.top) / box.height : 0.5;
			const zone: DropZone = at < 0.25 ? 'before' : at > 0.75 ? 'after' : 'into';
			const page = articles.find((entry) => entry.slug === dragged);
			// Into the page it is under already: nothing to do.
			if (zone === 'into' && draggedGroup.length === 1 && page?.parent === article.slug) return null;
			return zone;
		};
		const unmark = () => item.classList.remove('is-drop-into', 'is-drop-before', 'is-drop-after');
		item.addEventListener('dragover', (event) => {
			const zone = zoneAt(event);
			if (!zone) return;
			event.preventDefault();
			event.stopPropagation();
			list.classList.remove('is-drop-top');
			unmark();
			item.classList.add(`is-drop-${zone}`);
		});
		item.addEventListener('dragleave', (event) => {
			if (!(event.relatedTarget instanceof Node) || !item.contains(event.relatedTarget)) unmark();
		});
		item.addEventListener('drop', (event) => {
			unmark();
			const zone = zoneAt(event);
			if (!zone || !dragged) return;
			event.preventDefault();
			event.stopPropagation();
			const group = draggedGroup;
			dragged = null;
			unchoose();
			if (zone === 'into') host.move(group, article.slug);
			else host.move(group, placedUnder(article), { [zone]: article.slug });
		});
		const branch = document.createElement('div');
		branch.className = 'page-branch';
		branch.append(item);
		if (under.length && !folded.has(article.slug)) branch.append(...under.map((child) => row(child, depth + 1)));
		return branch;
	}

	/** Something to show came while a page was being dragged: shown once the drag ends. */
	let renderLater = false;

	/** What the list was last drawn from: drawn again only when that changed. */
	let drawn = '';

	function render(): void {
		// Not under the drag: drawn anew, the page dragged would go and the drag with it.
		if (dragged) {
			renderLater = true;
			return;
		}
		// Not drawn again for nothing (git's answer, the list read again, the same): what the pointer is on
		// (a ⋯ about to be clicked, a page about to be dragged) stays.
		const state = JSON.stringify([
			articles.map((article) => [article.slug, article.title, article.parent, article.order, article.draft, article.icon]),
			git?.available,
			git?.changed,
			git?.vanished.length,
			selected,
			[...chosen],
			[...folded],
		]);
		if (state === drawn && list.childElementCount) return;
		drawn = state;
		list.replaceChildren();
		if (!articles.length) {
			const empty = document.createElement('p');
			empty.className = 'article-list-empty';
			empty.textContent = '还没有文章。点击 ＋ 创建第一篇笔记。';
			list.append(empty);
			return;
		}
		tree = pageTree(articles);
		const pages = document.createElement('div');
		pages.className = 'page-list';
		pages.append(...tree.roots.map((article) => row(article, 0)));
		list.append(pages);
	}

	// The room below the pages: a page dropped there goes to the top.
	list.addEventListener('dragover', (event) => {
		if (!dragged) return;
		const page = articles.find((article) => article.slug === dragged);
		if (!page?.parent && draggedGroup.length < 2) return;
		event.preventDefault();
		list.classList.add('is-drop-top');
	});
	list.addEventListener('dragleave', (event) => {
		if (!(event.relatedTarget instanceof Node) || !list.contains(event.relatedTarget)) list.classList.remove('is-drop-top');
	});
	list.addEventListener('drop', (event) => {
		list.classList.remove('is-drop-top');
		if (!dragged) return;
		const page = articles.find((article) => article.slug === dragged);
		if (!page?.parent && draggedGroup.length < 2) return;
		event.preventDefault();
		const group = draggedGroup;
		dragged = null;
		unchoose();
		host.move(group, '');
	});

	/** The pages it is under unfolded, so that it shows. */
	function unfoldTo(slug: string): void {
		const bySlug = new Map(articles.map((article) => [article.slug, article]));
		let changed = false;
		for (let at = bySlug.get(slug)?.parent, steps = 0; at && steps <= articles.length; at = bySlug.get(at)?.parent, steps += 1) {
			if (folded.delete(at)) changed = true;
		}
		if (changed) keepFolded(folded);
	}

	/** Reads the articles again. */
	async function load(): Promise<ArticleSummary[]> {
		articles = await listArticles();
		render();
		host.listed?.(articles);
		return articles;
	}


	return {
		load,
		/** The articles as last read. */
		articles: (): ArticleSummary[] => articles,
		/** What git says has not been committed. */
		showGit(status: GitStatus): void {
			git = status;
			render();
		},
		/** Marks the open article. */
		select(slug: string): void {
			selected = slug;
			unfoldTo(slug);
			render();
			// In sight in the list: the page opened from elsewhere (a link, ⌘K) is found there.
			list.querySelector('.page-item.active')?.scrollIntoView({ block: 'nearest' });
		},
		/** The pages right under `slug` (empty for the top), in the tree's order. */
		childrenOf(slug: string): ArticleSummary[] {
			return slug ? (tree.children.get(slug) ?? []) : tree.roots;
		},
		/** The open article's title as it is typed, before it is saved: the list follows it, as in Notion. */
		retitled(slug: string, title: string): void {
			const article = articles.find((entry) => entry.slug === slug);
			if (!article || !title.trim() || article.title === title) return;
			article.title = title;
			render();
		},
		/** An article's saved title and draft state. */
		saved(slug: string, properties: ArticleProperties): void {
			const article = articles.find((entry) => entry.slug === slug);
			if (!article) return;
			article.title = properties.title;
			article.draft = properties.draft;
			if (properties.icon !== undefined) article.icon = properties.icon;
			if (properties.parent !== undefined) article.parent = properties.parent;
			article.tags = properties.tags;
			render();
		},
		/** Something changed in blog/: an article may have come, gone or been retitled. */
		changedOnDisk(changes: DiskChange[]): void {
			if (!changes.some((change) => change.paths.includes('') || change.paths.includes('index.md'))) return;
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => { load().catch(() => {}); }, REFRESH_DELAY_MS);
		},
	};
}
