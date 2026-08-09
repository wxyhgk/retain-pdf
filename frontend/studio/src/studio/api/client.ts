import type { ArticlePayload, ArticleSummary } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, options);
	const data = await response.json();
	if (!response.ok) throw new StudioApiError(data.error || '请求失败', response.status);
	return data;
}

export class StudioApiError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
		this.name = 'StudioApiError';
	}
}

function jsonOptions(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	};
}

export async function listArticles(): Promise<ArticleSummary[]> {
	return (await request<{ articles: ArticleSummary[] }>('/api/studio/articles')).articles;
}

export function getArticle(slug: string): Promise<ArticlePayload> {
	return request<ArticlePayload>(`/api/studio/articles/${encodeURIComponent(slug)}`).then((article) => ({
		...article,
		source: article.source ?? article.content ?? '',
		revision: article.revision ?? article.hash ?? '',
		chemistryViews: article.chemistryViews ?? {},
	}));
}

export function createArticle(slug: string, title: string): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title }));
}

export function saveArticle(slug: string, source: string, expectedRevision: string): Promise<{ revision: string }> {
	return request<{ revision?: string; hash?: string }>(
		`/api/studio/articles/${encodeURIComponent(slug)}`,
		jsonOptions('PUT', { source, expectedRevision }),
	).then((result) => ({ revision: result.revision ?? result.hash ?? '' }));
}

export function saveMoleculeView(
	slug: string,
	key: string,
	format: string,
	view: number[],
	expectedRevision: string,
	display?: unknown,
): Promise<{ revision: string; chemistryViews: ArticlePayload['chemistryViews'] }> {
	return request(
		`/api/studio/articles/${encodeURIComponent(slug)}/chemistry-views/${encodeURIComponent(key)}`,
		jsonOptions('PUT', { format, view, display, expectedRevision }),
	);
}

export function renderArticlePreview(slug: string, content: string): Promise<{ html: string }> {
	return request('/api/studio/preview', jsonOptions('POST', { slug, content }));
}
