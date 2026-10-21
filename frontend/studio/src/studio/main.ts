// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
import {
	articleFilesUrl,
	articleFileUrl,
	checkArticle,
	codeFileFigure,
	createArticle,
	setArticleParent,
	getArticle,
	gitStatus,
	listArticleFiles,
	revealArticleFile,
	saveArticle,
	saveMoleculeView,
	StudioApiError,
	uploadArticleFile,
	keepVersion,
	addReference,
	importDriveFile,
	driveInfo,
	pluginApi,
	listPlugins,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { createStudioEditor } from './editor/studio-editor';
import { setMoleculeViewContext } from '@blog/science/browser/molecule-renderer.ts';
import { setScienceResourceBaseUrl } from '@blog/science/browser/resource-context.ts';
import { useMacros } from '@blog/science/rendering/math.ts';
import { macrosFor } from '../math-macros.mjs';
import { ArticleSession, type SaveState } from './state/article-session';
import { trackWrite } from './state/writes';
import type { ArticlePayload, ArticleSummary } from './types';
import { createArticleActions, relinkedNote } from './workspace/article-actions';
import { createArticleList } from './workspace/article-list';
import { showContextMenu } from './workspace/context-menu';
import { watchDisk } from './workspace/disk-events';
import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { BIBLIOGRAPHY_PATH, parseBibtex, type BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { createCitePicker } from './workspace/cite-picker';
import { sourceLinesOf } from './document/source-lines';
import { setWidgetFiles, widgetFilesChanged } from '@blog/markdown/widgets/widget-host.ts';
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { officeFilesChanged } from '@blog/office/card.ts';
import { firstSheetRows } from '@blog/office/render.ts';
import { openOfficeFile } from '@blog/office/viewer.ts';
import { createFilePanel } from './workspace/file-panel';
import { isImage, markdownReference } from './article-files';
import { createDriveBrowser } from './workspace/drive-browser';
import { officeKind } from '@blog/office/kinds.mjs';
import { uploadFolderFor } from './workspace/file-tree';
import { autoSlug, freeSlug, isAutoSlug, readableSlug } from './workspace/page-names';
import { pluginCommands, setStudioPluginEnabled, startStudioPlugins, studioPluginInfo, studioPlugins } from './plugins';
import { createPluginsDialog } from './workspace/plugins-dialog';
import { runCommand, showPluginUi } from './workspace/plugin-ui';
import { createOutline } from './workspace/outline';
import { createPageSnapshot } from './workspace/page-snapshot';
import { createBacklinks } from './workspace/backlinks';
import { createArticleTable } from './workspace/article-table';
import { createPageHeader } from './workspace/page-header';
import { createPublishCheck } from './workspace/publish-check';
import { createQuickFind } from './workspace/quick-find';
import { createReviewBar } from './workspace/review-bar';
import { createSidePanel } from './workspace/side-panel';
import { createTerminalPane } from './workspace/terminal';
import { showToast } from './workspace/toast';
import { createTopBar } from './workspace/top-bar';
import { createHistoryView } from './workspace/history-view';
import { createTrashView } from './workspace/trash-view';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;
const editorPanel = shell.querySelector<HTMLElement>('.editor-panel')!;
const outline = createOutline(editorScroll, shell.querySelector<HTMLElement>('#editor-outline')!);

const topBar = createTopBar(shell);
// The page as it is left, drawn at once on the next visit (page-snapshot.ts).
let saveState: SaveState['kind'] = 'loading';
let filesListed: Promise<void> = Promise.resolve();
let backlinksShown: Promise<void> = Promise.resolve();
const snapshot = createPageSnapshot(shell, {
	slug: () => session.slug,
	settled: () => (shell.dataset.view ?? 'editor') === 'editor' && (saveState === 'loaded' || saveState === 'saved') && !session.hasUnsavedEdits(),
});
const articleActions = createArticleActions({
	openSlug: () => session.slug,
	leave: () => session.saveBeforeLeaving(),
	open: (slug) => session.open(slug, { discard: true }),
	reload: () => articleList.load(),
	refreshGit: () => refreshGit(),
});
const articleList = createArticleList(shell.querySelector<HTMLElement>('.article-sidebar')!, {
	open: (slug) => {
		showView('editor');
		void session.open(slug);
	},
	rename: (article) => void articleActions.rename(article),
	duplicate: (article) => void articleActions.duplicate(article),
	remove: (article) => void articleActions.remove(article),
	commit: (article) => void articleActions.commit(article),
	createChild: (article) => void newPage(article.slug),
	// On disk, the open article too (saved first): what changes is its properties alone, which it takes in quietly.
	move: (slug, parent, place) => {
		void (async () => {
			if (slug === session.slug && !(await session.flush())) return;
			try {
				await trackWrite(() => setArticleParent(slug, parent, place));
			} catch (error) {
				showToast(error instanceof Error ? error.message : '没能移动这个页面', true);
				return;
			}
			await articleList.load();
		})();
	},
	listed: (articles) => {
		showPath();
		properties.knowTags(articles.flatMap((article) => article.tags ?? []));
		if (shell.dataset.view === 'table') articleTable.refresh();
	},
});

/** Asks git, a moment after the last change, which articles have changes not committed. */
let gitTimer = 0;
function refreshGit(): void {
	window.clearTimeout(gitTimer);
	gitTimer = window.setTimeout(() => {
		gitStatus().then((status) => articleList.showGit(status), () => {});
	}, 400);
}
const publishCheck = createPublishCheck(document.querySelector<HTMLDialogElement>('#publish-check-dialog')!);
const properties = createPageHeader(shell.querySelector<HTMLElement>('.document-header')!, {
	changed: (typed) => session.editProperties(typed),
	// The article as the editor holds it, saved or not, is what gets published.
	async mayPublish() {
		const slug = session.slug;
		if (!slug) return false;
		editor.settle();
		try {
			return await publishCheck.confirm(await checkArticle(slug, session.current.source));
		} catch (error) {
			showToast(`发布前检查没能完成：${error instanceof Error ? error.message : '未知错误'}`);
			return false;
		}
	},
	publish: () => void publishAndName(),
	leaveTitle: () => editor.focusStart(),
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	async pictures() {
		const slug = session.slug;
		if (!slug) return [];
		const entries = await listArticleFiles(slug);
		return entries.filter((entry) => entry.kind === 'file' && entry.path.startsWith('img/') && isImage(entry.path)).map((entry) => `./${entry.path}`);
	},
	async upload(file) {
		const slug = session.slug;
		if (!slug) throw new Error('文章尚未载入');
		const { path } = await uploadArticleFile(slug, 'img', file);
		void filePanel.refresh();
		return `./${path}`;
	},
});
const sidePanel = createSidePanel(shell);
const terminal = createTerminalPane(shell.querySelector<HTMLElement>('#side-terminal')!);
const filePanel = createFilePanel(shell.querySelector<HTMLElement>('#side-files')!, {
	source: () => session.current.source,
	revision: () => session.current.revision,
	settle: () => session.flush(),
	moved: (from, to, rewritten) => session.fileMoved(from, to, rewritten),
	insertMarkdown: (markdown) => editor.insertMarkdown(markdown),
	viewOffice: (url, name) => void openOfficeFile(url, name),
	sheetRows: firstSheetRows,
});

const editor = createStudioEditor(shell.querySelector<HTMLElement>('#crepe-editor')!, {
	// Files dropped or pasted into the editor, and its image uploads, go into the open article's folder.
	files: {
		async upload(files) {
			const slug = session.slug;
			if (!slug) throw new Error('文章尚未载入');
			const paths: string[] = [];
			try {
				for (const file of files) paths.push((await uploadArticleFile(slug, uploadFolderFor(null, file), file)).path);
			} finally {
				void filePanel.refresh();
			}
			return paths;
		},
		fromDrive: (path) => copyFromDrive(path),
		report: showToast,
	},
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	codeFile: (reference, language, meta) => (session.slug ? codeFileFigure(session.slug, reference, language, meta) : Promise.reject(new Error('文章尚未载入'))),
	changed: (markdown) => session.editBody(markdown),
	async pickArticle() {
		const slug = await quickFind.pick();
		const article = articleList.articles().find((entry) => entry.slug === slug);
		return article ? { title: article.title, href: articleAddress(article.kind, article.slug) } : null;
	},
	openArticle: (slug) => void session.open(slug),
	askAI: () => void askAI(),
	pickCitation: () => citePicker.pick(),
	articleTitle: (slug) => articleList.articles().find((entry) => entry.slug === slug)?.title ?? null,
	reviewing: (pending) => reviewBar.show(pending),
});
const reviewBar = createReviewBar(shell, { acceptAll: () => editor.acceptAll(), rejectAll: () => editor.rejectAll() });
bindTitleFocus(() => properties.focusTitle());

// Browser tests wait longer before saving, to have unsaved edits to work with.
const testDelay = (window as { STUDIO_AUTOSAVE_DELAY?: number }).STUDIO_AUTOSAVE_DELAY;
const session = new ArticleSession(
	{
		getArticle,
		saveArticle,
		saveMoleculeView,
		isConflict: (error) => error instanceof StudioApiError && error.status === 409,
		keepVersion,
	},
	{
		async mount(article, body, again) {
			useArticleContext(article);
			const scrollTop = editorScroll.scrollTop;
			const markdown = await editor.mount(body);
			if (again) editorScroll.scrollTop = scrollTop;
			return markdown;
		},
		review(article, body, from) {
			useArticleContext(article);
			reviewBar.reviewing(from);
			return editor.review(body);
		},
		settle: () => editor.settle(),
		confirm: (message) => window.confirm(message),
		toast: (message) => showToast(message),
		opened({ article, properties: shown }) {
			openTitle = shown.title || article.slug;
			studioPlugins.emit('studio/article-opened', article.slug);
			properties.show(shown, article.problems ?? []);
			topBar.showArticle(article.slug, shown.title || article.slug, shown.kind);
			topBar.edited(article.modified ?? null);
			editorPanel.classList.toggle('is-wide', Boolean(shown.wide));
			articleList.select(article.slug);
			showPath();
			filesListed = filePanel.show(article.slug);
			backlinksShown = backlinks.show(article.slug);
			terminal.showArticle(article.slug);
			void loadLibrary(article.slug);
			const url = new URL(window.location.href);
			url.searchParams.set('article', article.slug);
			history.replaceState(null, '', url);
			snapshot.changed();
		},
		saveState: (state) => {
			saveState = state.kind;
			topBar.saveState(state);
		},
		roundtrip: (exact) => topBar.roundtrip(exact),
		retitled(title) {
			openTitle = title;
			topBar.showTitle(title);
			if (session.slug) articleList.retitled(session.slug, title);
		},
		saved(slug, saved, problems) {
			articleList.saved(slug, saved);
			topBar.edited(Date.now());
			properties.showProblems(problems);
			snapshot.changed();
		},
	},
	testDelay ? { delay: testDelay, maxWait: testDelay } : {},
);
session.subscribe(() => filePanel.sourceChanged());

/** The open article's title as typed (the plugins' `ctx.studio.article()`). */
let openTitle = '';

// The plugins are told the article's file changed (`studio/source-changed`), a moment after the last change.
{
	let told = { slug: '', source: '' };
	let timer = 0;
	session.subscribe(({ article, source }) => {
		window.clearTimeout(timer);
		if (!article || (article.slug === told.slug && source === told.source)) return;
		timer = window.setTimeout(() => {
			told = { slug: article.slug, source };
			studioPlugins.emit('studio/source-changed', article.slug, source);
		}, 250);
	});
}

/** Where the article's chemistry finds its files and its saved molecule views. */
function useArticleContext(article: ArticlePayload): void {
	setScienceResourceBaseUrl(articleFilesUrl(article.slug));
	useMacros(macrosFor(article.macros));
	setMoleculeViewContext({
		views: article.chemistryViews,
		save: (key, format, view, display) => session.saveView(key, format, view, display),
	});
}

/** Reads the article list and opens one: `slug`, the one in the address, or the first. */
async function openFromList(slug?: string, discard = false): Promise<void> {
	const articles = await articleList.load();
	const requested = slug ?? new URL(window.location.href).searchParams.get('article') ?? undefined;
	const initial = articles.some((article) => article.slug === requested) ? requested : articles[0]?.slug;
	if (initial) await session.open(initial, { discard });
	else topBar.showEmpty();
}

/**
 * A new page, at once (as in Notion): no dialog, no folder name to think of
 * (one is made up; it gets one read from the title when it is published);
 * opened with its title selected, to be typed over. Under `parent` when given.
 */
async function newPage(parent = ''): Promise<void> {
	if (!(await session.saveBeforeLeaving())) return;
	const slug = freeSlug(autoSlug(), articleList.articles().map((article) => article.slug));
	try {
		await createArticle(slug, '无标题', parent);
	} catch (error) {
		showToast(error instanceof Error ? error.message : '新建失败', true);
		return;
	}
	await openFromList(slug, true);
	if (session.slug === slug) properties.selectTitle();
}
for (const opener of shell.querySelectorAll<HTMLElement>('#new-article, #new-article-secondary')) {
	opener.addEventListener('click', () => void newPage());
}

/** The pages the open one is under, above its title. */
function showPath(): void {
	const articles = articleList.articles();
	const bySlug = new Map(articles.map((article) => [article.slug, article]));
	const pages: Array<{ slug: string; title: string }> = [];
	const seen = new Set<string>();
	for (let at = session.slug ? bySlug.get(session.slug)?.parent : undefined; at && !seen.has(at) && bySlug.has(at); at = bySlug.get(at)?.parent) {
		seen.add(at);
		pages.unshift({ slug: at, title: bySlug.get(at)!.title });
	}
	properties.showPath(pages, (slug) => void session.open(slug));
}

/**
 * Published: saved, and, if its folder name is still one made up for a new
 * page, given one read from its title, which is its address on the blog from
 * now on (a published page is never renamed so, its address kept).
 */
async function publishAndName(): Promise<void> {
	if (!(await session.flush())) return;
	const slug = session.slug;
	const article = articleList.articles().find((entry) => entry.slug === slug);
	if (!slug || !article || article.draft !== false || !isAutoSlug(slug)) return;
	const wanted = readableSlug(article.title);
	if (!wanted || isAutoSlug(wanted)) return;
	const to = freeSlug(wanted, articleList.articles().map((entry) => entry.slug));
	const renamed = await articleActions.renameTo(article, to);
	if (renamed) showToast(`已发布，网址是 /${article.kind === 'wiki' ? 'wiki' : 'blog'}/${to}/${relinkedNote(renamed.relinked)}`);
}

/**
 * 「问 AI」 (⌘J, the toolbar, a block's menu): the article saved, the lines
 * the selected blocks are in, and a question about them typed into the
 * terminal for the author to finish and send.
 */
async function askAI(): Promise<void> {
	const slug = session.slug;
	const marked = slug ? editor.markSelection() : null;
	if (!slug || !marked) return;
	if (!(await session.flush())) {
		showToast('文章还没保存好，保存后再问 AI', true);
		return;
	}
	const lines = sourceLinesOf(session.current.source, marked);
	if (!lines) {
		showToast('没找到选中的内容在文件里的位置', true);
		return;
	}
	sidePanel.show('terminal');
	terminal.ask(slug, lines);
}

/** The open article's library (assets/refs.bib), read again when it changes; null when it has none. */
let library: Map<string, BibEntry> | null = null;
let librarySlug: string | null = null;
let libraryRead = 0;
async function loadLibrary(slug: string): Promise<void> {
	const reading = ++libraryRead;
	// Another article's library numbers nothing here.
	if (librarySlug !== slug) {
		librarySlug = slug;
		library = null;
		editor.setLibrary(null);
	}
	let next: Map<string, BibEntry> | null = null;
	try {
		const response = await fetch(articleFileUrl(slug, `./${BIBLIOGRAPHY_PATH}`), { cache: 'no-store' });
		if (response.ok) next = parseBibtex(await response.text());
	} catch {
		// Unreadable: as if there were none.
	}
	if (reading !== libraryRead || session.slug !== slug) return;
	library = next;
	editor.setLibrary(library);
}

const citePicker = createCitePicker(document.querySelector<HTMLDialogElement>('#cite-dialog')!, {
	library: () => library,
	async addDoi(doi) {
		const slug = session.slug;
		if (!slug) throw new Error('还没有打开文章');
		const { key } = await addReference(slug, doi);
		await loadLibrary(slug);
		return key;
	},
});

// Something changed in blog/: the terminal, Finder or another editor.
watchDisk((changes) => {
	snapshot.changed();
	backlinks.changed();
	articleList.changedOnDisk(changes);
	refreshGit();
	const change = changes.find((entry) => entry.slug === session.slug);
	if (!change) return;
	void filePanel.refresh();
	session.changedOnDisk(change.paths);
	widgetFilesChanged(change.paths);
	studioPlugins.emit('studio/files-changed', change.slug, change.paths);
	officeFilesChanged(change.paths.map((path) => studioFileUrl(change.slug, path)));
	if (change.paths.includes(BIBLIOGRAPHY_PATH)) void loadLibrary(change.slug);
});

// The project's plugins (plugins/*/studio.ts: the calculation block, RetainMol…), given the article open, its files and their API.
// Those turned off (插件) are left out; if the list cannot be read, all are put in.
void listPlugins()
	.then(
		(plugins) => ({ off: plugins.filter((plugin) => !plugin.enabled).map((plugin) => plugin.id), present: plugins.filter((plugin) => plugin.entries.includes('studio.ts')).map((plugin) => plugin.id) }),
		() => ({ off: [], present: [] }),
	)
	.then(({ off, present }) => startStudioPlugins({
		slug: () => session.slug,
		fileUrl: studioFileUrl,
		save: () => void session.flush(),
		article: () => (session.slug ? { slug: session.slug, title: openTitle || session.slug } : null),
		source() {
			if (!session.slug) return null;
			editor.settle();
			return session.current.source;
		},
		editor: {
			view: () => editor.view(),
			insert: (markdown) => editor.insertMarkdown(markdown),
			insertText(text) {
				const view = editor.view();
				if (!view) return;
				view.dispatch(view.state.tr.insertText(text).scrollIntoView());
				view.focus();
			},
		},
		toast: (message, error = false) => showToast(message, error),
		showPanel: (key) => sidePanel.show(key),
		api: pluginApi,
	}, off, present))
	.then((problems) => {
		// Their tabs in the right column, their commands in the left one and on their keys.
		showPluginUi({ setPanels: (panels) => sidePanel.setPanels(panels), sidebar: shell.querySelector<HTMLElement>('#plugin-commands')! });
		if (problems.length) showToast(problems.join('；'), true);
	});
const pluginsDialog = createPluginsDialog(document.querySelector<HTMLDialogElement>('#plugins-dialog')!, { info: studioPluginInfo, setEnabled: setStudioPluginEnabled });
shell.querySelector('#open-plugins')!.addEventListener('click', () => void pluginsDialog.open());
// A plugin edited (by hand or by an AI in the terminal) is put in again at once: said here; the article drawn again if its blocks changed.
studioPlugins.on('studio/plugins-reloaded', (changed, problems) => {
	showToast(problems.length ? problems.join('；') : `已重新载入插件：${changed.join('、')}`, problems.length > 0);
});
studioPlugins.on('studio/editor-changed', () => void session.remount());

// Widgets read the open article's files (note.file, or a widget that is a file).
setWidgetFiles((path) => (session.slug ? studioFileUrl(session.slug, path) : path));

/**
 * After a search: the first block of the open article that holds `text`, in
 * view and marked for a moment. The mark is laid over the block, since the
 * editor redraws its own elements and would drop a class added to them.
 */
function showFound(text: string): void {
	const needle = text.toLocaleLowerCase('zh-CN');
	const blocks = editorScroll.querySelectorAll<HTMLElement>('.ProseMirror > *, .ProseMirror li, .ProseMirror td');
	const block = [...blocks].find((element) => element.textContent?.toLocaleLowerCase('zh-CN').includes(needle));
	if (!block) return;
	block.scrollIntoView({ block: 'center' });
	editorScroll.querySelector('.search-flash')?.remove();
	const box = block.getBoundingClientRect();
	const frame = editorScroll.getBoundingClientRect();
	const mark = document.createElement('div');
	mark.className = 'search-flash';
	mark.style.top = `${box.top - frame.top + editorScroll.scrollTop - 2}px`;
	mark.style.left = `${box.left - frame.left + editorScroll.scrollLeft - 6}px`;
	mark.style.width = `${box.width + 12}px`;
	mark.style.height = `${box.height + 4}px`;
	editorScroll.append(mark);
	window.setTimeout(() => mark.remove(), 1700);
}

/** Opens an article from somewhere else on the page, at the first paragraph holding `text`. */
async function openAt(slug: string, text = ''): Promise<void> {
	showView('editor');
	await session.open(slug);
	if (text && session.slug === slug) requestAnimationFrame(() => showFound(text));
}

const backlinks = createBacklinks(shell.querySelector<HTMLElement>('#page-backlinks')!, { open: (slug, text) => void openAt(slug, text) });

const quickFind = createQuickFind(document.querySelector<HTMLDialogElement>('#quick-find-dialog')!, {
	articles: () => articleList.articles(),
	open: openAt,
	openDriveFile(path) {
		showView('drive');
		void drivePage.reveal(path);
	},
});
shell.querySelector('#open-search')!.addEventListener('click', () => quickFind.open());

/** A file of the drive copied into the open article (`img/` for a picture, else `assets/`): its path there. */
async function copyFromDrive(path: string): Promise<string> {
	const slug = session.slug;
	if (!slug) throw new Error('先打开一篇文章');
	try {
		return (await importDriveFile(slug, path, isImage(path) ? 'img' : 'assets')).path;
	} finally {
		void filePanel.refresh();
	}
}

// The drive (资料库): a page in the middle, and a list in the side panel to drag files into the article from.
const driveHost = {
	article: () => {
		const slug = session.slug;
		return slug ? { slug, title: articleList.articles().find((article) => article.slug === slug)?.title || slug } : null;
	},
	askAI(path: string) {
		sidePanel.show('terminal');
		// The words of an Office file are in the drive's text (drive-text.mjs); an AI reads the rest itself.
		const kind = officeKind(path);
		terminal.askAboutDriveFile(path, kind !== null && kind !== 'old');
	},
	async insertIntoArticle(path: string) {
		const reference = markdownReference(await copyFromDrive(path));
		if (reference) editor.insertMarkdown(reference);
	},
};
const driveView = shell.querySelector<HTMLElement>('#drive-view')!;
const driveButton = shell.querySelector<HTMLButtonElement>('#open-drive')!;
const drivePage = createDriveBrowser(driveView, {
	...driveHost,
	changed: () => {
		void drivePane.refresh();
		void showDriveRoot();
	},
	navigated(folder) {
		if (shell.dataset.view !== 'drive') return;
		const url = new URL(window.location.href);
		url.searchParams.set('drive', folder);
		history.replaceState(null, '', url);
	},
}, { mode: 'page' });
const drivePane = createDriveBrowser(shell.querySelector<HTMLElement>('#side-drive')!, {
	...driveHost,
	changed: () => {
		void drivePage.refresh();
		void showDriveRoot();
	},
}, { mode: 'pane' });
/** Tells the terminal where the drive is, for its 资料库 folder. */
async function showDriveRoot(): Promise<void> {
	terminal.showDrive((await driveInfo().catch(() => null))?.root ?? null);
}
void showDriveRoot();
void drivePane.open('');

// All the articles, as a table or a board (article-table.ts).
const tableView = shell.querySelector<HTMLElement>('#table-view')!;
const tableButton = shell.querySelector<HTMLButtonElement>('#open-table')!;
const articleTable = createArticleTable(tableView, {
	articles: () => articleList.articles(),
	current: () => session.slug,
	open(slug) {
		showView('editor');
		void session.open(slug);
	},
});

/** The article in the middle, the drive or the table of all articles (the article stays open behind them). */
function showView(view: 'editor' | 'drive' | 'table', folder?: string): void {
	shell.dataset.view = view;
	driveView.hidden = view !== 'drive';
	tableView.hidden = view !== 'table';
	driveButton.setAttribute('aria-pressed', String(view === 'drive'));
	tableButton.setAttribute('aria-pressed', String(view === 'table'));
	const url = new URL(window.location.href);
	if (view === 'drive') void drivePage.open(folder);
	else url.searchParams.delete('drive');
	if (view === 'table') {
		url.searchParams.set('pages', '');
		articleTable.show();
	} else {
		url.searchParams.delete('pages');
	}
	history.replaceState(null, '', url);
}
driveButton.addEventListener('click', () => showView(shell.dataset.view === 'drive' ? 'editor' : 'drive'));
tableButton.addEventListener('click', () => showView(shell.dataset.view === 'table' ? 'editor' : 'table'));
{
	const address = new URL(window.location.href).searchParams;
	const folder = address.get('drive');
	if (folder !== null) showView('drive', folder);
	else if (address.has('pages')) showView('table');
}

const trashView = createTrashView(document.querySelector<HTMLDialogElement>('#trash-dialog')!, {
	articleRestored(slug) {
		void articleList.load().then(() => session.open(slug));
	},
	fileRestored(slug) {
		if (slug === session.slug) void filePanel.refresh();
	},
});
shell.querySelector('#open-trash')!.addEventListener('click', () => void trashView.open());

const historyView = createHistoryView(document.querySelector<HTMLDialogElement>('#history-dialog')!, {
	restore: (source) => void session.restoreVersion(source),
});

/** The open article, as the list knows it, for the actions on a whole article. */
function openSummary(): ArticleSummary | null {
	return articleList.articles().find((article) => article.slug === session.slug) ?? null;
}

// ⋯: what can be done to the page, as in Notion's page menu.
const pageMenu = shell.querySelector<HTMLButtonElement>('#page-menu')!;
pageMenu.addEventListener('click', () => {
	const article = openSummary();
	if (!article) return;
	const address = articleAddress(article.kind, article.slug);
	showContextMenu([
		{
			label: properties.isWide() ? '全宽 ✓' : '全宽',
			action: () => {
				if (properties.setWide(!properties.isWide())) editorPanel.classList.toggle('is-wide', properties.isWide());
			},
		},
		{
			label: '复制博客链接',
			action: () => {
				const link = new URL(address, import.meta.env.SITE ?? window.location.origin).href;
				navigator.clipboard.writeText(link).then(() => showToast(`已复制 ${link}`), () => showToast('浏览器不允许写入剪贴板', true));
			},
		},
		{ label: /Mac/u.test(navigator.platform) ? '在 Finder 中显示' : '在文件管理器中显示', action: () => void revealArticleFile(article.slug, '') },
		{ label: '历史版本…', action: () => void historyView.open(article.slug) },
		// The plugins' (`ctx.commands`, `places: ['page-menu']`).
		...(pluginCommands()?.list('page-menu') ?? []).map((command) => ({ label: command.label, action: () => runCommand(command, 'page-menu') })),
		'separator',
		{ label: '改文件夹名…', action: () => void articleActions.rename(article) },
		{ label: '复制一份', action: () => void articleActions.duplicate(article) },
		{ label: '移到回收站', danger: true, action: () => void articleActions.remove(article) },
	], pageMenu);
});

// ⌘K or ⌘P (Ctrl elsewhere) finds an article, from anywhere; ⌘K on text selected in the editor links it instead.
document.addEventListener('keydown', (event) => {
	if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || !['k', 'p'].includes(event.key.toLowerCase())) return;
	event.preventDefault();
	quickFind.open();
});

// Saving is automatic; ⌘S (or ⌘↩) saves at once (in a plugin's frame too, through its `ctx.studio.save`).
document.addEventListener('keydown', (event) => {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || (event.key !== 'Enter' && event.key.toLowerCase() !== 's')) return;
	event.preventDefault();
	void session.flush();
});
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden' && session.hasUnsavedEdits()) void session.flush();
});
window.addEventListener('beforeunload', (event) => {
	if (!session.hasUnsavedEdits()) return;
	void session.flush();
	event.preventDefault();
});

// Astro reloads every open page when an article's Markdown changes, which
// with autosave is every few seconds. The Studio follows those changes
// itself, so a reload marked as theirs (content-reloads.mjs) is pointed at
// another page, which Vite then leaves alone.
import.meta.hot?.on('vite:beforeFullReload', (payload: { path?: string; studioContentChange?: boolean }) => {
	if (payload.studioContentChange) payload.path = '/studio-keeps-open.html';
});

openFromList().then(
	() => {
		articleActions.offerPendingUndo();
		refreshGit();
	},
	(error) => topBar.error(error instanceof Error ? error.message : '无法连接本地 Studio'),
).finally(() => {
	// The page takes over from its picture once it looks the same: the article's files and backlinks listed, its outline drawn.
	const listed = Promise.all([filesListed, backlinksShown]).catch(() => {});
	void Promise.race([listed, new Promise((resolve) => window.setTimeout(resolve, 1000))]).then(() => {
		outline.draw();
		snapshot.ready();
	});
	// The plugins get ready what will be wanted (RetainMol, loaded in the background), once the page has settled.
	studioPlugins.emit('studio/ready');
});
