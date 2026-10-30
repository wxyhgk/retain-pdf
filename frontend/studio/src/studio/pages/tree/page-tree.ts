import { comparePages } from '../../../articles/page-order.mjs';
import type { ArticleSummary } from '../../types.ts';

/** A database in a page, as the tree shows it (as Notion's sidebar): its rows under it, not among the page's pages. */
export type TreeTable = { key: string; page: string; id: string; title: string; rows: ArticleSummary[] };

export type PageTree = {
	roots: ArticleSummary[];
	/** The pages under each page, those that are rows of a database of it left out. */
	children: Map<string, ArticleSummary[]>;
	/** The databases of each page, with their rows. */
	tables: Map<string, TreeTable[]>;
	placedUnder: (article: ArticleSummary) => string;
};

/**
 * The tree of pages: each under the one its `parent:` names. One whose
 * parent is not there (deleted, misspelt), or that would be under itself, is
 * at the top.
 */
export function pageTree(articles: ArticleSummary[]): PageTree {
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
	const tables = new Map<string, TreeTable[]>();
	for (const article of articles) {
		const found = (article.databases ?? []).flatMap(({ id, title }) => (id ? [{ key: `${article.slug}#${id}`, page: article.slug, id, title, rows: [] }] : []));
		if (found.length) tables.set(article.slug, found);
	}
	for (const article of [...articles].sort(comparePages)) {
		const parent = placedUnder(article);
		const table = parent && article.database ? tables.get(parent)?.find((each) => each.id === article.database) : undefined;
		if (table) table.rows.push(article);
		else if (!parent) roots.push(article);
		else children.set(parent, [...(children.get(parent) ?? []), article]);
	}
	return { roots, children, tables, placedUnder };
}

/** Articles whose title or folder holds the query, ignoring case. */
export function filterArticles(articles: ArticleSummary[], query: string): ArticleSummary[] {
	const needle = query.trim().toLocaleLowerCase('zh-CN');
	if (!needle) return articles;
	return articles.filter((article) => `${article.title}\n${article.slug}`.toLocaleLowerCase('zh-CN').includes(needle));
}

/** The pages as the list shows them, top to bottom (the pages of folded ones left out, and the rows of databases not opened). */
export function visibleOrder(tree: PageTree, folded: ReadonlySet<string>, opened: ReadonlySet<string> = new Set()): string[] {
	const order: string[] = [];
	const walk = (pages: ArticleSummary[]) => {
		for (const page of pages) {
			order.push(page.slug);
			if (folded.has(page.slug)) continue;
			walk(tree.children.get(page.slug) ?? []);
			for (const table of tree.tables.get(page.slug) ?? []) if (opened.has(table.key)) walk(table.rows);
		}
	};
	walk(tree.roots);
	return order;
}

/** Whether `slug` is `ancestor` or under it. */
export function within(articles: ArticleSummary[], slug: string, ancestor: string): boolean {
	const bySlug = new Map(articles.map((article) => [article.slug, article]));
	for (let at: string | undefined = slug, steps = 0; at && steps <= articles.length; at = bySlug.get(at)?.parent, steps += 1) {
		if (at === ancestor) return true;
	}
	return false;
}
