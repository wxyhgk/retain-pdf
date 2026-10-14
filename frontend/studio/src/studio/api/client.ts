import type { ArticleFileEntry, ArticlePayload, ArticleSummary } from '../types';

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
		properties: article.properties,
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

const articleApi = (slug: string, action: string): string => `/api/studio/articles/${encodeURIComponent(slug)}/${action}`;

export async function listArticleFiles(slug: string): Promise<ArticleFileEntry[]> {
	return (await request<{ entries: ArticleFileEntry[] }>(articleApi(slug, 'tree'))).entries;
}

/** Puts a file into `folder`; a taken name gets a number (`a-1.png`) unless `replace` is set. */
export function uploadArticleFile(slug: string, folder: string, file: File, replace = false): Promise<{ path: string; size: number }> {
	const query = new URLSearchParams({ folder, name: file.name });
	if (replace) query.set('replace', '1');
	return request(`${articleApi(slug, 'files')}?${query}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/octet-stream' },
		body: file,
	});
}

export function createArticleFolder(slug: string, path: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'folders'), jsonOptions('POST', { path }));
}

/**
 * Renames or moves a file or folder. When the article refers to it, the
 * server rewrites those references too, but only if `expectedRevision` is
 * the article as it is on disk.
 */
export function moveArticleFile(
	slug: string,
	from: string,
	to: string,
	expectedRevision: string,
): Promise<{ path: string; revision: string; references: number; views: number }> {
	return request(articleApi(slug, 'move'), jsonOptions('POST', { from, to, expectedRevision }));
}

export function trashArticleFile(slug: string, path: string): Promise<{ path: string; trashedTo: string }> {
	return request(articleApi(slug, 'trash'), jsonOptions('POST', { path }));
}

/** Shows the file in Finder (or the system's file manager); `''` is the article folder. */
export function revealArticleFile(slug: string, path: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'reveal'), jsonOptions('POST', { path }));
}
