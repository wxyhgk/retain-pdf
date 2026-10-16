import type { HastElement } from '../../code-files/render.mjs';
import { articlePath, studioFileUrl } from '../shared/article-references.mjs';
import type { ArticleFileEntry, ArticleIssue, ArticlePayload, ArticleSummary } from '../types.ts';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, options);
	const data = await response.json();
	if (!response.ok) throw new StudioApiError(data.error || '请求失败', response.status);
	return data;
}

export class StudioApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'StudioApiError';
		this.status = status;
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
		problems: article.problems ?? [],
		chemistryViews: article.chemistryViews ?? {},
		macros: article.macros ?? {},
	}));
}

export function createArticle(slug: string, title: string): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title }));
}

export function saveArticle(slug: string, source: string, expectedRevision: string): Promise<{ revision: string; problems: string[] }> {
	return request<{ revision?: string; hash?: string; problems?: string[] }>(
		`/api/studio/articles/${encodeURIComponent(slug)}`,
		jsonOptions('PUT', { source, expectedRevision }),
	).then((result) => ({ revision: result.revision ?? result.hash ?? '', problems: result.problems ?? [] }));
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

/** Where the Studio serves an article's files from: `<base>/img/a.png`. */
export function articleFilesUrl(slug: string): string {
	return `/api/studio/articles/${encodeURIComponent(slug)}/files`;
}

/**
 * Where to load a file the article links to (`./img/a.png`), when it is one
 * of its own published files; anything else is left as written.
 */
export function articleFileUrl(slug: string, src: string): string {
	const path = articlePath(src);
	const [root, ...rest] = path?.split('/') ?? [];
	if (!path || (root !== 'img' && root !== 'assets') || !rest.length) return src;
	return studioFileUrl(slug, path);
}

/** What would be wrong with the article, as `source`, once published. */
export async function checkArticle(slug: string, source: string): Promise<ArticleIssue[]> {
	return (await request<{ issues: ArticleIssue[] }>(articleApi(slug, 'check'), jsonOptions('POST', { source }))).issues;
}

/**
 * A code block that shows a file of the article (`@file ./assets/opt.log`),
 * drawn by the server as the blog draws it: only the lines shown come over.
 */
export async function codeFileFigure(slug: string, reference: string, language: string, meta: string): Promise<HastElement> {
	const query = new URLSearchParams({ path: reference, language, meta });
	return (await request<{ figure: HastElement }>(`${articleApi(slug, 'code-file')}?${query}`)).figure;
}

export async function listArticleFiles(slug: string): Promise<ArticleFileEntry[]> {
	return (await request<{ entries: ArticleFileEntry[] }>(articleApi(slug, 'tree'))).entries;
}

export type UploadOptions = {
	/** Folders a dropped folder brought along, made inside `folder` (`My Data/run 1`). */
	subfolder?: string;
	/** Overwrite a file of the same name instead of numbering the new one. */
	replace?: boolean;
	/** Bytes sent so far, for a progress display. */
	onProgress?: (loaded: number, total: number) => void;
};

/**
 * Puts a file into `folder`; a taken name gets a number (`a-1.png`) unless
 * `replace` is set. Sent with XMLHttpRequest, because fetch cannot tell how
 * much of an upload has gone.
 */
export function uploadArticleFile(slug: string, folder: string, file: File, options: UploadOptions = {}): Promise<{ path: string; size: number }> {
	const query = new URLSearchParams({ folder, name: file.name });
	if (options.subfolder) query.set('subfolder', options.subfolder);
	if (options.replace) query.set('replace', '1');
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', `${articleApi(slug, 'files')}?${query}`);
		xhr.setRequestHeader('Content-Type', 'application/octet-stream');
		xhr.responseType = 'json';
		if (options.onProgress) xhr.upload.addEventListener('progress', (event) => options.onProgress!(event.loaded, event.total || file.size));
		xhr.addEventListener('load', () => {
			const data = (xhr.response ?? {}) as { path?: string; size?: number; error?: string };
			if (xhr.status >= 200 && xhr.status < 300) resolve(data as { path: string; size: number });
			else reject(new StudioApiError(data.error || `上传 ${file.name} 失败`, xhr.status));
		});
		xhr.addEventListener('error', () => reject(new StudioApiError(`上传 ${file.name} 失败：连不上本地 Studio`, 0)));
		xhr.send(file);
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

/** Puts back a file `trashArticleFile` removed (`trashed`, as it returned), where it was. */
export function restoreArticleFile(slug: string, trashed: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'restore'), jsonOptions('POST', { trashed }));
}

export function trashArticleFile(slug: string, path: string): Promise<{ path: string; trashedTo: string; trashed: string }> {
	return request(articleApi(slug, 'trash'), jsonOptions('POST', { path }));
}

/** Shows the file in Finder (or the system's file manager); `''` is the article folder. */
export function revealArticleFile(slug: string, path: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'reveal'), jsonOptions('POST', { path }));
}

/** A one-time WebSocket URL for a shell in the repository or in an article's folder. */
export function openTerminal(target: { cwd: 'root' } | { cwd: 'article'; slug: string }): Promise<{ url: string; cwd: string }> {
	return request('/api/studio/terminal', jsonOptions('POST', target));
}
