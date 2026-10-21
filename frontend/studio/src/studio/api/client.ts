import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { articlePath, studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import type { ArticleFileEntry, ArticleIssue, ArticlePayload, ArticleSummary, Backlink, GitStatus, HistoryEntry, HistoryReason, SearchResult, TrashEntry } from '../types.ts';

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

/** The articles that link to this one. */
export async function articleBacklinks(slug: string): Promise<Backlink[]> {
	return (await request<{ backlinks: Backlink[] }>(`/api/studio/articles/${encodeURIComponent(slug)}/backlinks`)).backlinks;
}

/** The mark of what the page shows with this article open (page-version.mjs). */
export async function pageVersion(slug: string): Promise<string> {
	return (await request<{ version: string }>(`/api/studio/articles/${encodeURIComponent(slug)}/page-version`)).version;
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

export function createArticle(slug: string, title: string, parent = ''): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title, parent }));
}

/** Puts an article under another page (its folder name), or at the top with `parent` empty. */
export function setArticleParent(slug: string, parent: string): Promise<{ slug: string; parent: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/parent`, jsonOptions('POST', { parent }));
}

/** The articles whose title or text holds `query`. */
export async function searchArticles(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
	return (await request<{ results: SearchResult[] }>(`/api/studio/search?${new URLSearchParams({ q: query })}`, { signal })).results;
}

/** What is in the trash, the latest first. */
export async function listTrash(): Promise<TrashEntry[]> {
	return (await request<{ entries: TrashEntry[] }>('/api/studio/trash')).entries;
}

/** Deletes something in the trash for good. */
export function purgeTrash(trashed: string): Promise<{ trashed: string }> {
	return request('/api/studio/trash/purge', jsonOptions('POST', { trashed }));
}

/** Which articles have changes not committed to git. */
export function gitStatus(): Promise<GitStatus> {
	return request('/api/studio/git');
}

/** Commits the article's folder (and those of articles gone from disk) with `message`. */
export function commitArticle(slug: string, message: string): Promise<{ commit: string; vanished: string[] }> {
	return request(articleApi(slug, 'commit'), jsonOptions('POST', { message }));
}

/** Gives an article another folder name, which is its address on the blog. */
export function renameArticle(slug: string, to: string): Promise<{ slug: string }> {
	return request(articleApi(slug, 'rename'), jsonOptions('POST', { to }));
}

/** Copies an article into a new folder: a draft titled 副本. */
export function duplicateArticle(slug: string, to: string): Promise<{ slug: string }> {
	return request(articleApi(slug, 'duplicate'), jsonOptions('POST', { to }));
}

/** Moves a whole article to the trash; `trashed` puts it back (`restoreArticle`). */
export function deleteArticle(slug: string): Promise<{ trashed: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}`, { method: 'DELETE' });
}

/** Puts back an article `deleteArticle` removed. */
export function restoreArticle(trashed: string): Promise<{ slug: string }> {
	return request('/api/studio/restored-articles', jsonOptions('POST', { trashed }));
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
	if (!path || !PUBLISHED_FOLDERS.includes(root) || !rest.length) return src;
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
	return sendFile(`${articleApi(slug, 'files')}?${query}`, file, options);
}

function sendFile(url: string, file: File, options: UploadOptions): Promise<{ path: string; size: number }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);
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
export function openTerminal(target: { cwd: 'root' } | { cwd: 'drive' } | { cwd: 'article'; slug: string }): Promise<{ url: string; cwd: string }> {
	return request('/api/studio/terminal', jsonOptions('POST', target));
}

/** Keeps a version of the article in its ai/history (nothing when the newest kept one is the same). */
export async function keepVersion(slug: string, source: string, reason: HistoryReason): Promise<void> {
	await request(`/api/studio/articles/${encodeURIComponent(slug)}/history`, jsonOptions('POST', { source, reason }));
}

/** The article's kept versions, newest first. */
export async function listVersions(slug: string): Promise<HistoryEntry[]> {
	return (await request<{ versions: HistoryEntry[] }>(`/api/studio/articles/${encodeURIComponent(slug)}/history`)).versions;
}

/** One kept version's text. */
export async function readVersion(slug: string, name: string): Promise<string> {
	return (await request<{ source: string }>(`/api/studio/articles/${encodeURIComponent(slug)}/history/${encodeURIComponent(name)}`)).source;
}

/** Adds the work with this DOI to the article's assets/refs.bib (asking doi.org); its key. */
export async function addReference(slug: string, doi: string): Promise<{ key: string; added: boolean }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/references`, jsonOptions('POST', { doi }));
}

/** The drive (资料库, drive.mjs): which folder it is; `root` null until one is chosen. */
export type DriveInfo = { root: string | null; name: string | null; fixed: boolean; cancelled?: boolean };

export type DriveEntry = { path: string; kind: 'file' | 'directory'; size?: number; modified: number };

export function driveInfo(): Promise<DriveInfo> {
	return request('/api/studio/drive');
}

/** Asks for the drive's folder with the system's dialog; `cancelled` when none was picked. */
export function chooseDriveFolder(): Promise<DriveInfo> {
	return request('/api/studio/drive/choose', jsonOptions('POST', {}));
}

/** Makes the folder at `path` (typed out) the drive. */
export function setDriveFolder(path: string): Promise<DriveInfo> {
	return request('/api/studio/drive/root', jsonOptions('POST', { path }));
}

export async function listDrive(folder: string): Promise<DriveEntry[]> {
	return (await request<{ entries: DriveEntry[] }>(`/api/studio/drive/list?${new URLSearchParams({ path: folder })}`)).entries;
}

/** Where a file of the drive is read from. */
export function driveFileUrl(path: string): string {
	return `/api/studio/drive/files/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function uploadDriveFile(folder: string, file: File, options: UploadOptions = {}): Promise<{ path: string; size: number }> {
	const query = new URLSearchParams({ folder, name: file.name });
	if (options.replace) query.set('replace', '1');
	return sendFile(`/api/studio/drive/upload?${query}`, file, options);
}

export function createDriveFolder(path: string): Promise<{ path: string }> {
	return request('/api/studio/drive/folders', jsonOptions('POST', { path }));
}

export function moveDriveFile(from: string, to: string): Promise<{ path: string }> {
	return request('/api/studio/drive/move', jsonOptions('POST', { from, to }));
}

export function trashDriveFile(path: string): Promise<{ path: string; trashed: string }> {
	return request('/api/studio/drive/trash', jsonOptions('POST', { path }));
}

export function restoreDriveFile(trashed: string): Promise<{ path: string }> {
	return request('/api/studio/drive/restore', jsonOptions('POST', { trashed }));
}

export function revealDriveFile(path: string): Promise<{ path: string }> {
	return request('/api/studio/drive/reveal', jsonOptions('POST', { path }));
}

/** A file of the drive copied into the article's `folder` (`img` or `assets`): its path there. */
export function importDriveFile(slug: string, from: string, folder: string): Promise<{ path: string; size: number }> {
	return request(articleApi(slug, 'import'), jsonOptions('POST', { from, folder }));
}

/** A file of the drive whose name (`inName`) or words hold what was searched for. */
export type DriveSearchResult = { path: string; inName: boolean; snippet?: string };

/** Files of the drive by name and words; `indexing` while its text is still being read. */
export function searchDrive(query: string, signal?: AbortSignal): Promise<{ results: DriveSearchResult[]; indexing: boolean }> {
	return request(`/api/studio/drive/search?${new URLSearchParams({ q: query })}`, { signal });
}

/** The project's plugins' API (plugins/*\/server.mjs), under /api/studio/plugins/: `ctx.studio.api` in their studio.ts. */
export const pluginApi = {
	get: <T>(path: string) => request<T>(`/api/studio/plugins${path}`),
	post: <T>(path: string, body: unknown = {}) => request<T>(`/api/studio/plugins${path}`, jsonOptions('POST', body)),
	put: <T>(path: string, body: unknown) => request<T>(`/api/studio/plugins${path}`, jsonOptions('PUT', body)),
};

/** One of the project's plugins (plugins/<id>/): the environments it is in, whether it is on in the Studio, how its server side is doing. */
export type PluginEntry = {
	id: string;
	entries: Array<'build.mjs' | 'page.ts' | 'studio.ts' | 'server.mjs'>;
	enabled: boolean;
	server: { state: 'off' | 'active' | 'waiting' | 'failed'; error?: string } | null;
};

export async function listPlugins(): Promise<PluginEntry[]> {
	return (await request<{ plugins: PluginEntry[] }>('/api/studio/plugins')).plugins;
}

/** Turns a plugin on or off in the Studio (and on its server); resolves with them all. */
export async function setPluginEnabled(id: string, enabled: boolean): Promise<PluginEntry[]> {
	return (await request<{ plugins: PluginEntry[] }>('/api/studio/plugins', jsonOptions('PUT', { id, enabled }))).plugins;
}
