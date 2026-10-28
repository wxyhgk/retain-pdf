// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
// What each feature does with the parts is in wiring/: the pages, the AI in the
// editor, AI 问答, the drive, the library, the plugins, the page's keys.
import './locale';
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
	tellStarted,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { createStudioEditor } from './editor/studio-editor';
import { useMacros } from '@blog/science/rendering/math.ts';
import { macrosFor } from '../math-macros.mjs';
import { ArticleSession, type SaveState } from './state/article-session';
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
import { isImage } from './files/article-files';
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
import type { Studio } from './wiring/studio';
import { createPages } from './wiring/pages';
import { createEditorAi } from './wiring/editor-ai';
import { createAiChat } from './wiring/ai-chat';
import { createDrive } from './wiring/drive';
import { createLibrary } from './wiring/library';
import { startPlugins } from './wiring/plugins';
import { bindPageKeys } from './wiring/keys';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
// 设置 › 插件: how each is doing here, and turning one off or on at once.
providePlugins({ info: studioPluginInfo, setEnabled: setStudioPluginEnabled });
// The left column, the bar above and the right column's tabs, drawn by React (shell/), before anything looks in them.
mountShell(shell, {
	search: () => quickFind.open(),
	showView: (view) => showView(view),
	newPage: () => void pages.newPage(),
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
	forward: () => pages.visited.step(1),
	chooseTab: (tab) => sidePanel.choose(tab),
	togglePanel: () => sidePanel.toggle(),
	closePanel: () => sidePanel.close(),
});
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;
const editorPanel = shell.querySelector<HTMLElement>('.editor-panel')!;
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
	async pictures() {
		const slug = session.slug;
		if (!slug) return [];
		const entries = await listArticleFiles(slug);
		return entries.filter((entry) => entry.kind === 'file' && entry.path.startsWith('img/') && isImage(entry.path)).map((entry) => `./${entry.path}`);
	},
	async upload(file) {
		const slug = session.slug;
		if (!slug) throw new Error(t('文章尚未载入'));
		const { path } = await uploadArticleFile(slug, 'img', file);
		void filePanel.refresh();
		return `./${path}`;
	},
});
// The AI tab and AI 问答 (wiring/ai-chat.ts), before the right column, which asks at once whether its tab is shown.
const chat = createAiChat(studio, { withArticlePictures: (markdown) => drive.withArticlePictures(markdown) });

const sidePanel = createSidePanel(shell, { shown: (tab) => tab === 'ai' && chat.aiPanel.shown() });
const terminal = createTerminalPane(shell.querySelector<HTMLElement>('#side-terminal')!, { editAgents: () => void openAgents(() => terminal.refreshAgents()) });
// 小程序: the tools of apps/, in floating windows; what they may reach of the article shown.
const appsView = shell.querySelector<HTMLElement>('#apps-view')!;
const miniApps = createMiniApps(appsView, shell.querySelector<HTMLElement>('#mini-app-layer')!, {
	article: () => (session.slug ? { slug: session.slug, title: openTitle, source: session.current.source } : null),
	insert: (markdown) => editor.insertMarkdown(markdown),
	toast: (message) => showToast(message),
	openPage: (slug, find) => void pages.openAt(slug, find),
	askAI: (prompt) => {
		sidePanel.show('ai');
		chat.aiPanel.ask(prompt);
	},
	showApps: () => {
		if (shellState.get().view !== 'apps') showView('apps');
	},
});
const filePanel = createFilePanel(shell.querySelector<HTMLElement>('#side-files')!, {
	source: () => session.current.source,
	revision: () => session.current.revision,
	settle: () => session.flush(),
	moved: (from, to, rewritten) => session.fileMoved(from, to, rewritten),
	insertMarkdown: (markdown) => editor.insertMarkdown(markdown),
	viewOffice: (url, name) => void openOfficeFile(url, name),
	sheetRows: firstSheetRows,
	ocr: (path) => void editorAi.ocrPdf(path),
});

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
			if (!slug) throw new Error(t('文章尚未载入'));
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
	codeFile: (reference, language, meta) => (session.slug ? codeFileFigure(session.slug, reference, language, meta) : Promise.reject(new Error(t('文章尚未载入')))),
	changed: (markdown) => session.editBody(markdown),
	async pickArticle() {
		const picked = await quickFind.pick();
		if (picked && 'create' in picked) return pages.makeLinkedPage(picked.create);
		const article = articleList.articles().find((entry) => entry.slug === picked?.slug);
		return article ? { title: article.title, href: articleAddress(article.kind, article.slug) } : null;
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
	shown: () => articleShown(),
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
			// Another article: from its top (the editor is kept from one to the next, and with it where it was scrolled to).
			if (!again) editorScroll.scrollTop = 0;
			// Shown again (changed on disk): all at once, to be where it was.
			const markdown = await editor.mount(body, again);
			if (again) editorScroll.scrollTop = scrollTop;
			// The files it names, once it is shown (a book's take a while to read).
			filePanel.sourceChanged();
			chat.aiPanel.articleShown();
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
// Not while an article is being shown: its files are read once it is (a book's take a while).
session.subscribe(() => saveState !== 'loading' && filePanel.sourceChanged());

/** The article the editor shows, or is about to (the plugins' `ctx.studio.shown()`). */
let shownArticle: ArticlePayload | null = null;

/** What the article is drawn with: its formulas' macros; the plugins' blocks are told it is the one shown (its files, its saved views). */
function useArticleContext(article: ArticlePayload): void {
	shownArticle = article;
	useMacros(macrosFor(article.macros));
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
	snapshot.changed();
	backlinks.changed();
	articleList.changedOnDisk(changes);
	refreshGit();
	const change = changes.find((entry) => entry.slug === session.slug);
	if (!change) return;
	void filePanel.refresh();
	// The AI at work, writing the article bit by bit: looked over once its turn is over, not at each bit.
	if (chat.hold(change)) return;
	session.changedOnDisk(change.paths);
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
		const apps = (await listMiniApps().catch(() => [])).filter((app) => !app.problem);
		const fromApps = apps.flatMap((app) => [
			{ key: `app:${app.id}`, label: t('打开小程序「{name}」', { name: app.name }), icon: app.icon, run: () => void miniApps.open(app.id) },
			...app.commands.map((command) => ({ key: `app:${app.id}:${command.id}`, label: `${app.name}：${command.title}`, icon: app.icon, run: () => void miniApps.open(app.id, command.entry) })),
		]);
		return [...plugin, ...fromApps, { key: 'studio:new-app', label: t('新建小程序…'), icon: '＋', run: () => miniApps.create() }];
	},
});

const drive = createDrive(studio);

// All the articles, as a table or a board (article-table.ts).
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
 * The article in the middle, the drive, the table of all articles or AI 问答 (the article stays open behind them); the
 * left column lists the conversations for AI 问答, the pages for the others.
 */
function showView(view: View, folder?: string): void {
	const again = shellState.get().view === view;
	shell.dataset.view = view;
	shellState.set({ view });
	drive.view.hidden = view !== 'drive';
	tableView.hidden = view !== 'table';
	appsView.hidden = view !== 'apps';
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
	else if (address.get('app')) void miniApps.open(address.get('app')!);
	else if (address.has('apps')) showView('apps');
	else if (chatId) chat.openChat(chatId);
}

bindPageKeys(session, { find: () => quickFind.open() });

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
	startFinished();
	void tellStarted().catch(() => {});
}, () => {});
