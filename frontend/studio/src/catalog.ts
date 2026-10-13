import { getCollection, type CollectionEntry } from 'astro:content';
import { isPublishedArticle } from './studio/server/schemas.mjs';

export type ArticleEntry = CollectionEntry<'blog'>;

export function isWiki(entry: ArticleEntry): boolean {
	return entry.data.kind === 'wiki';
}

export function articleHref(entry: ArticleEntry): string {
	return isWiki(entry) ? `/wiki/${entry.id}/` : `/blog/${entry.id}/`;
}

export async function loadCatalog(): Promise<{ wiki: ArticleEntry[]; posts: ArticleEntry[] }> {
	const articles = (await getCollection('blog')).filter(isPublishedArticle);
	const wiki = articles
		.filter(isWiki)
		.sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'));
	const posts = articles
		.filter((entry) => !isWiki(entry))
		.sort((left, right) => right.data.pubDate.valueOf() - left.data.pubDate.valueOf());
	return { wiki, posts };
}

export function relatedArticles(articles: ArticleEntry[], current: ArticleEntry, limit = 4): ArticleEntry[] {
	const tags = new Set(current.data.tags);
	if (tags.size === 0) return [];
	return articles
		.filter((entry) => entry.id !== current.id && entry.data.tags.some((tag) => tags.has(tag)))
		.slice(0, limit);
}
