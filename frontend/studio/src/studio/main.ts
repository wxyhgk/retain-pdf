// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
// What each feature does with the parts is in wiring/: the pages, the AI in the
// editor, AI 问答, the drive, the library, the plugins, the page's keys.
import './locale';
import { followTheme, toggleTheme } from './common/theme';
import {
	articleFileHead,
	articleFileUrl,
	checkArticle,
	codeFileFigure,
	getArticle,
	gitStatus,
	listArticleFiles,
	saveArticle,
	saveMoleculeView,
	StudioApiError,
	uploadArticleFile,
	keepVersion,
	listMiniApps,
	listTemplates,
	databaseRows,
	databaseConfig,
	databaseInfo,
	setDatabaseConfig,
	createDatabase,
	detachDatabase,
	addDatabaseOption,
	setArticleParent,
	setDatabaseValue,
	setDatabaseValues,
	setDatabaseTitle,
	addDatabaseRow,
	changeDatabaseColumns,
	renderTemplate,
	tellStarted,
	openArticleFileInApp,
	revealArticleFile,
	retainpdfBookNote,
	retainpdfBooks,
	tellRetainpdfReading,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { usePictureSizes } from './editor/figure-block';
import { createStudioEditor } from './editor/studio-editor';
import type { EditorView } from '@milkdown/prose/view';
import { AppWindow, Copy, Eye, FolderSearch, History, LayoutTemplate } from 'lucide-react';
import { showContextMenu } from './common/context-menu';
import { WIDGET_ASK, WIDGET_START, type WidgetAsk, type WidgetStart } from '@blog/kernel/widget-events.ts';
import { useMacros } from '@blog/science/rendering/math.ts';
import { macrosFor } from '../math-macros.mjs';
import { ARTICLE_TEXT_FILES, ArticleSession, type SaveState } from './state/article-session';
import type { ArticlePayload } from './types';
import { createArticleActions } from './pages/article-actions';
import { favoriteSlugs } from './pages/favorites';
import { createArticleList } from './pages/article-list';
import { watchDisk } from './common/disk-events';
import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { t } from '@blog/i18n/index.mjs';
import { BIBLIOGRAPHY_PATH } from '@blog/markdown/references/bibtex.mjs';
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { officeFilesChanged } from '@blog/office/card.ts';
import { firstSheetRows } from '@blog/office/render.ts';
import { openOfficeFile } from '@blog/office/viewer.ts';
import { createFilePanel } from './files/file-panel';
import { isImage, linkPath } from './files/article-files';
import { uploadFolderFor } from './files/file-tree';
import { pluginCommands, setStudioPluginEnabled, studioPluginInfo, studioPlugins } from './plugins';
import { safeModeNow, showSafeModeBar, startFinished } from './safe-mode';
import { createOutline } from './pages/outline';
import { keepFormulasFitted } from '@blog/science/browser/fit-formulas.ts';
import { createPageSnapshot } from './pages/page-snapshot';
import { anchorScroll } from './pages/scroll-anchor';
import { watchOverflow } from './pages/overflow-watch';
import { createBacklinks } from './pages/backlinks';
import { createArticleTable } from './pages/article-table';
import { createPageHeader } from './pages/page-header';
import { createReviewBar } from './pages/review-bar';
import { createSidePanel } from './panels/side-panel';
import { createTerminalPane } from './panels/terminal';
import { createMiniApps } from './panels/mini-apps';
import { showToast } from './common/toast';
import { createTopBar } from './shell/top-bar';
import { mountShell } from './shell/mount';
import { shell as shellState, type View } from './shell/shell-state';
import { openDialog } from './shell/dialogs/Dialogs';
import { confirmPublish, createQuickFind, openAgents, openSettings, providePlugins } from './shell/dialogs/ask';
import { answerWindows } from './windows/studio-line';
import { openFileEditor } from './files/file-editor';
import { openFileHistory } from './files/file-history-view';
import { openFilePreview } from './files/file-preview';
import { setDatabaseSpace } from './editor/database/database-block';
import { trackWrite } from './state/writes';
import { parseStudioDocument } from '@blog/document/parse.ts';
import { textFileLanguage } from '@blog/markdown/code-files/languages.mjs';
import { fileOpenWayFor, type FileClick } from './files/file-open';
import type { Studio } from './wiring/studio';
import { createPages } from './wiring/pages';
import { createEditorAi } from './wiring/editor-ai';
import { createRetainpdfView, type RetainpdfBook, type RetainpdfQuote, type RetainpdfReading } from './wiring/retainpdf-view';
import { createBookTabs } from './wiring/book-tabs';
import { citedBooks } from './editor/retainpdf-source';
import { createNotesSplit } from './wiring/notes-split';
import { markReadingPage, rememberPage } from './wiring/book-places';
import { followQuoteOpens, quoteMarkdown, RETAINPDF_NAVIGATE, type RetainpdfOpen } from './editor/retainpdf-quote';
import { createAiChat } from './wiring/ai-chat';
import { createDrive } from './wiring/drive';
import { createLibrary } from './wiring/library';
import { startPlugins } from './wiring/plugins';
import { bindPageKeys } from './wiring/keys';
import { createReadingPlace } from './pages/reading-place';
import { createFindBar } from './editor/find-in-article';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
// 设置 › 插件: how each is doing here, and turning one off or on at once.
providePlugins({ info: studioPluginInfo, setEnabled: setStudioPluginEnabled });
// The left column, the bar above and the right column's tabs, drawn by React (shell/), before anything looks in them.
mountShell(shell, {
	search: () => quickFind.open(),
	showView: (view) => showView(view),
	newPage: () => void pages.newPage(),
	todayJournal: () => void pages.todayJournal(),
	importMarkdown: (kind) => void pages.importMarkdown(kind),
	newChat: () => chat.newChat(),
	openChat: (id) => chat.openChat(id),
	chatMenu: (entry, row) => chat.chatList.menu(entry, row),
	moveChat: (id, before) => void chat.chatList.move(id, before),
	renameChat: (entry) => chat.chatList.rename(entry),
	openTrash: () =>
		openDialog('trash', {
			host: {
				articleRestored: (slug) => void articleList.load().then(() => session.open(slug)),
				fileRestored(slug) {
					if (slug === session.slug) void filePanel.refresh();
				},
			},
		}),
	openSettings: () => openSettings(),
	pageMenu: (anchor) => pages.showPageMenu(anchor),
	back: () => pages.visited.step(-1),
	openPage: (slug) => {
		showView('editor');
		void session.open(slug);
	},
	pagesUnder: (slug) => articleList.childrenOf(slug),
	toggleFavorite: (slug) => pages.starPage(slug ?? session.slug),
	toggleBooks: () => setBooksOpen(!booksSplit.open),
	forward: () => pages.visited.step(1),
	chooseTab: (tab) => sidePanel.choose(tab),
	togglePanel: () => sidePanel.toggle(),
	closePanel: () => sidePanel.close(),
});
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;
// Light or dark: as chosen (设置 › 外观), or as the system is, followed as it changes.
followTheme();
const readingPlace = createReadingPlace(editorScroll);
/** 查找替换 in all the articles (ReplaceDialog), with these words to look for. */
let replaceRound = 0;
function findEverywhere(words = ''): void {
	openDialog('replace', {
		round: ++replaceRound,
		find: words,
		flush: () => session.flush(),
		changed: async (slugs) => (session.slug && slugs.includes(session.slug) ? session.reload() : undefined),
		open(slug) {
			showView('editor');
			void session.open(slug);
		},
	});
}
const editorPanel = shell.querySelector<HTMLElement>('.editor-panel')!;
// ⌘F in the article (find-in-article.ts), over the editor.
const findBar = createFindBar({ panel: editorPanel, scroller: editorScroll, view: () => editor.view(), findEverywhere });
const outline = createOutline(editorScroll, shell.querySelector<HTMLElement>('#editor-outline')!);
// Display formulas wider than the page: in lines, or smaller, not scrolled (fit-formulas.ts).
keepFormulasFitted(editorScroll);
anchorScroll(editorScroll);
watchOverflow(editorScroll);

/** The open article's title as typed (the plugins' `ctx.studio.article()`). */
let openTitle = '';
/** The parts, for the features (wiring/), each read when used: some features are made before the parts they reach. */
const studio: Studio = {
	shell,
	editorScroll,
	get session() {
		return session;
	},
	get editor() {
		return editor;
	},
	get articleList() {
		return articleList;
	},
	get articleActions() {
		return articleActions;
	},
	get properties() {
		return properties;
	},
	get topBar() {
		return topBar;
	},
	get sidePanel() {
		return sidePanel;
	},
	get terminal() {
		return terminal;
	},
	get filePanel() {
		return filePanel;
	},
	title: () => openTitle,
	showView: (view, folder) => showView(view, folder),
};

const topBar = createTopBar(shell);
// The page as it is left, drawn at once on the next visit (page-snapshot.ts).
let saveState: SaveState['kind'] = 'loading';
let filesListed: Promise<void> = Promise.resolve();
let backlinksShown: Promise<void> = Promise.resolve();
/** Done once the editor first shows an article. */
let articleShown: () => void = () => {};
const shown = new Promise<void>((resolve) => {
	articleShown = resolve;
});
const snapshot = createPageSnapshot(shell, {
	slug: () => session.slug,
	settled: () => (shell.dataset.view ?? 'editor') === 'editor' && (saveState === 'loaded' || saveState === 'saved') && !session.hasUnsavedEdits(),
});
const articleActions = createArticleActions({
	openSlug: () => session.slug,
	leave: () => session.saveBeforeLeaving(),
	// The one open already is read again: what was done may have changed it on disk.
	open: (slug) => (slug === session.slug ? session.reload() : session.open(slug, { discard: true })),
	reload: () => articleList.load(),
	refreshGit: () => refreshGit(),
});
const articleList = createArticleList(shell.querySelector<HTMLElement>('.article-sidebar')!, {
	open: (slug) => {
		showView('editor');
		// Marked at once, as it is clicked, not once it is shown; back on the one open if it is not opened.
		articleList.select(slug);
		void session.open(slug).then(() => {
			if (session.slug && session.slug !== slug) articleList.select(session.slug);
		});
	},
	duplicate: (article) => void articleActions.duplicate(article),
	remove: (article) => void articleActions.remove(article),
	commit: (article) => void articleActions.commit(article),
	createChild: (article) => void pages.newPage(article.slug),
	createDatabase: (article) => void pages.newDatabase(article.slug),
	merge: (article) => void articleActions.merge(article),
	// On disk, the open article too (saved first): what changes is its properties alone, which it takes in quietly.
	move: (slugs, parent, place) => void pages.movePages(slugs, parent, place),
	moveTo: (slugs) => {
		void (async () => {
			const target = await quickFind.pickPlace(slugs);
			if (target !== null) await pages.movePages(slugs, target);
		})();
	},
	removeMany: (articles) => void articleActions.removeMany(articles),
	isFavorite: (slug) => favoriteSlugs().includes(slug),
	toggleFavorite: (slug) => pages.starPage(slug),
	listed: (articles) => {
		pages.showPath();
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
const properties = createPageHeader(shell.querySelector<HTMLElement>('.document-header')!, {
	changed: (typed) => session.editProperties(typed),
	// The article as the editor holds it, saved or not, is what gets published.
	async mayPublish() {
		const slug = session.slug;
		if (!slug) return false;
		editor.settle();
		try {
			return await confirmPublish(await checkArticle(slug, session.current.source));
		} catch (error) {
			showToast(t('发布前检查没能完成：{error}', { error: error instanceof Error ? error.message : t('未知错误') }));
			return false;
		}
	},
	publish: () => void pages.publishAndName(),
	leaveTitle: (newBlock, text) => (newBlock ? editor.startNewBlock(text) : editor.focusStart()),
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	addDatabaseOption: (database, column, option) => trackWrite(() => addDatabaseOption(database, column, option)),
	async pictures() {
		const slug = session.slug;
		if (!slug) return [];
		const entries = await listArticleFiles(slug);
		return entries.filter((entry) => entry.kind === 'file' && entry.path.startsWith('img/') && isImage(entry.path)).map((entry) => `./${entry.path}`);
	},
	async upload(file) {
		const slug = session.slug;
		if (!slug) throw new Error(t('页面尚未载入'));
		const { path } = await uploadArticleFile(slug, 'img', file);
		void filePanel.refresh();
		return `./${path}`;
	},
});
// The AI tab and AI 问答 (wiring/ai-chat.ts), before the right column, which asks at once whether its tab is shown.
const chat = createAiChat(studio, { withArticlePictures: (markdown) => drive.withArticlePictures(markdown) });

const sidePanel = createSidePanel(shell, { shown: (tab) => tab === 'ai' && chat.aiPanel.shown() });
chat.restoreLayout();
const terminal = createTerminalPane(shell.querySelector<HTMLElement>('#side-terminal')!, { editAgents: () => void openAgents(() => terminal.refreshAgents()) });
// A widget in the article asking the AI (note.ask, a button in it clicked): put in the AI's input, for the author to
// send (one in an answer is said in its conversation: the panel takes it first).
document.addEventListener(WIDGET_START, (event) => {
	(event as CustomEvent<WidgetStart>).detail.canAsk = true;
});
document.addEventListener(WIDGET_ASK, (event) => {
	event.preventDefault();
	chat.showAi();
	chat.aiPanel.ask((event as CustomEvent<WidgetAsk>).detail.text);
});
// 小程序: the tools of apps/, in floating windows; what they may reach of the article shown.
const appsView = shell.querySelector<HTMLElement>('#apps-view')!;
const miniApps = createMiniApps(appsView, shell.querySelector<HTMLElement>('#mini-app-layer')!, {
	article: () => (session.slug ? { slug: session.slug, title: openTitle, source: session.current.source } : null),
	insert: (markdown) => editor.insertMarkdown(markdown),
	toast: (message) => showToast(message),
	openPage: (slug, find) => void pages.openAt(slug, find),
	askAI: (prompt) => {
		chat.showAi();
		chat.aiPanel.ask(prompt);
	},
	showApps: () => {
		if (shellState.get().view !== 'apps') showView('apps');
	},
	addSideTab: (panel) => sidePanel.addTab(panel),
	removeSideTab: (key) => sidePanel.removeOwnTab(key),
	opened: (kind) => windowOpened(kind),
});

/** A text file of the article open (a script, an input, data) to read and change; its previews drawn again once saved. */
function editArticleFile(path: string, initial?: 'history'): void {
	if (!session.slug) return;
	openFileEditor({
		slug: session.slug,
		path,
		initial,
		toast: (message, error) => showToast(message, error),
		saved(changed) {
			editor.redrawCodeFile(changed);
			void filePanel.refresh();
		},
	});
}

/** /模板: the templates listed where the caret is; the one chosen, filled in, put there. */
async function insertTemplate(view: EditorView): Promise<void> {
	const { templates } = await listTemplates().catch(() => ({ templates: [] }));
	if (!templates.length) {
		showToast(t('还没有模板：在页面的 ⋯ 里「存为模板…」，或在仓库的 templates/ 里放一个 .md'));
		return;
	}
	const caret = view.coordsAtPos(view.state.selection.from);
	showContextMenu(
		templates.map((template) => ({
			label: template.name,
			icon: LayoutTemplate,
			action: () => void renderTemplate(template.id, openTitle).then(({ body }) => editor.insertMarkdown(body), (error: unknown) => showToast(error instanceof Error ? error.message : String(error), true)),
		})),
		{ x: caret.left, y: caret.bottom + 4 },
	);
}

/** A file card's ⋯ (article-links.ts): its file opened, shown, its history, its path. */
function fileMenu(path: string, anchor: HTMLElement): void {
	const slug = session.slug;
	if (!slug) return;
	const failed = (error: unknown) => showToast(error instanceof Error ? error.message : String(error), true);
	showContextMenu(
		[
			{ label: t('打开'), icon: Eye, action: () => previewArticleFile(path) },
			{ label: t('用默认程序打开'), icon: AppWindow, action: () => void openArticleFileInApp(slug, path).catch(failed) },
			{ label: /Mac/u.test(navigator.platform) ? t('在 Finder 中显示') : t('在文件管理器中显示'), icon: FolderSearch, action: () => void revealArticleFile(slug, path).catch(failed) },
			{ label: t('历史版本…'), icon: History, action: () => showFileHistory(path) },
			'separator',
			{ label: t('复制路径'), icon: Copy, action: () => void navigator.clipboard.writeText(`./${path}`).then(() => showToast(t('已复制路径')), failed) },
		],
		anchor,
	);
}

/** A file of the article shown in the Studio as what it is (file-preview.ts): a PDF, a picture, a table, its editor… */
function previewArticleFile(path: string): void {
	const slug = session.slug;
	if (!slug) return;
	openFilePreview({
		slug,
		path,
		toast: (message, error) => showToast(message, error),
		edit: (file) => editArticleFile(file),
		viewOffice: (url, name) => void openOfficeFile(url, name),
		restored() {
			editor.redrawCodeFile(path);
			void filePanel.refresh();
		},
	});
}

/** A file's earlier versions (kept before it was written over): in its editor's 历史版本 tab, or alone for a file not edited here. */
function showFileHistory(path: string): void {
	const slug = session.slug;
	if (!slug) return;
	if (textFileLanguage(path)) return editArticleFile(path, 'history');
	openFileHistory({
		slug,
		path,
		toast: (message, error) => showToast(message, error),
		restored() {
			editor.redrawCodeFile(path);
			void filePanel.refresh();
		},
	});
}

/** A file of the article opened as the author chose for this click (设置 › 打开文件): its editor here, its program, Finder. */
function openArticleFile(path: string, click: FileClick = 'click'): void {
	const slug = session.slug;
	if (!slug) return;
	const failed = (error: unknown) => showToast(error instanceof Error ? error.message : String(error), true);
	const way = fileOpenWayFor(path, click);
	if (way === 'studio') previewArticleFile(path);
	else if (way === 'app') openArticleFileInApp(slug, path).catch(failed);
	else revealArticleFile(slug, path).catch(failed);
}

/** The windows of their own (显示方式 › 新窗口: a 小程序, the AI), answered: what they ask of the Studio here. */
const windows = answerWindows(async (method, args) => {
	if (method === 'app.call') return miniApps.answerFor(String(args[0]), String(args[1]), Array.isArray(args[2]) ? args[2] : []);
	if (method === 'app.dock') {
		const where = args[1] === 'side' || args[1] === 'float' ? args[1] : 'page';
		await miniApps.openIn(String(args[0]), where, String(args[2] ?? ''));
		return true;
	}
	if (method.startsWith('ai.')) return chat.answerWindow(method, args);
	throw new Error(t('Studio 不认识 {method}', { method }));
});
/** Whether a window showing `kind` says it is open within a few seconds. */
function windowOpened(kind: string): Promise<boolean> {
	return new Promise((resolve) => {
		const timer = window.setTimeout(() => {
			stop();
			resolve(false);
		}, 6000);
		const stop = windows.heard(({ what, kind: shown }) => {
			if (what !== 'hello' || shown !== kind) return;
			clearTimeout(timer);
			stop();
			resolve(true);
		});
	});
}
chat.windows(windows, windowOpened);
const filePanel = createFilePanel(shell.querySelector<HTMLElement>('#side-files')!, {
	source: () => session.current.source,
	revision: () => session.current.revision,
	settle: () => session.flush(),
	moved: (from, to, rewritten) => session.fileMoved(from, to, rewritten),
	insertMarkdown: (markdown) => editor.insertMarkdown(markdown),
	viewOffice: (url, name) => void openOfficeFile(url, name),
	editFile: (path) => editArticleFile(path),
	openFile: (path) => openArticleFile(path),
	fileHistory: (path) => showFileHistory(path),
	sheetRows: firstSheetRows,
	ocr: (path) => void editorAi.ocrPdf(path),
});
// 数据库: a database is a page (`type: database`), its rows the pages under it (server/articles/databases.mjs); its
// block in its own page is it, a block in another page shows it.
setDatabaseSpace({
	page() {
		const article = session.current.article;
		return article ? { slug: article.slug, database: article.properties?.type === 'database' } : null;
	},
	host: (slug) => ({
		rows: async () => (await databaseRows(slug)).rows,
		setValue: async (row, column, value) => (await trackWrite(() => setDatabaseValue(row, column.name, column.type, value))).value,
		setValues: async (row, entries) => (await trackWrite(() => setDatabaseValues(row, entries.map(({ column, value }) => ({ column: column.name, type: column.type, value }))))).values,
		setTitle: async (row, title) => {
			await trackWrite(() => setDatabaseTitle(row, title));
			void articleList.load();
		},
		async addRow(row) {
			const made = await trackWrite(() => addDatabaseRow(slug, row));
			void articleList.load();
			return made.slug;
		},
		changeColumns: async (change) => void (await trackWrite(() => changeDatabaseColumns(slug, change))),
		async removeRow(row) {
			const article = articleList.articles().find((entry) => entry.slug === row);
			if (article) await articleActions.remove(article);
		},
		async removeRows(slugs) {
			const pages = articleList.articles().filter((entry) => slugs.includes(entry.slug));
			if (pages.length) await articleActions.removeMany(pages);
		},
		async moveRow(row, place) {
			await trackWrite(() => setArticleParent(row, slug, place));
			void articleList.load();
		},
		open(row) {
			showView('editor');
			void session.open(row);
		},
		templates: async () => (await listTemplates()).templates,
		toast: (message, error) => showToast(message, error),
		rowBody: async (row) => parseStudioDocument((await getArticle(row)).source).body.raw,
		fileUrl: (row, src) => articleFileUrl(row, src),
	}),
	info: (slug) => databaseInfo(slug),
	saveConfig: async (slug, config) => void (await trackWrite(() => setDatabaseConfig(slug, config))),
	async rename(slug, title) {
		await trackWrite(() => setDatabaseTitle(slug, title));
		void articleList.load();
	},
	async create() {
		const made = await trackWrite(() => createDatabase('', session.slug ?? ''));
		void articleList.load();
		return made.slug;
	},
	async detach(text) {
		const page = session.slug;
		if (!page) throw new Error(t('没有打开页面'));
		const made = await trackWrite(() => detachDatabase(page, text));
		void articleList.load();
		return made.slug;
	},
	open(slug) {
		showView('editor');
		void session.open(slug);
	},
	toast: (message, error) => showToast(message, error),
});

// The files listed anew: the editor's file cards say their sizes.
filePanel.listed(() => editor.filesListed());

const editor = createStudioEditor(shell.querySelector<HTMLElement>('#crepe-editor')!, {
	// 转成子页面: a page under the open article, made with a section of it.
	subPage: {
		plan: () => pages.subPage.plan(),
		make: (slug, title, body, files) => pages.subPage.make(slug, title, body, files),
	},
	// Files dropped or pasted into the editor, and its image uploads, go into the open article's folder.
	files: {
		async upload(files) {
			const slug = session.slug;
			if (!slug) throw new Error(t('页面尚未载入'));
			const paths: string[] = [];
			try {
				for (const file of files) paths.push((await uploadArticleFile(slug, uploadFolderFor(null, file), file)).path);
			} finally {
				void filePanel.refresh();
			}
			return paths;
		},
		fromDrive: (path) => drive.copyFromDrive(path),
		withPictures: (markdown) => drive.withArticlePictures(markdown),
		head: async (path) => (session.slug ? articleFileHead(session.slug, path) : null),
		report: showToast,
	},
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	codeFile: (reference, language, meta) => (session.slug ? codeFileFigure(session.slug, reference, language, meta) : Promise.reject(new Error(t('页面尚未载入')))),
	editFile: (path) => editArticleFile(path),
	openFile: (path, click) => openArticleFile(path, click),
	fileMenu: (path, anchor) => fileMenu(path, anchor),
	fileSize: (path) => filePanel.entries().find((entry) => entry.path === path)?.size ?? null,
	insertTemplate: (view) => void insertTemplate(view),
	changed: (markdown) => session.editBody(markdown),
	async pickArticle() {
		const picked = await quickFind.pick();
		if (picked && 'create' in picked) return pages.makeLinkedPage(picked.create);
		const article = articleList.articles().find((entry) => entry.slug === picked?.slug);
		return article ? { title: article.title, href: articleAddress(article.kind, article.slug) } : null;
	},
	async pickMention() {
		const slug = session.slug;
		const files = filePanel.entries().filter((entry) => entry.kind === 'file' && /^(?:img|assets)\//u.test(entry.path)).map(({ path, size }) => ({ path, size }));
		const picked = await quickFind.mention(files);
		if (!picked) return null;
		if ('slug' in picked) {
			const article = articleList.articles().find((entry) => entry.slug === picked.slug);
			return article ? { title: article.title, href: articleAddress(article.kind, article.slug) } : null;
		}
		const path = 'file' in picked ? picked.file : slug ? await drive.copyFromDrive(picked.drive).catch((error: unknown) => (showToast(error instanceof Error ? error.message : String(error), true), null)) : null;
		if (!path) return null;
		void filePanel.refresh();
		return { title: path.split('/').pop() ?? path, href: linkPath(path) };
	},
	openArticle: (slug) => void session.open(slug),
	// 页面 (/page): a page under the open one, linked where the caret is, and gone into.
	makePage: () => pages.makePage(),
	enterPage: (slug) => void pages.enterNewPage(slug),
	askAI: () => void editorAi.askAI(),
	writeWithAI: () => void editorAi.askAI(),
	instruct: (fresh) => void editorAi.instructHere(fresh),
	ocrPdf: (view, pos, path) => void editorAi.ocrPdf(path, view, pos),
	recognize: (view, pos) => editorAi.recognizePicture(view, pos),
	pickCitation: () => library.pick(),
	articleTitle: (slug) => articleList.articles().find((entry) => entry.slug === slug)?.title ?? null,
	reviewing: (pending) => reviewBar.show(pending),
	shown: () => {
		articleShown();
		readingPlace.show();
		findBar.refresh();
	},
});
const reviewBar = createReviewBar(shell, {
	acceptAll: () => editor.acceptAll(),
	rejectAll: () => editor.rejectAll(),
	// What the AI wrote, not wanted as it is: let go, and asked again once the article is as it was.
	async retry() {
		editor.rejectAll();
		for (let waited = 0; saveState === 'reviewing' && waited < 2000; waited += 50) await new Promise((done) => setTimeout(done, 50));
		editorAi.retry();
	},
});
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
			// Another article: where it was read last (reading-place.ts), else from its top; where the one left was, kept.
			if (!again) {
				readingPlace.leave();
				readingPlace.enter(article.slug);
				editorScroll.scrollTop = 0;
			}
			// Shown again (changed on disk): all at once, to be where it was.
			const markdown = await editor.mount(body, again);
			if (again) editorScroll.scrollTop = scrollTop;
			// All of it there (a long one is shown a part at a time): where it was read, if the author has not moved since.
			else readingPlace.show(true);
			// The files it names, once it is shown (a book's take a while to read).
			filePanel.sourceChanged();
			chat.aiPanel.articleShown();
			// 书 out: this note's books beside it (found once it is shown: the ones it quotes).
			if (!again && booksSplit.open) showNoteBooks();
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
			openTitle = shown.title || t('无标题');
			studioPlugins.emit('studio/article-opened', article.slug);
			properties.show(shown, article.problems ?? []);
			// A row of a database (the page it is under is one): its columns among its properties.
			if (shown.parent) {
				const [opening, parent] = [article.slug, shown.parent];
				void databaseConfig(parent).then((config) => session.slug === opening && properties.showDatabase(config ? { slug: parent, config } : null), () => {});
			}
			topBar.showArticle(article.slug, shown.title || t('无标题'), shown.kind);
			topBar.edited(article.modified ?? null);
			editorPanel.classList.toggle('is-wide', Boolean(shown.wide));
			articleList.select(article.slug);
			pages.showPath();
			filesListed = filePanel.show(article.slug);
			backlinksShown = backlinks.show(article.slug);
			terminal.showArticle(article.slug);
			chat.aiPanel.showArticle({ slug: article.slug, title: openTitle });
			void library.load(article.slug);
			const url = new URL(window.location.href);
			url.searchParams.set('article', article.slug);
			history.replaceState(null, '', url);
			pages.visited.shown(article.slug);
			snapshot.changed();
		},
		saveState: (state) => {
			saveState = state.kind;
			topBar.saveState(state);
		},
		roundtrip: (exact) => topBar.roundtrip(exact),
		retitled(title) {
			openTitle = title || t('无标题');
			topBar.showTitle(openTitle);
			if (session.slug) {
				articleList.retitled(session.slug, title);
				// The AI panel's chip of the article open, named anew too (not left as it was till it is taken off and on).
				chat.aiPanel.showArticle({ slug: session.slug, title: openTitle });
			}
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
// Not while an article is being shown: its files are read once it is (a book's take a while).
session.subscribe(() => saveState !== 'loading' && filePanel.sourceChanged());

/** The article the editor shows, or is about to (the plugins' `ctx.studio.shown()`). */
let shownArticle: ArticlePayload | null = null;

/** What the article is drawn with: its formulas' macros; the plugins' blocks are told it is the one shown (its files, its saved views). */
function useArticleContext(article: ArticlePayload): void {
	shownArticle = article;
	useMacros(macrosFor(article.macros));
	usePictureSizes(article.pictures);
	// Before its blocks are drawn: what they draw with is this article's.
	studioPlugins.emit('studio/article-showing', article.slug);
}

// The features, once the parts they use are made (wiring/).
const pages = createPages(studio);
const editorAi = createEditorAi(studio);
const library = createLibrary(studio);
// 安全模式 (?safe, or after two starts that did not finish): no plugins, whatever they are; a bar says so.
const safe = safeModeNow();
showSafeModeBar(safe);
startPlugins(studio, { shown: () => shownArticle, safe });

// Something changed in blog/: the terminal, Finder or another editor.
watchDisk((changes) => {
	miniApps.notesChanged();
	windows.tell('notes-changed');
	snapshot.changed();
	backlinks.changed();
	articleList.changedOnDisk(changes);
	refreshGit();
	const change = changes.find((entry) => entry.slug === session.slug);
	if (!change) return;
	void filePanel.refresh();
	// The AI at work, writing the article bit by bit: its text looked over once its turn is over, not at each bit; its
	// other files (a widget's page, the data one reads, an output) shown as they are now, as it works on them.
	const text = change.paths.some((path) => ARTICLE_TEXT_FILES.includes(path));
	if (!text || !chat.hold(change)) session.changedOnDisk(change.paths);
	studioPlugins.emit('studio/files-changed', change.slug, change.paths);
	officeFilesChanged(change.paths.map((path) => studioFileUrl(change.slug, path)));
	if (change.paths.includes(BIBLIOGRAPHY_PATH)) void library.load(change.slug);
});

const backlinks = createBacklinks(shell.querySelector<HTMLElement>('#page-backlinks')!, { open: (slug, text) => void pages.openAt(slug, text) });

const quickFind = createQuickFind({
	articles: () => articleList.articles(),
	open: (slug, text) => pages.openAt(slug, text),
	openDriveFile(path) {
		showView('drive');
		void drive.page.reveal(path);
	},
	// `> …`: the plugins' commands, each app (opened, or at a command it gives), and making one.
	async commands() {
		const plugin = (pluginCommands()?.list() ?? []).map((command) => ({
			key: `plugin:${command.id}`,
			label: command.label,
			icon: command.icon && [...command.icon].length <= 2 ? command.icon : '›',
			hint: command.keys,
			run: () => void command.run({ from: 'call' }),
		}));
		// 今天的日志, and a page from each template (templates/).
		const templates = (await listTemplates().catch(() => ({ templates: [] }))).templates;
		const fromTemplates = [
			{ key: 'studio:today', label: t('今天的日志'), icon: '📅', run: () => void pages.todayJournal() },
			{ key: 'studio:new-database', label: t('新建数据库'), icon: '▦', hint: t('一个整页的数据库，它下面的页面就是各行'), run: () => void pages.newDatabase() },
			...templates.map((template) => ({ key: `template:${template.id}`, label: t('新建：{name}', { name: template.name }), icon: '＋', hint: template.description, run: () => void pages.newFromTemplate(template.id) })),
		];
		const apps = (await listMiniApps().catch(() => [])).filter((app) => !app.problem);
		const fromApps = apps.flatMap((app) => [
			{ key: `app:${app.id}`, label: t('打开小程序「{name}」', { name: app.name }), icon: app.icon, run: () => void miniApps.open(app.id) },
			...app.commands.map((command) => ({ key: `app:${app.id}:${command.id}`, label: `${app.name}：${command.title}`, icon: app.icon, run: () => void miniApps.open(app.id, command.entry) })),
		]);
		const imports = [
			{ key: 'studio:import-files', label: t('导入 Markdown 文件…'), icon: '⇪', hint: '.md .zip', run: () => void pages.importMarkdown('files') },
			{ key: 'studio:import-folder', label: t('导入 Markdown 文件夹…'), icon: '⇪', run: () => void pages.importMarkdown('folder') },
		];
		const theme = { key: 'studio:theme', label: t('切换亮色 / 暗色'), icon: '◐', run: toggleTheme };
		const finding = { key: 'studio:replace', label: t('在全部页面里查找替换…'), icon: '⌕', hint: '⌘⇧F', run: () => findEverywhere() };
		return [...fromTemplates, finding, theme, ...imports, ...plugin, ...fromApps, { key: 'studio:new-app', label: t('新建小程序…'), icon: '＋', run: () => miniApps.create() }];
	},
});

const drive = createDrive(studio);

// All the articles, as a table or a board (article-table.ts).
// 翻译: RetainPDF's own pages in the middle, loaded the first time it is shown.
const translateView = shell.querySelector<HTMLElement>('#translate-view')!;
// Its 笔记: the book's page of notes beside it (wiring/notes-split.ts), opened and put away from either side. While it is
// open (and 翻译 shown) the right column is folded away, the note wanting the room, and the bar says the note as for an
// article (its title, saving).
const notesSplit = createNotesSplit(shell, translateView, { close: () => closeNotes() });
/** The book whose page of notes is beside RetainPDF, or was last; `caret`: the author has been writing in it since. */
let notesBook: (RetainpdfBook & { slug: string; noteTitle: string; caret: boolean }) | null = null;
function setNotesOpen(open: boolean): void {
	notesSplit.open = open;
	sidePanel.fold(open && shellState.get().view === 'translate');
	shellState.set({ notesOpen: open });
	tellReading();
}
/** What RetainPDF's reader said it shows (`reading`); null: nothing, or a RetainPDF that does not say. */
let readerShows: RetainpdfReading | null = null;
/** The last told the server, not told again. */
let toldReading = 'null';
/**
 * What the author reads, told the server for the AIs (server/retainpdf-reading.mjs): while 翻译 is shown, the book its
 * reader shows (else the book whose notes are open), its page, its page of notes; nothing elsewhere.
 */
function tellReading(): void {
	const view = shellState.get().view;
	const beside = view === 'editor' && booksSplit.open ? bookTabs.reading() : null;
	const book: (RetainpdfBook & { page_idx?: number | null; page_count?: number | null }) | null =
		view === 'editor' ? beside : view !== 'translate' ? null : (readerShows ?? (notesSplit.open ? notesBook : null));
	const notes = beside && session.slug
		? { slug: session.slug, title: openTitle }
		: book && notesBook && notesSplit.open && sameBook(notesBook, book) ? { slug: notesBook.slug, title: notesBook.noteTitle } : null;
	markReadingPage(view === 'translate' ? readerShows : beside);
	chat.aiPanel.showBook(book ? { title: book.title, page: typeof book.page_idx === 'number' ? book.page_idx + 1 : null } : null);
	const told = book
		? { job_id: book.job_id, document_id: book.document_id, title: book.title, page: typeof book.page_idx === 'number' ? book.page_idx + 1 : null, pages: book.page_count ?? null, notes }
		: null;
	const said = JSON.stringify(told);
	if (said === toldReading) return;
	toldReading = said;
	tellRetainpdfReading(told).catch(() => {
		toldReading = '';
	});
}
function closeNotes(): void {
	setNotesOpen(false);
	retainpdf.notes(false);
}
const sameBook = (one: RetainpdfBook, other: RetainpdfBook): boolean =>
	one.document_id && other.document_id ? one.document_id === other.document_id : one.job_id === other.job_id;
/** The book's page of notes (found, or made under 读书笔记) open beside RetainPDF; false when it could not be. */
async function openNotes(book: RetainpdfBook): Promise<boolean> {
	try {
		const note = await retainpdfBookNote(book);
		if (note.created) await articleList.load();
		if (session.slug !== note.slug) await session.open(note.slug);
		if (notesBook?.slug !== note.slug) notesBook = { ...book, slug: note.slug, noteTitle: note.title, caret: false };
		setNotesOpen(true);
		retainpdf.notes(true, note.title);
		return true;
	} catch (error) {
		showToast(t('没能打开这本书的笔记：{error}', { error: error instanceof Error ? error.message : String(error) }), true);
		retainpdf.notes(false);
		return false;
	}
}
// Written in (the caret put in the note beside RetainPDF): passages quoted go where the caret is from then on. Beside its
// books, once typed in (a quote's mark pressed puts the caret there too, but is not writing).
const noteEditor = shell.querySelector<HTMLElement>('#crepe-editor')!;
noteEditor.addEventListener('focusin', () => {
	if (notesBook && notesSplit.open && session.slug === notesBook.slug) notesBook.caret = true;
});
noteEditor.addEventListener('beforeinput', () => {
	if (booksOf === session.slug) caretInNote = true;
});
const retainpdf = createRetainpdfView(translateView, {
	openSettings: () => openSettings('retainpdf'),
	openNotes: (book) => void openNotes(book),
	closeNotes,
	reading(reading) {
		readerShows = reading;
		if (reading && reading.page_idx !== null) rememberPage(reading.job_id, reading.page_idx);
		tellReading();
	},
	// Its reader's AI: the Studio's own, which reads RetainPDF's books (told the book and page read, tellReading).
	askAi() {
		chat.showAi();
		chat.aiPanel.focus();
	},
	// 摘到笔记: the passage put in the book's page of notes, opened beside RetainPDF when it is not; where the caret is
	// when the author has been writing in it, else after the last block. Shown where it went.
	async quote(quote) {
		const book: RetainpdfBook = { job_id: quote.job_id, document_id: quote.document_id, title: quote.title };
		const writing = notesSplit.open && notesBook !== null && sameBook(notesBook, book) && session.slug === notesBook.slug;
		if (!writing && !(await openNotes(book))) return;
		putQuote(quote, writing && notesBook?.caret ? 'caret' : 'end');
	},
});
/** A passage quoted (摘到笔记) into the note shown: where the caret is, or after the last block; shown where it went. */
function putQuote(quote: RetainpdfQuote, where: 'caret' | 'end'): void {
	{
		const placed = editor.insertMarkdown(
			quoteMarkdown({
				book: quote.title,
				document: quote.document_id,
				job: quote.job_id,
				block: quote.item_id,
				page: quote.page_idx + 1,
				source: quote.source_text,
				translated: quote.translated_text,
			}),
			where,
		);
		if (placed) {
			placed.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			placed.dataset.justQuoted = '';
			window.setTimeout(() => delete placed.dataset.justQuoted, 1600);
		}
		showToast(t('已摘到「{title}」', { title: openTitle || session.slug }));
	}
}

// 书 beside a note (以笔记为根): the books it quotes, and any opened beside it, a tab each over RetainPDF's reader
// (wiring/book-tabs.ts); which, the one shown, and the ones closed kept for each note in this browser. The note stays
// the page: a quote's mark shows its passage beside it, and what is quoted from them goes into it.
const booksView = shell.querySelector<HTMLElement>('#books-view')!;
const booksSplit = createNotesSplit(shell, booksView, { close: () => setBooksOpen(false) }, { flag: 'books', closeLabel: t('收起旁边的书') });
const NOTE_BOOKS_KEY = 'retainpdf-note-books';
const BOOKS_OPEN_KEY = 'retainpdf-books-open';
type NoteBooks = { books: RetainpdfBook[]; shown: string | null; closed: string[] };
function keptNoteBooks(slug: string): NoteBooks | null {
	try {
		const all = JSON.parse(localStorage.getItem(NOTE_BOOKS_KEY) || '{}') as Record<string, NoteBooks>;
		const kept = all[slug];
		return kept && Array.isArray(kept.books) ? { books: kept.books, shown: kept.shown ?? null, closed: Array.isArray(kept.closed) ? kept.closed : [] } : null;
	} catch {
		return null;
	}
}
function keepNoteBooks(slug: string, kept: NoteBooks): void {
	try {
		const all = JSON.parse(localStorage.getItem(NOTE_BOOKS_KEY) || '{}') as Record<string, NoteBooks>;
		all[slug] = kept;
		localStorage.setItem(NOTE_BOOKS_KEY, JSON.stringify(all));
	} catch {
		// Not kept: the note's books are found again from what it quotes.
	}
}
/** The note whose books the tabs are; the books they were (to tell which the author closed); the caret put in it since. */
let booksOf: string | null = null;
let tabJobs: string[] = [];
let caretInNote = false;
/** The note's books: those kept for it, then (not closed) the book whose notes it is (读书笔记) and the ones it quotes. */
function noteBooks(slug: string): { books: RetainpdfBook[]; shown: string | null } {
	const kept = keptNoteBooks(slug);
	const books = [...(kept?.books ?? [])];
	const own = shellState.get().book;
	const view = editor.view();
	for (const book of [...(own ? [own] : []), ...(view ? citedBooks(view.state.doc) : [])]) {
		if (!books.some((each) => each.job_id === book.job_id) && !kept?.closed.includes(book.job_id)) books.push({ ...book });
	}
	return { books, shown: kept?.shown ?? own?.job_id ?? null };
}
const bookTabs = createBookTabs(booksView, {
	openSettings: () => openSettings('retainpdf'),
	quote(quote) {
		if (!session.slug || booksOf !== session.slug) return;
		putQuote(quote, caretInNote ? 'caret' : 'end');
	},
	askAi() {
		chat.showAi();
		chat.aiPanel.focus();
	},
	reading(reading) {
		if (reading && reading.page_idx !== null) rememberPage(reading.job_id, reading.page_idx);
		tellReading();
	},
	changed(books, shown) {
		if (!booksOf) return;
		const jobs = books.map((book) => book.job_id);
		const before = keptNoteBooks(booksOf);
		const closed = [...new Set([...(before?.closed ?? []), ...tabJobs])].filter((job) => !jobs.includes(job));
		tabJobs = jobs;
		keepNoteBooks(booksOf, { books, shown, closed });
	},
	pick: (anchor) => pickBook(anchor),
});
/** The note shown's books as the tabs (once for each time it is shown). */
function showNoteBooks(): void {
	if (!session.slug || booksOf === session.slug) return;
	booksOf = session.slug;
	caretInNote = false;
	const { books, shown } = noteBooks(session.slug);
	tabJobs = books.map((book) => book.job_id);
	bookTabs.setBooks(books, shown);
}
/** 书 out beside the note, or put away; `first`, a book to show at a passage as it comes out. */
function setBooksOpen(open: boolean, first?: { book: RetainpdfBook; target: RetainpdfOpen }): void {
	booksSplit.open = open;
	shellState.set({ booksOpen: open });
	try {
		localStorage.setItem(BOOKS_OPEN_KEY, open ? '1' : '');
	} catch {
		// This time only.
	}
	const beside = open && shellState.get().view === 'editor';
	booksView.hidden = !beside;
	// The right column folded away meanwhile (as for 书库's notes): the books and the note want the room.
	sidePanel.fold(beside);
	if (open) showNoteBooks();
	if (first) bookTabs.open(first.book, first.target);
	bookTabs.setVisible(beside);
	tellReading();
}
/** ＋: a book of RetainPDF's to open beside the note, from a menu of those not open (the latest read first). */
async function pickBook(anchor: HTMLElement): Promise<RetainpdfBook | null> {
	let listed: Awaited<ReturnType<typeof retainpdfBooks>>['books'];
	try {
		listed = (await retainpdfBooks()).books;
	} catch (error) {
		showToast(t('读不到 RetainPDF 的书：{error}', { error: error instanceof Error ? error.message : String(error) }), true);
		return null;
	}
	const open = new Set(bookTabs.books().map((book) => book.job_id));
	const choices = listed.filter((book) => book.job_id && !open.has(book.job_id));
	if (!choices.length) {
		showToast(listed.length ? t('书库里的书都开着了') : t('RetainPDF 的书库里还没有书'));
		return null;
	}
	return new Promise((resolve) => {
		showContextMenu(
			choices.map((book) => ({
				label: book.title || book.document_id,
				...(book.pages ? { hint: t('{pages} 页', { pages: book.pages }) } : {}),
				action: () => resolve({ job_id: book.job_id!, document_id: book.document_id || null, title: book.title }),
			})),
			anchor,
		);
	});
}
// A quote's RetainPDF mark, or a retainpdf: link (editor/retainpdf-quote.ts): 翻译, at that passage.
followQuoteOpens();
window.addEventListener(RETAINPDF_NAVIGATE, (event) => {
	const { title, document_id: documentId, ...target } = (event as CustomEvent<RetainpdfOpen>).detail;
	// On a note: the book beside it, at the passage, the note staying (以笔记为根). Elsewhere (翻译's own notes, AI 问答): 翻译.
	if (shellState.get().view === 'editor' && session.slug) {
		const book: RetainpdfBook = { job_id: target.job_id, document_id: documentId ?? null, title: title ?? null };
		if (booksSplit.open) bookTabs.open(book, target);
		else setBooksOpen(true, { book, target });
		return;
	}
	showView('translate');
	void retainpdf.navigate(target);
});
const tableView = shell.querySelector<HTMLElement>('#table-view')!;
const articleTable = createArticleTable(tableView, {
	articles: () => articleList.articles(),
	current: () => session.slug,
	open(slug) {
		showView('editor');
		void session.open(slug);
	},
});

/**
 * The article in the middle, the drive, the table of all articles, AI 问答, 小程序 or 翻译 (the article stays open behind them); the
 * left column lists the conversations for AI 问答, the pages for the others.
 */
function showView(view: View, folder?: string): void {
	const again = shellState.get().view === view;
	shell.dataset.view = view;
	shellState.set({ view });
	drive.view.hidden = view !== 'drive';
	tableView.hidden = view !== 'table';
	appsView.hidden = view !== 'apps';
	translateView.hidden = view !== 'translate';
	booksView.hidden = !(view === 'editor' && booksSplit.open);
	bookTabs.setVisible(view === 'editor' && booksSplit.open);
	chat.showChat(view === 'chat');
	const url = new URL(window.location.href);
	if (view === 'drive') void drive.page.open(folder);
	else url.searchParams.delete('drive');
	if (view === 'table') {
		url.searchParams.set('pages', '');
		articleTable.show();
	} else {
		url.searchParams.delete('pages');
	}
	// The right column folded away while 书库 shows the book's notes beside it, or a note its books: the two want the room.
	sidePanel.fold((view === 'translate' && notesSplit.open) || (view === 'editor' && booksSplit.open));
	if (view === 'translate') {
		url.searchParams.set('translate', '');
		void retainpdf.show();
		// Back to 翻译 with the notes open: the book's page beside it again, not the page opened meanwhile.
		if (notesSplit.open && notesBook && session.slug !== notesBook.slug) void session.open(notesBook.slug);
	} else {
		url.searchParams.delete('translate');
	}
	tellReading();
	if (view === 'apps') url.searchParams.set('apps', '');
	else {
		url.searchParams.delete('apps');
		url.searchParams.delete('app');
	}
	history.replaceState(null, '', url);
	if (view === 'apps') {
		if (again) miniApps.list();
		else miniApps.shown();
	}
}
{
	const address = new URL(window.location.href).searchParams;
	const folder = address.get('drive');
	const chatId = address.get('chat');
	if (folder !== null) showView('drive', folder);
	else if (address.has('pages')) showView('table');
	else if (address.has('translate')) showView('translate');
	else if (address.get('app')) void miniApps.open(address.get('app')!);
	else if (address.has('apps')) showView('apps');
	else if (chatId) chat.openChat(chatId);
}

bindPageKeys(session, {
	find: () => quickFind.open(),
	go: (by) => pages.visited.step(by),
	findInArticle: () => (shell.dataset.view ?? 'editor') === 'editor' && findBar.open(),
	findEverywhere: () => {
		const view = editor.view();
		const selected = view && !view.state.selection.empty ? view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, ' ') : '';
		findEverywhere(selected.includes('\n') ? '' : selected);
	},
});

const opening = pages.openFromList().then(
	() => {
		articleActions.offerPendingUndo();
		refreshGit();
	},
	(error) => topBar.error(error instanceof Error ? error.message : t('无法连接本地 Studio')),
);
// The page takes over from its picture once it looks the same: the article shown (a long one's first part; the rest
// comes in after), its files and backlinks listed, its outline drawn.
void Promise.race([opening, shown]).then(() => {
	const listed = Promise.all([filesListed, backlinksShown]).catch(() => {});
	void Promise.race([listed, new Promise((resolve) => window.setTimeout(resolve, 1000))]).then(() => {
		outline.draw();
		snapshot.ready();
	});
});
// The plugins get ready what will be wanted (RetainMol, loaded in the background), once the page has settled.
void opening.finally(() => studioPlugins.emit('studio/ready'));
// Started: not counted against the next start (safe-mode.ts); Studio.app, waiting for it, told (and the code that
// started kept as the last good version).
void opening.then(() => {
	// 书 was out when the Studio was last left: out again, beside the note opened.
	try {
		if (localStorage.getItem(BOOKS_OPEN_KEY) && shellState.get().view === 'editor') setBooksOpen(true);
	} catch {
		// Put away.
	}
	startFinished();
	void tellStarted().catch(() => {});
}, () => {});
