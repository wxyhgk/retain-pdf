import { listArticles, type PagePlace } from '../../api/client.ts';
import type { DiskChange } from '../../common/disk-events.ts';
import { createStore, type Store } from '../../shell/store.ts';
import type { ArticleProperties, ArticleSummary, GitStatus } from '../../types.ts';
import { pageTree, visibleOrder, within, type PageTree } from './page-tree.ts';

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

/** What the tree shows (PageTree.tsx draws it). */
export type TreeState = {
	articles: ArticleSummary[];
	/** Read once at least: an empty list then says there are none. */
	read: boolean;
	tree: PageTree;
	/** The open article. */
	selected: string | null;
	/** Pages chosen (as SiYuan has it: ⌘-click one by one, ⇧-click a run of them), to move or delete together. */
	chosen: ReadonlySet<string>;
	/** The last one clicked, where a run starts. */
	chosenFrom: string | null;
	/** The pages whose pages under them are hidden, kept for the next visit. */
	folded: ReadonlySet<string>;
	git: GitStatus | null;
	/** A row to take the keys once drawn (after folding, going up or in), counted so each ask is one. */
	focus: { slug: string; asked: number } | null;
};

const REFRESH_DELAY_MS = 300;
const FOLDED_KEY = 'studio.page-tree.folded';

function readFolded(): Set<string> {
	try {
		const kept = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]');
		return new Set(Array.isArray(kept) ? kept.filter((slug) => typeof slug === 'string') : []);
	} catch {
		return new Set();
	}
}

function keepFolded(folded: ReadonlySet<string>): void {
	try {
		localStorage.setItem(FOLDED_KEY, JSON.stringify([...folded]));
	} catch {
		// Not kept: folded for this visit only.
	}
}

/** The page tree's state, and what changes it. */
export function createTreeState(host: ArticleListHost) {
	const store: Store<TreeState> = createStore<TreeState>({ articles: [], read: false, tree: pageTree([]), selected: null, chosen: new Set(), chosenFrom: null, folded: readFolded(), git: null, focus: null });
	const get = store.get;
	let refreshTimer = 0;
	let asked = 0;
	let shownRead = 0;

	const setArticles = (articles: ArticleSummary[]) => store.set({ articles, tree: pageTree(articles) });

	/** Of these pages, those not under another of them (moving or deleting that one takes them along), in the list's order. */
	function topmost(slugs: Iterable<string>): string[] {
		const { articles, tree, folded } = get();
		const all = [...new Set(slugs)];
		const order = visibleOrder(tree, folded);
		const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
		return all.filter((slug) => !all.some((other) => other !== slug && within(articles, slug, other))).sort((a, b) => rank(a) - rank(b));
	}

	/** The pages it is under unfolded, so that it shows. */
	function unfoldTo(slug: string): void {
		const { articles, folded } = get();
		const bySlug = new Map(articles.map((article) => [article.slug, article]));
		const next = new Set(folded);
		for (let at = bySlug.get(slug)?.parent, steps = 0; at && steps <= articles.length; at = bySlug.get(at)?.parent, steps += 1) next.delete(at);
		if (next.size === folded.size) return;
		keepFolded(next);
		store.set({ folded: next });
	}

	/** Reads the articles again; one read sooner that comes back later is not shown over it. */
	async function load(): Promise<ArticleSummary[]> {
		const read = ++asked;
		const listed = await listArticles();
		if (read > shownRead) {
			shownRead = read;
			setArticles(listed);
			store.set({ read: true });
			host.listed?.(listed);
		}
		return get().articles;
	}

	const actions = {
		host,
		topmost,
		/** ⌘-click: chosen or let go of; ⇧-click: the run from the last one clicked. False: a plain click. */
		choose(slug: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): boolean {
			const { chosen, chosenFrom, selected, tree, folded } = get();
			if (event.metaKey || event.ctrlKey) {
				const next = new Set(chosen);
				if (!next.size && selected && selected !== slug) next.add(selected);
				if (next.has(slug)) next.delete(slug);
				else next.add(slug);
				store.set({ chosen: next, chosenFrom: slug });
				return true;
			}
			if (event.shiftKey) {
				const order = visibleOrder(tree, folded);
				const from = order.indexOf(chosenFrom ?? selected ?? slug);
				const to = order.indexOf(slug);
				if (from < 0 || to < 0) return false;
				store.set({ chosen: new Set(order.slice(Math.min(from, to), Math.max(from, to) + 1)) });
				return true;
			}
			return false;
		},
		unchoose(): void {
			if (get().chosen.size) store.set({ chosen: new Set(), chosenFrom: null });
		},
		/** A plain click: the page opened, the run starting from it. */
		open(slug: string): void {
			actions.unchoose();
			store.set({ chosenFrom: slug });
			host.open(slug);
		},
		setFolded(slug: string, fold: boolean): void {
			const next = new Set(get().folded);
			if (fold) next.add(slug);
			else next.delete(slug);
			keepFolded(next);
			store.set({ folded: next });
			actions.focusRow(slug);
		},
		focusRow(slug: string): void {
			store.set({ focus: { slug, asked: (get().focus?.asked ?? 0) + 1 } });
		},
	};

	/** What the Studio around it asks of the list. */
	const api = {
		load,
		/** The articles as last read. */
		articles: (): ArticleSummary[] => get().articles,
		/** What git says has not been committed. */
		showGit(status: GitStatus): void {
			store.set({ git: status });
		},
		/** Marks the open article (the pages it is under unfolded, so that it shows). */
		select(slug: string): void {
			store.set({ selected: slug });
			unfoldTo(slug);
		},
		/** The pages right under `slug` (empty for the top), in the tree's order. */
		childrenOf(slug: string): ArticleSummary[] {
			const { tree } = get();
			return slug ? (tree.children.get(slug) ?? []) : tree.roots;
		},
		/** The open article's title as it is typed, before it is saved: the list follows it, as in Notion. */
		retitled(slug: string, title: string): void {
			const article = get().articles.find((entry) => entry.slug === slug);
			if (!article || !title.trim() || article.title === title) return;
			setArticles(get().articles.map((entry) => (entry === article ? { ...entry, title } : entry)));
		},
		/** An article's saved title and draft state. */
		saved(slug: string, properties: ArticleProperties): void {
			const article = get().articles.find((entry) => entry.slug === slug);
			if (!article) return;
			const next: ArticleSummary = { ...article, title: properties.title, draft: properties.draft, tags: properties.tags };
			if (properties.icon !== undefined) next.icon = properties.icon;
			if (properties.parent !== undefined) next.parent = properties.parent;
			setArticles(get().articles.map((entry) => (entry === article ? next : entry)));
		},
		/** Something changed in blog/: an article may have come, gone or been retitled. */
		changedOnDisk(changes: DiskChange[]): void {
			if (!changes.some((change) => change.paths.includes('') || change.paths.includes('index.md'))) return;
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => {
				load().catch(() => {});
			}, REFRESH_DELAY_MS);
		},
	};

	return { store, actions, api };
}

export type TreeActions = ReturnType<typeof createTreeState>['actions'];
