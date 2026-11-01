import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { articlePath, studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { t } from '@blog/i18n/index.mjs';
import type { ArticleFileEntry, ArticleIssue, ArticlePayload, ArticleSummary, Backlink, GitStatus, HistoryEntry, HistoryReason, SearchResult, TrashEntry } from '../types.ts';
import type { DatabaseConfig } from '../editor/database/database-config.ts';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, options);
	} catch (error) {
		// Given up by the page itself (a search typed on): as it is.
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		// The connection itself gone ("Load failed", "Failed to fetch"): the server, not what was asked.
		throw new StudioApiError(t('连不上 Studio 的服务器：它可能正在重启，过一会儿再试'), 0);
	}
	let data: T & { error?: string };
	try {
		data = await response.json();
	} catch {
		throw new StudioApiError(response.ok ? t('服务器的回答读不懂') : t('服务器出错了（{status}）', { status: response.status }), response.status);
	}
	if (!response.ok) throw new StudioApiError(data.error || t('请求失败'), response.status);
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
		source: article.source ?? '',
		revision: article.revision ?? '',
		properties: article.properties,
		problems: article.problems ?? [],
		chemistryViews: article.chemistryViews ?? {},
		macros: article.macros ?? {},
	}));
}

/** A new page; `link`: the page it is under links to it at its end (as Notion's page block). */
export function createArticle(slug: string, title: string, parent = '', made: { body?: string; files?: string[]; link?: boolean } = {}): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title, parent, ...made }));
}

/** A page template (templates/<id>.md): its name, what it is for, the title it gives a page (`{{date}}`… not filled in). */
export type PageTemplate = { id: string; name: string; description: string; title: string };

export function listTemplates(): Promise<{ templates: PageTemplate[] }> {
	return request('/api/studio/templates');
}

/** A template filled in for a page made now: its title (`title` when given) and its body. */
export function renderTemplate(id: string, title = ''): Promise<{ id: string; name: string; title: string; body: string }> {
	return request(`/api/studio/templates/${encodeURIComponent(id)}/render`, jsonOptions('POST', { title }));
}

/** 存为模板: the article's body kept as a template called `name`. */
export function saveAsTemplate(slug: string, name: string): Promise<{ id: string; name: string }> {
	return request('/api/studio/templates', jsonOptions('POST', { slug, name }));
}

/** 查找替换: how to look (by default, case not minded, code and formulas left out). */
export type FindOptions = { caseSensitive?: boolean; skipCode?: boolean };
/** An article where the words are: each place with the words round it, and the revision it was looked at in. */
export type FoundIn = { slug: string; title: string; icon?: string; revision: string; matches: Array<{ line: number; before: string; text: string; after: string }> };

export function findInArticles(find: string, options: FindOptions): Promise<{ results: FoundIn[] }> {
	return request('/api/studio/find', jsonOptions('POST', { find, ...options }));
}

/** The places chosen (slug → its revision as found, the indexes of its places) put `replacement` in. */
export function replaceInArticles(find: string, replacement: string, picks: Record<string, { revision: string; indexes: number[] }>, options: FindOptions): Promise<{ changed: Array<{ slug: string; count: number }>; skipped: Array<{ slug: string; title: string; why: string }> }> {
	return request('/api/studio/replace', jsonOptions('POST', { find, replacement, picks, ...options }));
}

/** 数据库 (server/articles/databases.mjs): a database is a page (`type: database`), asked for by its folder name. */
const databaseUrl = (slug: string, rest = '') => `/api/studio/databases/${encodeURIComponent(slug)}${rest}`;

/** A database's rows: the pages under it, with their values. */
export function databaseRows(slug: string): Promise<{ rows: Array<{ slug: string; title: string; icon: string; props: Record<string, unknown> }> }> {
	return request(databaseUrl(slug));
}

/** One value of a row set (empty: taken out); what the column's kind kept of it. */
export function setDatabaseValue(row: string, column: string, type: string, value: unknown): Promise<{ value: unknown }> {
	return request(`/api/studio/databases/rows/${encodeURIComponent(row)}`, jsonOptions('PUT', { column, type, value }));
}

/** Several values of a row set at once (a block pasted), one write; what each kept. */
export function setDatabaseValues(row: string, values: Array<{ column: string; type: string; value: unknown }>): Promise<{ values: unknown[] }> {
	return request(`/api/studio/databases/rows/${encodeURIComponent(row)}`, jsonOptions('PUT', { values }));
}

/** A page's title set (a row's, a database's). */
export function setDatabaseTitle(row: string, title: string): Promise<{ title: string }> {
	return request(`/api/studio/databases/rows/${encodeURIComponent(row)}`, jsonOptions('PUT', { title }));
}

/** A database: its settings, title and icon; null: that page is not one (or not there). */
export async function databaseInfo(slug: string): Promise<{ config: DatabaseConfig; title: string; icon: string } | null> {
	const found = await request<{ config: DatabaseConfig | null; title?: string; icon?: string }>(databaseUrl(slug, '/config'));
	return found.config ? { config: found.config, title: found.title ?? '', icon: found.icon ?? '' } : null;
}

/** The settings of a database; null: that page is not one. */
export async function databaseConfig(slug: string): Promise<DatabaseConfig | null> {
	return (await databaseInfo(slug))?.config ?? null;
}

/** A database's settings changed (from a page showing it). */
export async function setDatabaseConfig(slug: string, config: DatabaseConfig): Promise<DatabaseConfig> {
	return (await request<{ config: DatabaseConfig }>(databaseUrl(slug, '/config'), jsonOptions('PUT', { config }))).config;
}

/** A choice more for a column of a database; its settings now. */
export async function addDatabaseOption(slug: string, column: string, option: string): Promise<DatabaseConfig> {
	return (await request<{ config: DatabaseConfig }>(databaseUrl(slug, '/options'), jsonOptions('POST', { column, option }))).config;
}

/** A database made: a page of its own, under `parent` when given. Its folder name. */
export function createDatabase(title: string, parent = '', config: Partial<DatabaseConfig> = {}): Promise<{ slug: string }> {
	return request('/api/studio/databases', jsonOptions('POST', { title, parent, config }));
}

/** A block from before databases were pages, in the page `page` (its text), made a database: its folder name. */
export function detachDatabase(page: string, text: string): Promise<{ slug: string; rows: string[] }> {
	return request(databaseUrl(page, '/detach'), jsonOptions('POST', { text }));
}

/** A row made in a database: a page under it, of this title and these values, from a template when given. */
export function addDatabaseRow(database: string, row: { title?: string; props?: Record<string, unknown>; template?: string | null }): Promise<{ slug: string }> {
	return request(databaseUrl(database, '/rows'), jsonOptions('POST', row));
}

/** What changes in every row of a database: columns renamed (old → new), taken away, of another kind; a choice renamed or taken away (`to` null). */
export type DatabaseColumnsChange = {
	renames?: Record<string, string>;
	removed?: string[];
	types?: Record<string, string>;
	values?: Array<{ column: string; from: string; to: string | null }>;
};

export function changeDatabaseColumns(database: string, change: DatabaseColumnsChange): Promise<{ changed: string[] }> {
	return request(databaseUrl(database, '/columns'), jsonOptions('POST', change));
}

/** 导入 Markdown: a zip of .md files (and what they show), made pages under `parent` ('' for none). */
export function importMarkdown(zip: Blob, parent = ''): Promise<{ pages: Array<{ slug: string; title: string }>; files: number; missing: string[] }> {
	return request(`/api/studio/import${parent ? `?parent=${encodeURIComponent(parent)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: zip });
}

/** 并入上级页面: the article's text into the page it is under; the article to the trash. */
export function mergeArticle(slug: string): Promise<{ slug: string; parent: string; trashed: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/merge`, jsonOptions('POST', {}));
}

/** Where a page goes among those under the same one: just before or after this one (its folder name). */
export type PagePlace = { before?: string; after?: string };

/** Puts an article under another page (its folder name), or at the top with `parent` empty; with `place`, there among them. */
export function setArticleParent(slug: string, parent: string, place: PagePlace = {}): Promise<{ slug: string; parent: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/parent`, jsonOptions('POST', { parent, ...place }));
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
export function renameArticle(slug: string, to: string): Promise<{ slug: string; relinked?: number }> {
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
	return request<{ revision?: string; problems?: string[] }>(
		`/api/studio/articles/${encodeURIComponent(slug)}`,
		jsonOptions('PUT', { source, expectedRevision }),
	).then((result) => ({ revision: result.revision ?? '', problems: result.problems ?? [] }));
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

/** The start of a file of the article (its first `bytes`, as text): enough to tell what wrote it. */
export async function articleFileHead(slug: string, path: string, bytes = 8192): Promise<string | null> {
	const response = await fetch(studioFileUrl(slug, path), { headers: { Range: `bytes=0-${bytes - 1}` } });
	return response.ok ? (await response.text()).slice(0, bytes) : null;
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
			else reject(new StudioApiError(data.error || t('上传 {name} 失败', { name: file.name }), xhr.status));
		});
		xhr.addEventListener('error', () => reject(new StudioApiError(t('上传 {name} 失败：连不上本地 Studio', { name: file.name }), 0)));
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

/** An earlier version of a file of the article, kept before it was written over (file-history.mjs). */
export type FileVersion = { id: string; time: number; reason: 'replaced' | 'before-restore'; size: number };

export function articleFileHistory(slug: string, path: string): Promise<{ versions: FileVersion[] }> {
	return request(`${articleApi(slug, 'file-history')}?path=${encodeURIComponent(path)}`);
}

/** One version's text (null when it is not text, or too large to show). */
export function articleFileVersion(slug: string, id: string, path: string): Promise<{ text: string | null; size: number }> {
	return request(`${articleApi(slug, 'file-history')}/${encodeURIComponent(id)}?path=${encodeURIComponent(path)}`);
}

/** A version brought back over the file (what is there kept first). */
export function restoreArticleFileVersion(slug: string, id: string, path: string): Promise<{ path: string }> {
	return request(`${articleApi(slug, 'file-history')}/restore`, jsonOptions('POST', { id, path }));
}

/** Opens the file with the system's program for it (as a double-click in Finder does). */
export function openArticleFileInApp(slug: string, path: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'open'), jsonOptions('POST', { path }));
}

/** Shows the file in Finder (or the system's file manager); `''` is the article folder. */
export function revealArticleFile(slug: string, path: string): Promise<{ path: string }> {
	return request(articleApi(slug, 'reveal'), jsonOptions('POST', { path }));
}

/** A one-time WebSocket URL for a shell in the repository or in an article's folder. */
export function openTerminal(target: { cwd: 'root' } | { cwd: 'drive' } | { cwd: 'article'; slug: string }): Promise<{ url: string; cwd: string }> {
	return request('/api/studio/terminal', jsonOptions('POST', target));
}

/** An AI the Studio starts (server/ai/agent-settings.mjs): in the terminal (`launch`), by itself for Alt+Enter (`run`, `resume`), in the AI panel (`acp`). */
export type Agent = { id: string; name: string; launch: string; run: string; resume: string; acp?: string; install?: string };
export type AgentsShown = { agents: Array<Agent & { installed: boolean }>; default: string; presets: Agent[] };

export function listAgents(): Promise<AgentsShown> {
	return request<AgentsShown>('/api/studio/agents');
}

export function saveAgents(list: Agent[], chosen: string): Promise<AgentsShown> {
	return request<AgentsShown>('/api/studio/agents', jsonOptions('PUT', { list, default: chosen }));
}

/** One of a conversation's options (model, mode, effort…), as its agent offers them (ACP's session config options). */
export type ConversationOption = {
	id: string;
	name: string;
	description?: string | null;
	category?: string | null;
	type: 'select' | 'boolean';
	currentValue: string | boolean;
	options?: Array<{ value: string; name: string; description?: string | null } | { group: string; name: string; options: Array<{ value: string; name: string; description?: string | null }> }>;
};
/** A conversation of the AI panel (server/ai/agent-sessions.mjs). */
export type Conversation = {
	id: string;
	agent: { id: string; name: string };
	slug: string | null;
	cwd: string;
	title: string;
	/** `saved`: kept in chats/, its agent not running; spoken to, it goes on (its agent's session loaded again). */
	state: 'starting' | 'idle' | 'running' | 'closed' | 'failed' | 'saved';
	error: string;
	created: string;
	updated: string;
	configOptions: ConversationOption[];
	/** Its slash commands (/compact…), as its agent offers them; `hint`: what to write after one. */
	commands: Array<{ name: string; description: string; hint?: string }>;
	usage: { used: number; size: number; cost: { amount: number; currency: string } | null } | null;
	/** The service Claude Code or pi talks to (its name, its id), when not the Claude account or pi's own setting. */
	service: string | null;
	serviceId?: string | null;
	/** The last item written on its page (chats/<id>/index.md); what comes after is the turn going on. */
	pageThrough: string | null;
	/** Whether it has a page (opened in the editor as one): spoken to, or begun as one. */
	onPage: boolean;
	/** Whether it can be spoken to while it works (pi in the Studio's process, Claude Code, Codex). */
	canSteer?: boolean;
	/** Whether its agent takes pictures with what it is told. */
	/** Whether its agent takes pictures; null till it has said (as it starts). */
	seesPictures?: boolean | null;
};
/** A tool call's content: words, a change to a file, or a terminal. */
export type ToolContent = { type: 'content'; content: { type: string; text?: string } } | { type: 'diff'; path: string; oldText?: string | null; newText: string } | { type: 'terminal'; terminalId: string };
/**
 * A subagent a tool call runs (pi's subagent extension), as it is now: what it was given, what it is doing, its steps
 * so far (the last few), how long (`startedAt`, `endedAt`: ms), how much (tokens, cost), what it said in the end.
 */
export type Subagent = { id: string; name: string; task: string; status: 'waiting' | 'running' | 'completed' | 'failed' | 'interrupted'; model: string; step: number | null; steps: Array<{ title: string; kind: string; failed: boolean }>; toolUses: number; turns: number; tokens: number; cost: number; doing: string; output: string; error: string; startedAt: number; endedAt: number | null };
/** What a conversation is made of, in order. */
export type ConversationItem =
	| { kind: 'user'; id: string; text: string; context?: { article: string | null; selection: string | null; mentions: string[]; articleSlug?: string | null; mentionSlugs?: string[]; widgets?: string[] }; steer?: boolean; quotes?: string[]; pictures?: string[]; files?: string[]; pastes?: string[] }
	| { kind: 'message'; id: string; text: string }
	| { kind: 'thought'; id: string; text: string }
	| { kind: 'tool'; id: string; title: string; toolKind: string; status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'interrupted'; content: ToolContent[]; locations: Array<{ path: string; line?: number | null }>; rawInput: unknown; output: string; exitCode: number | null; subagents?: Subagent[] }
	| { kind: 'plan'; id: string; entries: Array<{ content: string; priority: string; status: 'pending' | 'in_progress' | 'completed' }> }
	/** Its context compacted (what was said before made a summary). */
	| { kind: 'compaction'; id: string; status: 'in_progress' | 'completed' | 'failed' | 'cancelled'; error: string; summary: string }
	/** A question it asks (a form: its fields a JSON Schema's properties); `answer` once answered. */
	| { kind: 'question'; id: string; toolCallId: string | null; message: string; schema: FormSchema; answer: { action: 'accept'; content: Record<string, unknown> } | { action: 'decline' | 'cancel' } | null }
	| { kind: 'permission'; id: string; title: string; toolCallId: string | null; options: Array<{ optionId: string; name: string; kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' }>; chosen: string | null }
	/** `resume`: a turn over with nothing said; it can be asked to go on (接着说). */
	| { kind: 'notice'; id: string; severity: string; title: string; description: string; resume?: boolean }
	| { kind: 'stop'; id: string; reason: string }
	| { kind: 'error'; id: string; message: string };
export type ConversationEvent =
	| { type: 'all'; session: Conversation; items: ConversationItem[] }
	| { type: 'item'; item: ConversationItem }
	| { type: 'append'; id: string; text: string }
	| { type: 'session'; session: Conversation }
	/** Its connection to the server gone; followed again (it comes back as `all`). */
	| { type: 'lost' };

const conversationApi = (id: string, action = '') => `/api/studio/conversations/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

/** The AIs the panel can talk to, the one chosen first, and the conversations going on. */
export function listConversations(): Promise<{ agents: Array<{ id: string; name: string; kind?: 'claude' | 'pi' | 'other' }>; default: string; conversations: Conversation[] }> {
	return request('/api/studio/conversations');
}

/** Begins a conversation with `agent`, in blog/ (each thing said is told where the author is); resolves once it is ready. */
/** A conversation begun with `agent`; `page`: to be opened in the editor, its page in chats/ made at once. */
export function startConversation(agent: string, { page = false }: { page?: boolean } = {}): Promise<Conversation> {
	return request('/api/studio/conversations', jsonOptions('POST', { agent, page }));
}

/** Follows a conversation: all of it first, then each change. Returns the function that stops. */
export function followConversation(id: string, listener: (event: ConversationEvent) => void): () => void {
	let source: EventSource | null = null;
	let over = false;
	let timer = 0;
	let wait = 1000;
	const open = () => {
		source = new EventSource(conversationApi(id, 'events'));
		source.addEventListener('message', (event) => {
			wait = 1000;
			listener(JSON.parse(event.data) as ConversationEvent);
		});
		// Lost: said, and followed again (the browser tries again by itself, unless the server refused it: then here).
		source.addEventListener('error', () => {
			if (over) return;
			listener({ type: 'lost' });
			if (source?.readyState !== EventSource.CLOSED) return;
			timer = window.setTimeout(open, wait);
			wait = Math.min(wait * 2, 15_000);
		});
	};
	open();
	return () => {
		over = true;
		window.clearTimeout(timer);
		source?.close();
	};
}

/** Where the author is, told with what they say: the article open, the lines selected in it, the articles named with @. */
/** `widgets`: what the widgets in the conversation told of themselves since it was last spoken to (note.tell). */
export type ConversationContext = { article?: string; selection?: { start: number; end: number; text: string }; mentions?: string[]; widgets?: Array<{ title: string; state: unknown }> };

/** The fields of a question an AI asks: a JSON Schema's, each a choice of one (`oneOf`), of several (`items.anyOf`) or words. */
export type FormField = { type: string; title?: string; description?: string; oneOf?: Array<{ const: string; title?: string; description?: string }>; items?: { anyOf?: Array<{ const: string; title?: string; description?: string }> } };
export type FormSchema = { type: 'object'; properties: Record<string, FormField>; required?: string[] };

/**
 * Says `text` in a conversation; `steer`: while it works (`canSteer`), taken as soon as it can be. `pictures`: paths
 * of pictures kept for it (keepConversationPicture); `quotes`: what was quoted of it (Markdown), put before;
 * `pastes`: what was pasted at length, after.
 */
export async function tellConversation(id: string, text: string, context: ConversationContext = {}, { steer = false, pictures = [], files = [], quotes = [], pastes = [] }: { steer?: boolean; pictures?: string[]; files?: string[]; quotes?: string[]; pastes?: string[] } = {}): Promise<void> {
	await request(conversationApi(id, 'prompt'), jsonOptions('POST', { text, context, ...(steer ? { steer } : {}), ...(pictures.length ? { pictures } : {}), ...(files.length ? { files } : {}), ...(quotes.length ? { quotes } : {}), ...(pastes.length ? { pastes } : {}) }));
}

/** A picture given with what is said, kept in the conversation's folder: its path, to send it by. */
export async function keepConversationPicture(id: string, picture: Blob): Promise<string> {
	const { path } = await request<{ path: string }>(`${conversationApi(id, 'pictures')}?type=${encodeURIComponent(picture.type)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: picture });
	return path;
}

/** A file given with what is said (a PDF, a table, an output), kept in the conversation's folder: its path, told the AI. */
export async function keepConversationFile(id: string, file: File): Promise<string> {
	const { path } = await request<{ path: string }>(`${conversationApi(id, 'files')}?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
	return path;
}

/** A question it asked, answered: what was chosen (`accept`), skipped (`decline`). */
export async function answerQuestion(id: string, question: string, answer: { action: 'accept'; content: Record<string, unknown> } | { action: 'decline' | 'cancel' }): Promise<void> {
	await request(`${conversationApi(id, 'questions')}/${encodeURIComponent(question)}`, jsonOptions('POST', answer));
}

export async function stopConversation(id: string): Promise<void> {
	await request(conversationApi(id, 'cancel'), jsonOptions('POST', {}));
}

/** The author's answer to leave the agent asked: one of its options, or `null` for no. */
export async function answerConversation(id: string, permission: string, option: string | null): Promise<void> {
	await request(conversationApi(id, `permissions/${encodeURIComponent(permission)}`), jsonOptions('POST', { option }));
}

/** Gone on with by another service (`provider`: Claude Code's or pi's) or another AI (`agent`), what was said kept. */
export function switchConversation(id: string, to: { agent?: string; provider?: string }): Promise<Conversation> {
	return request(conversationApi(id, 'switch'), jsonOptions('POST', to));
}

export function setConversationOption(id: string, configId: string, value: string | boolean): Promise<Conversation> {
	return request(conversationApi(id, 'options'), jsonOptions('POST', { configId, value }));
}

/** A service the panel's Claude Code can talk to (server/ai/panel-models.mjs): its address and models; whether a key is saved. */
export type PanelProvider = { id: string; name: string; baseUrl: string; keyStyle: string; main: string; fast: string; keyUrl: string; hasKey: boolean; suggested: { baseUrl: string; main: string; fast: string } };
export type PanelModelsShown = { chosen: string; providers: PanelProvider[] };
export type PanelAccounts = { claude: { loggedIn: boolean; plan: string; missing: boolean }; codex: { loggedIn: boolean; how: string; missing: boolean } };

export function panelModels(): Promise<PanelModelsShown> {
	return request('/api/studio/panel-models');
}

/** Chooses a service, with what is given of it (`apiKey: ''` forgets its key; left out, kept). */
export function savePanelModels(change: { provider: string; baseUrl?: string; apiKey?: string; main?: string; fast?: string }): Promise<PanelModelsShown> {
	return request('/api/studio/panel-models', jsonOptions('PUT', change));
}

/** Tries the service chosen with a word: what it answered, or why it did not. */
export function checkPanelModels(): Promise<{ ok: true; model: string; answered: string }> {
	return request('/api/studio/panel-models/check', jsonOptions('POST', {}));
}

/** A service pi can use (its own catalog of them), by the environment variable it reads the key from. */
export type PiProvider = { id: string; name: string; env: string; keyUrl: string; hasKey: boolean };

export function piModels(): Promise<{ chosen: string; providers: PiProvider[] }> {
	return request('/api/studio/panel-models/pi');
}

export function savePiModels(change: { provider: string; apiKey?: string }): Promise<{ chosen: string; providers: PiProvider[] }> {
	return request('/api/studio/panel-models/pi', jsonOptions('PUT', change));
}

/** pi asks the service a word with its first model: what it answered, and the service's models in pi's catalog. */
export function checkPiModels(): Promise<{ ok: true; model: string; answered: string; models: string[] }> {
	return request('/api/studio/panel-models/pi/check', jsonOptions('POST', {}));
}

export function panelAccounts(): Promise<PanelAccounts> {
	return request('/api/studio/panel-models/accounts');
}

/** The AI in the editor (server/ai/inline-ai.mjs): a session of `agent` made ready, as the author is about to ask. */
export async function warmInline(agent: string): Promise<void> {
	await request('/api/studio/inline/warm', jsonOptions('POST', { agent }));
}

/** What the AI in the editor is asked: the blocks selected rewritten, or something written where the caret is. */
export type InlineAsk = { id: string; agent: string; options: Record<string, string>; mode: 'rewrite' | 'write'; instruction: string; slug: string; selected: string; before: string; after: string };

/** The Markdown that goes in place of the blocks selected (rewrite), or where the caret is (write). */
export function askInline(asked: InlineAsk): Promise<{ markdown: string }> {
	return request('/api/studio/inline', jsonOptions('POST', asked));
}

export async function cancelInline(id: string): Promise<void> {
	await request(`/api/studio/inline/${encodeURIComponent(id)}/cancel`, jsonOptions('POST', {}));
}

export async function closeConversation(id: string): Promise<void> {
	await request(conversationApi(id, 'close'), jsonOptions('POST', {}));
}

/** A conversation of the AI tab given its page (chats/<id>/index.md), to be opened in the editor. */
export function pageConversation(id: string): Promise<Conversation> {
	return request(conversationApi(id, 'page'), jsonOptions('POST', {}));
}

/** A conversation gone, its folder of chats/ too. */
export async function deleteConversation(id: string): Promise<void> {
	await request(conversationApi(id, 'delete'), jsonOptions('POST', {}));
}

/** A conversation named by the author (the AI's own title no longer put over it). */
export async function renameConversation(id: string, title: string): Promise<void> {
	await request(conversationApi(id, 'title'), jsonOptions('POST', { title }));
}

/** The conversations in the order dragged into (the left column's 对话). */
export async function orderConversations(ids: string[]): Promise<void> {
	await request('/api/studio/conversations/order', jsonOptions('PUT', { ids }));
}

/** A background task (server/tasks/tasks.mjs), without its log. */
export type TaskSummary = { id: string; kind: string; title: string; slug: string | null; state: 'running' | 'done' | 'failed' | 'cancelled'; started: number; ended: number | null; error: string | null; result: unknown; logSize: number };
export type TaskEvent = { type: 'all'; tasks: TaskSummary[] } | { type: 'task'; task: TaskSummary } | { type: 'log'; id: string; text: string };

/** Follows the background tasks: all of them first, then each change. Returns the function that stops. */
export function followTasks(listener: (event: TaskEvent) => void): () => void {
	const source = new EventSource('/api/studio/tasks/events');
	source.addEventListener('message', (event) => listener(JSON.parse(event.data) as TaskEvent));
	return () => source.close();
}

export async function taskLog(id: string): Promise<string> {
	return (await request<{ log: string }>(`/api/studio/tasks/${encodeURIComponent(id)}`)).log;
}

export async function cancelTask(id: string): Promise<void> {
	await request(`/api/studio/tasks/${encodeURIComponent(id)}/cancel`, jsonOptions('POST', {}));
}

/** A 小程序 (server/apps/mini-apps.mjs): what it is, how big its window opens, what it may do (`problem`: its app.json is wrong). */
export type MiniApp = { id: string; name: string; icon: string; description: string; width: number; height: number; permissions: string[]; kind: 'page' | 'project'; blocks: AppBlock[]; commands: AppCommand[]; problem?: string };

/** A command an app gives ⌘K: its window opened at `entry`. */
export type AppCommand = { id: string; title: string; entry: string };

/** A block an app gives the articles (its app.json's `blocks`): its fence, the page of the app showing it, how tall it starts. */
export type AppBlock = { fence: string; entry: string; height: number; title: string };

/** A project app's development server: how it is, and what it wrote last. */
export type AppStatus = { state: 'stopped' | 'starting' | 'running' | 'failed'; port: number | null; error: string | null; log: string };

/** An app's code as it was (before an AI changed it): kept now (`why`), listed, or brought back. */
export type AppCheckpoint = { stamp: string; when: string; why: string; files: number };
export function keepAppCheckpoint(id: string, why: string): Promise<AppCheckpoint> {
	return request(`/api/studio/apps/${encodeURIComponent(id)}/checkpoints`, jsonOptions('POST', { why }));
}
export async function appCheckpoints(id: string): Promise<AppCheckpoint[]> {
	return (await request<{ checkpoints: AppCheckpoint[] }>(`/api/studio/apps/${encodeURIComponent(id)}/checkpoints`)).checkpoints;
}
export function restoreAppCheckpoint(id: string, stamp: string): Promise<{ stamp: string; files: number }> {
	return request(`/api/studio/apps/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(stamp)}/restore`, jsonOptions('POST', {}));
}
/** What went wrong in an app's page, told the server (an AI reads it: app_status). */
export function reportAppError(id: string, message: string): void {
	void request(`/api/studio/apps/${encodeURIComponent(id)}/errors`, jsonOptions('POST', { message })).catch(() => {});
}

/** An app's code shown in the Finder: where it is. */
export function revealApp(id: string): Promise<{ path: string }> {
	return request(`/api/studio/apps/${encodeURIComponent(id)}/reveal`, jsonOptions('POST', {}));
}

/** The Studio has started (its article shown): Studio.app is told, and the code's commit kept as the last good one. */
export function tellStarted(): Promise<unknown> {
	return request('/api/studio/started', jsonOptions('POST', {}));
}

/** All the code in the notes, gathered (fences and the scripts in their folders): for the 小程序 (`studio.notes.code`). */
export async function notesCode(): Promise<unknown[]> {
	return (await request<{ items: unknown[] }>('/api/studio/notes/code', { cache: 'no-store' })).items;
}

/** All the pictures of the notes, gathered (shown in them or only kept): for the 小程序 (`studio.notes.images`). */
export async function notesImages(): Promise<unknown[]> {
	return (await request<{ items: unknown[] }>('/api/studio/notes/images', { cache: 'no-store' })).items;
}

/** 代码仓库 (studio.repos.*): what the 小程序 asks, as the server answers it (src/studio/server/routes/repos.mjs). */
export const repos = {
	list: async (): Promise<unknown[]> => (await request<{ repositories: unknown[] }>('/api/studio/repos', { cache: 'no-store' })).repositories,
	found: async (): Promise<unknown[]> => (await request<{ found: unknown[] }>('/api/studio/repos/found', { cache: 'no-store' })).found,
	add: (path: string): Promise<unknown> => request('/api/studio/repos', jsonOptions('POST', { path })),
	create: (name: string, description: string): Promise<unknown> => request('/api/studio/repos', jsonOptions('POST', { name, description })),
	remove: async (id: string): Promise<boolean> => (await request<{ removed: boolean }>(`/api/studio/repos/${encodeURIComponent(id)}`, { method: 'DELETE' })).removed,
	tree: (id: string, dir: string): Promise<unknown> => request(`/api/studio/repos/${encodeURIComponent(id)}/tree?dir=${encodeURIComponent(dir)}`, { cache: 'no-store' }),
	file: (id: string, path: string): Promise<unknown> => request(`/api/studio/repos/${encodeURIComponent(id)}/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' }),
};

/** Something the page saw going wrong, kept in the blog's .studio-cache/studio-notes.log for whoever looks into it. */
export function keepNote(what: string): Promise<unknown> {
	return request('/api/studio/notes', jsonOptions('POST', { what }));
}

/** A new app from a template (新建小程序): as listed, and its folder. */
export function createApp(name: string, template: 'page' | 'react'): Promise<MiniApp & { folder: string }> {
	return request('/api/studio/apps', jsonOptions('POST', { name, template }));
}

/** A project app's development server started (`start`, answered once it answers or has failed), started again, or how it is. */
export function appServer(id: string, action: 'start' | 'restart' | 'status'): Promise<AppStatus> {
	const path = `/api/studio/apps/${encodeURIComponent(id)}/${action}`;
	return action === 'status' ? request(path) : request(path, jsonOptions('POST', {}));
}

export async function listMiniApps(): Promise<MiniApp[]> {
	return (await request<{ apps: MiniApp[] }>('/api/studio/apps')).apps;
}

/** A 小程序's request to the network (its `net`), made by the Studio: no limit of the browser's on where to. */
export function appFetch(id: string, init: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; headers: Record<string, string>; text: string }> {
	return request(`/api/studio/apps/${encodeURIComponent(id)}/fetch`, jsonOptions('POST', init));
}

/** A 小程序's command (its `run`), as a background task, in the article's folder (`slug`) or the repository's. */
export async function appRun(id: string, argv: string[], slug: string | null): Promise<string> {
	return (await request<{ id: string }>(`/api/studio/apps/${encodeURIComponent(id)}/run`, jsonOptions('POST', { argv, slug }))).id;
}

/** A background task, its log with it. */
export function getTask(id: string): Promise<TaskSummary & { log: string }> {
	return request(`/api/studio/tasks/${encodeURIComponent(id)}`);
}

/** A PDF of the article read by PaddleOCR into a page under it (made at once): the task, and the page. */
export function startOcr(slug: string, path: string): Promise<{ task: string; page: { slug: string; title: string; href: string } }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/ocr`, jsonOptions('POST', { path }));
}

/** Alt+Enter: an AI does what these lines of the article ask, by itself; the task it is. */
export async function instruct(slug: string, line: { text: string; start: number; end: number; heading: string }, fresh: boolean): Promise<string> {
	return (await request<{ id: string }>(`/api/studio/articles/${encodeURIComponent(slug)}/instruct`, jsonOptions('POST', { line, fresh }))).id;
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
/** A picture on this machine (by its path, absolute or from blog/) copied into the article's img/; its path there. */
export function importPicture(slug: string, path: string): Promise<{ path: string; size: number }> {
	return request(articleApi(slug, 'import-picture'), jsonOptions('POST', { path }));
}

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

/** Which large model the Studio asks (AI 设置): never the key itself, only whether there is one. */
export type AiSettingsShown = {
	provider: 'anthropic' | 'openai';
	model: string;
	baseUrl: string;
	/** Claude only: the workspace (wrkspc_…) a key of the whole organization is used in. */
	workspaceId: string;
	/** A key is there: saved here, or in the environment. */
	hasKey: boolean;
	/** The key is saved in the Studio's settings (not only in the environment). */
	keySaved: boolean;
	defaults: { anthropic: string; openai: string };
};

export function aiSettings(): Promise<AiSettingsShown> {
	return request('/api/studio/ai/settings');
}

/** Changes the AI settings; `apiKey: ''` forgets a saved key, and leaving it out keeps it. */
export function saveAiSettings(change: Partial<Pick<AiSettingsShown, 'provider' | 'model' | 'baseUrl' | 'workspaceId'>> & { apiKey?: string }): Promise<AiSettingsShown> {
	return request('/api/studio/ai/settings', jsonOptions('PUT', change));
}

/** 识别: a picture of the article (`./img/…`) read by the model as `prompt` asks; its answer. */
export async function recognizeImage(slug: string, image: string, prompt: string): Promise<string> {
	return (await request<{ text: string }>(`/api/studio/articles/${encodeURIComponent(slug)}/recognize`, jsonOptions('POST', { image, prompt }))).text;
}

/** Puts Markdown under a picture of the article, on disk: it comes to the editor as a change to accept or not. */
export function putBelowImage(slug: string, image: string, markdown: string): Promise<{ slug: string }> {
	return request(`/api/studio/articles/${encodeURIComponent(slug)}/below-image`, jsonOptions('POST', { image, markdown }));
}

/** The language the Studio speaks: chosen (`system`: the browser's), and the languages there are. */
export type LocalesShown = { chosen: string; locales: Array<{ id: string; name: string }> };

/** 翻译 (server/retainpdf-settings.mjs): where RetainPDF's pages are, and the address used when none is set. */
export type RetainpdfShown = { url: string; default: string; isDefault: boolean };

/** 其他设备访问 (server/remote/remote-access.mjs): on or off, where another device may reach this Mac, the devices paired. */
export type RemoteShown = {
	enabled: boolean;
	running: boolean;
	port: number | null;
	addresses: Array<{ kind: 'lan' | 'tailscale'; host: string }>;
	fingerprint: string | null;
	devices: Array<{ id: string; name: string; kind: 'browser' | 'app'; added: number; seen: number | null }>;
};

export function remoteAccess(): Promise<RemoteShown> {
	return request('/api/studio/remote');
}

export function setRemoteAccess(enabled: boolean): Promise<RemoteShown> {
	return request('/api/studio/remote', jsonOptions('PUT', { enabled }));
}

/** A code to pair a device with (5 minutes, once), and what its QR code says (`pairing`, for the iPad app). */
export function remotePairing(): Promise<{ code: string; expires: number; pairing: string }> {
	return request('/api/studio/remote/pairing', jsonOptions('POST', {}));
}

export function removeRemoteDevice(id: string): Promise<RemoteShown> {
	return request(`/api/studio/remote/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function localeSettings(): Promise<LocalesShown> {
	return request<LocalesShown>('/api/studio/settings/locale');
}

export function saveLocale(locale: string): Promise<LocalesShown> {
	return request<LocalesShown>('/api/studio/settings/locale', jsonOptions('PUT', { locale }));
}

export function retainpdfSettings(): Promise<RetainpdfShown> {
	return request<RetainpdfShown>('/api/studio/settings/retainpdf');
}

/** Empty: the default address again. */
export function saveRetainpdf(url: string): Promise<RetainpdfShown> {
	return request<RetainpdfShown>('/api/studio/settings/retainpdf', jsonOptions('PUT', { url }));
}
