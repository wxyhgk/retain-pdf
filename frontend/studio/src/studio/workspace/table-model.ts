import type { ArticleSummary } from '../types.ts';

/**
 * What the table of all articles (article-table.ts) shows, and how: the
 * filters, the order and the board's columns. Nothing here touches the page.
 */

export type SortKey = 'title' | 'status' | 'kind' | 'pubDate' | 'modified';
export type GroupKey = 'status' | 'kind';

export type TableSettings = {
	layout: 'table' | 'board';
	sort: SortKey;
	descending: boolean;
	/** The board's columns: by status (草稿, 已发布) or by kind (博客, 维基). */
	group: GroupKey;
	status: '' | 'draft' | 'published';
	kind: '' | 'post' | 'wiki';
	/** Only articles with this tag; empty for all. */
	tag: string;
};

export const DEFAULT_SETTINGS: TableSettings = { layout: 'table', sort: 'modified', descending: true, group: 'status', status: '', kind: '', tag: '' };

const SORT_KEYS: readonly SortKey[] = ['title', 'status', 'kind', 'pubDate', 'modified'];

/** Settings as kept in the browser, whatever they are, read as settings: anything unknown is the default. */
export function readSettings(kept: unknown): TableSettings {
	const value = (kept && typeof kept === 'object' ? kept : {}) as Partial<Record<keyof TableSettings, unknown>>;
	const pick = <T>(given: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(given as T) ? (given as T) : fallback);
	return {
		layout: pick(value.layout, ['table', 'board'] as const, DEFAULT_SETTINGS.layout),
		sort: pick(value.sort, SORT_KEYS, DEFAULT_SETTINGS.sort),
		descending: typeof value.descending === 'boolean' ? value.descending : DEFAULT_SETTINGS.descending,
		group: pick(value.group, ['status', 'kind'] as const, DEFAULT_SETTINGS.group),
		status: pick(value.status, ['', 'draft', 'published'] as const, ''),
		kind: pick(value.kind, ['', 'post', 'wiki'] as const, ''),
		tag: typeof value.tag === 'string' ? value.tag : '',
	};
}

export const STATUS_NAMES = { draft: '草稿', published: '已发布' } as const;
export const KIND_NAMES = { post: '博客', wiki: '维基' } as const;

export const statusOf = (article: ArticleSummary): 'draft' | 'published' => (article.draft ? 'draft' : 'published');
export const kindOf = (article: ArticleSummary): 'post' | 'wiki' => (article.kind === 'wiki' ? 'wiki' : 'post');

/** The articles the filters and the words typed let through. */
export function matchArticles(articles: ArticleSummary[], settings: TableSettings, query = ''): ArticleSummary[] {
	const words = query.trim().toLocaleLowerCase('zh-CN').split(/\s+/u).filter(Boolean);
	return articles.filter((article) => {
		if (settings.status && statusOf(article) !== settings.status) return false;
		if (settings.kind && kindOf(article) !== settings.kind) return false;
		if (settings.tag && !(article.tags ?? []).includes(settings.tag)) return false;
		const text = [article.title, article.slug, article.description ?? '', ...(article.tags ?? [])].join('\n').toLocaleLowerCase('zh-CN');
		return words.every((word) => text.includes(word));
	});
}

/** In the order asked; an article without a date is last either way, and ties go by title. */
export function sortArticles(articles: ArticleSummary[], key: SortKey, descending: boolean): ArticleSummary[] {
	const byTitle = (left: ArticleSummary, right: ArticleSummary) => left.title.localeCompare(right.title, 'zh-CN');
	const value = (article: ArticleSummary): string | number | null => {
		if (key === 'status') return article.draft ? 0 : 1;
		if (key === 'kind') return kindOf(article) === 'post' ? 0 : 1;
		if (key === 'pubDate') return article.pubDate || null;
		if (key === 'modified') return article.modified ?? null;
		return null;
	};
	return [...articles].sort((left, right) => {
		if (key === 'title') return (descending ? -1 : 1) * byTitle(left, right);
		const [a, b] = [value(left), value(right)];
		if (a === null || b === null) return a === b ? byTitle(left, right) : a === null ? 1 : -1;
		const order = a < b ? -1 : a > b ? 1 : 0;
		return (descending ? -order : order) || byTitle(left, right);
	});
}

/** The board's columns, each in the order given, empty ones too. */
export function groupArticles(articles: ArticleSummary[], group: GroupKey): Array<{ key: string; name: string; articles: ArticleSummary[] }> {
	const names: Record<string, string> = group === 'status' ? STATUS_NAMES : KIND_NAMES;
	const of = group === 'status' ? statusOf : kindOf;
	return Object.entries(names).map(([key, name]) => ({ key, name, articles: articles.filter((article) => of(article) === key) }));
}

/** Every tag the articles have, by how many have it, then by name. */
export function knownTags(articles: ArticleSummary[]): string[] {
	const counts = new Map<string, number>();
	for (const tag of articles.flatMap((article) => article.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-CN')).map(([tag]) => tag);
}
