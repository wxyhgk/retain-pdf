import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { articlePath, studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { PUBLISHED_FOLDERS } from '@blog/markdown/articles/rules.mjs';
import { t } from '@blog/i18n/index.mjs';
import type { ArticleFileEntry, ArticleIssue, ArticlePayload, ArticleSummary, Backlink, GitStatus, HistoryEntry, HistoryReason, SearchResult, TrashEntry } from '../types.ts';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, options);
	const data = await response.json();
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

export function createArticle(slug: string, title: string, parent = '', made: { body?: string; files?: string[] } = {}): Promise<{ slug: string }> {
	return request('/api/studio/articles', jsonOptions('POST', { slug, title, parent, ...made }));
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
	commands: Array<{ name: string; description: string }>;
	usage: { used: number; size: number; cost: { amount: number; currency: string } | null } | null;
	/** The service Claude Code or pi talks to (its name, its id), when not the Claude account or pi's own setting. */
	service: string | null;
	serviceId?: string | null;
	/** The last item written on its page (chats/<id>/index.md); what comes after is the turn going on. */
	pageThrough: string | null;
	/** Whether it has a page (opened in the editor as one): spoken to, or begun as one. */
	onPage: boolean;
	/** Whether it can be spoken to while it works (pi in the Studio's process). */
	canSteer?: boolean;
};
/** A tool call's content: words, a change to a file, or a terminal. */
export type ToolContent = { type: 'content'; content: { type: string; text?: string } } | { type: 'diff'; path: string; oldText?: string | null; newText: string } | { type: 'terminal'; terminalId: string };
/** What a conversation is made of, in order. */
export type ConversationItem =
	| { kind: 'user'; id: string; text: string; context?: { article: string | null; selection: string | null; mentions: string[]; articleSlug?: string | null; mentionSlugs?: string[] }; steer?: boolean }
	| { kind: 'message'; id: string; text: string }
	| { kind: 'thought'; id: string; text: string }
	| { kind: 'tool'; id: string; title: string; toolKind: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; content: ToolContent[]; locations: Array<{ path: string; line?: number | null }>; rawInput: unknown; output: string; exitCode: number | null }
	| { kind: 'plan'; id: string; entries: Array<{ content: string; priority: string; status: 'pending' | 'in_progress' | 'completed' }> }
	| { kind: 'permission'; id: string; title: string; toolCallId: string | null; options: Array<{ optionId: string; name: string; kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' }>; chosen: string | null }
	/** `resume`: a turn over with nothing said; it can be asked to go on (接着说). */
	| { kind: 'notice'; id: string; severity: string; title: string; description: string; resume?: boolean }
	| { kind: 'stop'; id: string; reason: string }
	| { kind: 'error'; id: string; message: string };
export type ConversationEvent =
	| { type: 'all'; session: Conversation; items: ConversationItem[] }
	| { type: 'item'; item: ConversationItem }
	| { type: 'append'; id: string; text: string }
	| { type: 'session'; session: Conversation };

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
	const source = new EventSource(conversationApi(id, 'events'));
	source.addEventListener('message', (event) => listener(JSON.parse(event.data) as ConversationEvent));
	return () => source.close();
}

/** Where the author is, told with what they say: the article open, the lines selected in it, the articles named with @. */
export type ConversationContext = { article?: string; selection?: { start: number; end: number; text: string }; mentions?: string[] };

/** Says `text` in a conversation; `steer`: while it works (pi in the Studio's process: `canSteer`), taken once its step is done. */
export async function tellConversation(id: string, text: string, context: ConversationContext = {}, { steer = false }: { steer?: boolean } = {}): Promise<void> {
	await request(conversationApi(id, 'prompt'), jsonOptions('POST', { text, context, ...(steer ? { steer } : {}) }));
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
export type MiniApp = { id: string; name: string; icon: string; description: string; width: number; height: number; permissions: string[]; problem?: string };

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

export function localeSettings(): Promise<LocalesShown> {
	return request<LocalesShown>('/api/studio/settings/locale');
}

export function saveLocale(locale: string): Promise<LocalesShown> {
	return request<LocalesShown>('/api/studio/settings/locale', jsonOptions('PUT', { locale }));
}
