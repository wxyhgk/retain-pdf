import type { ArticlePayload, ArticleSummary } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, options);
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || '请求失败');
	return data;
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
	return request(`/api/studio/articles/${encodeURIComponent(slug)}`);
}

export function createArticle(slug: string, title: string): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title }));
}

export function saveArticle(slug: string, content: string, expectedHash: string): Promise<{ hash: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}`, jsonOptions('PUT', { content, expectedHash }));
}

export function renderArticlePreview(slug: string, content: string): Promise<{ html: string }> {
	return request('/api/studio/preview', jsonOptions('POST', { slug, content }));
}
