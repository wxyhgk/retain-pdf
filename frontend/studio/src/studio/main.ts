// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
import {
	articleFileHead,
	articleFileUrl,
	checkArticle,
	codeFileFigure,
	createArticle,
	setArticleParent,
	type PagePlace,
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
	aiSettings,
	recognizeImage,
	putBelowImage,
	instruct,
	startOcr,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { createStudioEditor } from './editor/studio-editor';
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
import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { officeFilesChanged } from '@blog/office/card.ts';
import { firstSheetRows } from '@blog/office/render.ts';
import { openOfficeFile } from '@blog/office/viewer.ts';
import { createFilePanel } from './workspace/file-panel';
import { isImage, readMarkdownReference, setFileBlocks } from './article-files';
import { createDriveBrowser } from './workspace/drive-browser';
import { officeKind } from '@blog/office/kinds.mjs';
import { uploadFolderFor } from './workspace/file-tree';
import { autoSlug, freeSlug, isAutoSlug, readableSlug } from './workspace/page-names';
import { blockForFile, fileHeadWanted, pluginCommands, pluginRecognizers, setStudioPluginEnabled, startStudioPlugins, studioPluginInfo, studioPlugins } from './plugins';
import { Recognizers, type Recognizer } from '@blog/kernel/ui.ts';
import { createPluginsDialog } from './workspace/plugins-dialog';
import { aiReady, createAiSettingsDialog } from './workspace/ai-settings-dialog';
import { runCommand, showPluginUi } from './workspace/plugin-ui';
import { createOutline } from './workspace/outline';
import { keepFormulasFitted } from '@blog/science/browser/fit-formulas.ts';
import { createPageSnapshot } from './workspace/page-snapshot';
import { anchorScroll } from './workspace/scroll-anchor';
import { createBacklinks } from './workspace/backlinks';
import { createArticleTable } from './workspace/article-table';
import { createPageHeader } from './workspace/page-header';
import { createPublishCheck } from './workspace/publish-check';
import { createQuickFind } from './workspace/quick-find';
import { createReviewBar } from './workspace/review-bar';
import { createSidePanel } from './workspace/side-panel';
import { createAiPanel } from './workspace/ai-panel';
import { createTerminalPane } from './workspace/terminal';
import { createAgentsDialog } from './workspace/agents-dialog';
import { createTaskTray } from './workspace/task-tray';
import { createMiniApps } from './workspace/mini-apps';
import { showToast } from './workspace/toast';
import type { EditorView } from '@milkdown/prose/view';
import { createTopBar } from './workspace/top-bar';
import { createHistoryView } from './workspace/history-view';
import { createTrashView } from './workspace/trash-view';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;
const editorPanel = shell.querySelector<HTMLElement>('.editor-panel')!;
const outline = createOutline(editorScroll, shell.querySelector<HTMLElement>('#editor-outline')!);
// Display formulas wider than the page: in lines, or smaller, not scrolled (fit-formulas.ts).
keepFormulasFitted(editorScroll);
anchorScroll(editorScroll);

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
	rename: (article) => void articleActions.rename(article),
	duplicate: (article) => void articleActions.duplicate(article),
	remove: (article) => void articleActions.remove(article),
	commit: (article) => void articleActions.commit(article),
	createChild: (article) => void newPage(article.slug),
	merge: (article) => void articleActions.merge(article),
	// On disk, the open article too (saved first): what changes is its properties alone, which it takes in quietly.
	move: (slugs, parent, place) => void movePages(slugs, parent, place),
	moveTo: (slugs) => {
		void (async () => {
			const target = await quickFind.pickPlace(slugs);
			if (target !== null) await movePages(slugs, target);
		})();
	},
	removeMany: (articles) => void articleActions.removeMany(articles),
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
// The AI tab: a coding agent doing what it is asked, by itself, shown as it goes.
const aiPanel = createAiPanel(shell.querySelector<HTMLElement>('#side-ai')!, {
	article: () => (session.slug ? { slug: session.slug, title: openTitle } : null),
	articles: () => articleList.articles().map((entry) => ({ slug: entry.slug, title: entry.title || entry.slug })),
	hasSelection: () => Boolean(session.slug) && editor.hasSelection(),
	async selection() {
		const marked = session.slug && editor.hasSelection() ? editor.markSelection() : null;
		if (!marked || !(await session.flush())) return null;
		return sourceLinesOf(session.current.source, marked);
	},
	toast: (message) => showToast(message),
	runInTerminal(command) {
		sidePanel.show('terminal');
		terminal.run(command);
	},
});
const sidePanel = createSidePanel(shell, { shown: (tab) => tab === 'ai' && aiPanel.shown() });
const terminal = createTerminalPane(shell.querySelector<HTMLElement>('#side-terminal')!, { editAgents: () => void agentsDialog.open() });
const agentsDialog = createAgentsDialog(document.querySelector<HTMLDialogElement>('#agents-dialog')!, { saved: () => terminal.refreshAgents() });
// 小程序: the tools of apps/, in floating windows; what they may reach of the article shown.
createMiniApps(shell.querySelector<HTMLButtonElement>('#open-apps')!, shell.querySelector<HTMLElement>('#mini-app-layer')!, {
	article: () => (session.slug ? { slug: session.slug, title: openTitle, source: session.current.source } : null),
	insert: (markdown) => editor.insertMarkdown(markdown),
	toast: (message) => showToast(message),
	openPage: (slug) => void session.open(slug),
});
/** The blocks marked as an AI works on them (Alt+Enter), by the task it is: the mark's own name. */
const instructing = new Map<string, string>();
/** Tasks over before their mark was known (an AI quicker than the answer that started it). */
const overEarly = new Set<string>();
createTaskTray(shell.querySelector<HTMLElement>('#task-tray')!, {
	ended(task) {
		const mark = instructing.get(task.id);
		if (mark) {
			instructing.delete(task.id);
			editor.unmarkInstructing(mark);
		} else if (task.kind === 'instruction') overEarly.add(task.id);
		if (task.state === 'failed') showToast(`${task.title}：${task.error ?? '出错了'}`, true);
		// A PDF read: its page, to open.
		const page = task.kind === 'ocr' && task.state === 'done' ? (task.result as { page?: string } | null)?.page : undefined;
		if (page) {
			void articleList.load();
			showToast(`已识别成子页面「${task.title.replace(/^PaddleOCR：/u, '')}」`, { action: { label: '打开', run: () => void session.open(page) } });
		}
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
	ocr: (path) => void ocrPdf(path),
});

const editor = createStudioEditor(shell.querySelector<HTMLElement>('#crepe-editor')!, {
	// 转成子页面: a page under the open article, made with a section of it.
	subPage: {
		plan: () => (session.slug ? freeSlug(autoSlug(), articleList.articles().map((article) => article.slug)) : null),
		async make(slug, title, body, files) {
			const parent = session.slug;
			if (!parent) return false;
			try {
				await trackWrite(() => createArticle(slug, title, parent, { body, files }));
			} catch (error) {
				showToast(error instanceof Error ? error.message : '没能转成子页面', true);
				return false;
			}
			await articleList.load();
			showToast(`已转成子页面「${title}」`, { action: { label: '打开', run: () => void session.open(slug) } });
			return true;
		},
	},
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
		head: async (path) => (session.slug ? articleFileHead(session.slug, path) : null),
		report: showToast,
	},
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	codeFile: (reference, language, meta) => (session.slug ? codeFileFigure(session.slug, reference, language, meta) : Promise.reject(new Error('文章尚未载入'))),
	changed: (markdown) => session.editBody(markdown),
	async pickArticle() {
		const picked = await quickFind.pick();
		if (picked && 'create' in picked) return makeLinkedPage(picked.create);
		const article = articleList.articles().find((entry) => entry.slug === picked?.slug);
		return article ? { title: article.title, href: articleAddress(article.kind, article.slug) } : null;
	},
	openArticle: (slug) => void session.open(slug),
	// 页面 (/page): a page under the open one, linked where the caret is, and gone into.
	async makePage() {
		const parent = session.slug;
		if (!parent) return null;
		const slug = freeSlug(autoSlug(), articleList.articles().map((article) => article.slug));
		try {
			await trackWrite(() => createArticle(slug, '无标题', parent));
		} catch (error) {
			showToast(error instanceof Error ? error.message : '新建失败', true);
			return null;
		}
		return { slug, title: '无标题', href: `/blog/${slug}/` };
	},
	enterPage: (slug) => void enterNewPage(slug),
	askAI: () => void askAI(),
	instruct: (fresh) => void instructHere(fresh),
	ocrPdf: (view, pos, path) => void ocrPdf(path, view, pos),
	recognize: (view, pos) => void recognizePicture(view, pos),
	pickCitation: () => citePicker.pick(),
	articleTitle: (slug) => articleList.articles().find((entry) => entry.slug === slug)?.title ?? null,
	reviewing: (pending) => reviewBar.show(pending),
	shown: () => articleShown(),
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
			// Another article: from its top (the editor is kept from one to the next, and with it where it was scrolled to).
			if (!again) editorScroll.scrollTop = 0;
			// Shown again (changed on disk): all at once, to be where it was.
			const markdown = await editor.mount(body, again);
			if (again) editorScroll.scrollTop = scrollTop;
			// The files it names, once it is shown (a book's take a while to read).
			filePanel.sourceChanged();
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
			aiPanel.showArticle({ slug: article.slug, title: openTitle });
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
// Not while an article is being shown: its files are read once it is (a book's take a while).
session.subscribe(() => saveState !== 'loading' && filePanel.sourceChanged());

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

/** The article the editor shows, or is about to (the plugins' `ctx.studio.shown()`). */
let shownArticle: ArticlePayload | null = null;

/** What the article is drawn with: its formulas' macros; the plugins' blocks are told it is the one shown (its files, its saved views). */
function useArticleContext(article: ArticlePayload): void {
	shownArticle = article;
	useMacros(macrosFor(article.macros));
	// Before its blocks are drawn: what they draw with is this article's.
	studioPlugins.emit('studio/article-showing', article.slug);
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
	await enterNewPage(slug);
}

/** Opens a page just made, its title selected to be typed over; what is open saved first. */
async function enterNewPage(slug: string): Promise<void> {
	if (!(await session.saveBeforeLeaving())) return;
	await openFromList(slug, true);
	if (session.slug === slug) properties.selectTitle();
}
for (const opener of shell.querySelectorAll<HTMLElement>('#new-article, #new-article-secondary')) {
	opener.addEventListener('click', () => void newPage());
}

/**
 * 新建子页面 from `[[`: a page of this title under the open one, linked
 * where the `[[` was; the author writes on where they were (as SiYuan's
 * reference picker makes a document), and opens it from the toast.
 */
async function makeLinkedPage(title: string): Promise<{ title: string; href: string } | null> {
	const parent = session.slug;
	if (!parent) return null;
	const slug = freeSlug(autoSlug(), articleList.articles().map((article) => article.slug));
	try {
		await trackWrite(() => createArticle(slug, title, parent));
	} catch (error) {
		showToast(error instanceof Error ? error.message : '新建失败', true);
		return null;
	}
	await articleList.load();
	showToast(`已新建子页面「${title}」`, { action: { label: '打开', run: () => void session.open(slug) } });
	return { title, href: `/blog/${slug}/` };
}

/**
 * Pages (in this order) under `parent`, or at the top with it empty; with
 * `place`, just before or after that page, one after the other. On disk, the
 * open one too (saved first): only its properties change, which it takes in
 * quietly.
 */
async function movePages(slugs: string[], parent: string, place: PagePlace = {}): Promise<void> {
	if (slugs.includes(session.slug ?? '') && !(await session.flush())) return;
	let previous: string | null = null;
	try {
		for (const slug of slugs) {
			const here: PagePlace = previous ? { after: previous } : place;
			await trackWrite(() => setArticleParent(slug, parent, here));
			// The next one after this, where it is (with no place given, each goes after those there).
			if (previous || place.before || place.after) previous = slug;
		}
	} catch (error) {
		showToast(error instanceof Error ? error.message : '没能移动这个页面', true);
	}
	await articleList.load();
	if (slugs.length > 1) showToast(`已移动 ${slugs.length} 个页面`);
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
	properties.showPath(pages, (slug) => void session.open(slug), (slug) => articleList.childrenOf(slug));
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

/**
 * OCR 成子页面: a PDF of the open article (`path` in it) read by PaddleOCR into a page under it (server/pdf-ocr.mjs),
 * made at once and filled in as a task; from the line linking to the PDF (`view`, `pos`), the page linked on a line under it.
 */
async function ocrPdf(path: string, view?: EditorView, pos?: number): Promise<void> {
	const slug = session.slug;
	if (!slug) return;
	try {
		const { page } = await startOcr(slug, path);
		void articleList.load();
		showToast(`正在用 PaddleOCR 识别 ${path}，结果写进子页面「${page.title}」`);
		const at = view && pos !== undefined && !view.isDestroyed ? view.state.doc.nodeAt(pos) : null;
		const link = view?.state.schema.marks.link;
		// Still the line linking to the PDF: the page under it.
		if (view && at?.textContent && at.isTextblock && link) {
			const line = view.state.schema.nodes.paragraph!.create(null, view.state.schema.text(page.title, [link.create({ href: page.href, title: null })]));
			view.dispatch(view.state.tr.insert(pos! + at.nodeSize, line));
		}
	} catch (error) {
		showToast(error instanceof Error ? error.message : '没能开始识别', true);
	}
}

/** The heading the line `line` (from 1) of `source` is under, skipping what is in code fences; empty for none. */
function headingAbove(source: string, line: number): string {
	let heading = '';
	let fence: string | null = null;
	for (const text of source.split('\n').slice(0, line - 1)) {
		const opening = /^\s{0,3}(`{3,}|~{3,})/u.exec(text)?.[1];
		if (fence) {
			if (opening && opening[0] === fence[0] && opening.length >= fence.length) fence = null;
		} else if (opening) fence = opening;
		else heading = /^#{1,6}\s+(.*?)\s*#*\s*$/u.exec(text)?.[1] ?? heading;
	}
	return heading;
}

let instructions = 0;
/**
 * Alt+Enter: what the blocks the caret is in say is done by the AI of AI 助手, by itself, in the article's folder
 * (server/instructions.mjs); ⇧ as well, in a new talk. The blocks are marked till it is over; what it changes in the
 * file comes back as a change on disk, to accept or reject where it is.
 */
async function instructHere(fresh: boolean): Promise<void> {
	const slug = session.slug;
	const marked = slug ? editor.markSelection() : null;
	if (!slug || !marked) return;
	// Marked at once, where the caret is now, whatever it does meanwhile.
	const mark = `instruction-${++instructions}`;
	editor.markInstructing(mark);
	try {
		if (!(await session.flush())) throw new Error('文章还没保存好，保存后再交给 AI');
		const lines = sourceLinesOf(session.current.source, marked);
		if (!lines?.text.trim()) throw new Error('这一行是空的，没有要交给 AI 的事');
		const id = await instruct(slug, { text: lines.text, start: lines.start, end: lines.end, heading: headingAbove(session.current.source, lines.start) }, fresh);
		if (overEarly.delete(id)) editor.unmarkInstructing(mark);
		else instructing.set(id, mark);
	} catch (error) {
		editor.unmarkInstructing(mark);
		showToast(error instanceof Error ? error.message : '没能交给 AI', true);
	}
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
		upload: (slug, folder, file, options) => uploadArticleFile(slug, folder, file, options),
		toast: (message, error = false) => showToast(message, error),
		showPanel: (key) => sidePanel.show(key),
		shown: () => shownArticle?.slug ?? null,
		views: {
			get: () => shownArticle?.chemistryViews ?? {},
			save: (key, entry) => {
				const { format, view, display } = entry as { format: string; view: number[]; display?: unknown };
				return session.saveView(key, format, view, display);
			},
		},
		api: pluginApi,
	}, off, present))
	.then((problems) => {
		// Their tabs in the right column, their commands in the left one and on their keys.
		showPluginUi({ setPanels: (panels) => sidePanel.setPanels(panels), sidebar: shell.querySelector<HTMLElement>('#plugin-commands')! });
		if (problems.length) showToast(problems.join('；'), true);
	});
// A file of the article a plugin's block shows (a structure file) is put in as that block, and marked in the file list.
setFileBlocks(blockForFile, fileHeadWanted);
const pluginsDialog = createPluginsDialog(document.querySelector<HTMLDialogElement>('#plugins-dialog')!, { info: studioPluginInfo, setEnabled: setStudioPluginEnabled });
shell.querySelector('#open-plugins')!.addEventListener('click', () => void pluginsDialog.open());
const aiDialog = createAiSettingsDialog(document.querySelector<HTMLDialogElement>('#ai-settings-dialog')!);
shell.querySelector('#open-ai-settings')!.addEventListener('click', () => void aiDialog.open());

/**
 * 识别…: the picture at `pos` read by the large model of AI 设置, as what the author picks
 * (`ctx.recognizers`: a formula, text, a table…). What is read is put under the picture on disk,
 * the article saved first: it comes back as a change to accept or not, the text before it in history.
 */
function recognizePicture(view: EditorView, pos: number): void {
	const slug = session.slug;
	const src = String(view.state.doc.nodeAt(pos)?.attrs.src ?? '');
	if (!slug || !src) return;
	const kinds = pluginRecognizers()?.list() ?? [];
	if (!kinds.length) {
		showToast('没有可用的识别：插件「recognize」关掉了？', true);
		return;
	}
	const anchor = view.nodeDOM(pos);
	showContextMenu(
		kinds.map((kind) => ({ label: kind.label, action: () => void readPicture(slug, src, kind) })),
		anchor instanceof HTMLElement ? anchor : { x: innerWidth / 2, y: innerHeight / 3 },
	);
}

async function readPicture(slug: string, src: string, kind: Recognizer): Promise<void> {
	let settings = await aiSettings().catch(() => null);
	if (!settings || !aiReady(settings)) settings = await aiDialog.open('识别图片要用大模型：先选好服务、模型，填上 key。');
	if (!settings || !aiReady(settings)) return;
	await session.flush();
	showToast(`正在识别（${kind.label}）…`);
	try {
		const answer = await recognizeImage(slug, src, kind.prompt);
		if (!answer.trim()) {
			showToast('图里没读出这一类内容', true);
			return;
		}
		await putBelowImage(slug, src, Recognizers.markdown(kind, answer));
		showToast('识别好了，放在图下面：接受或拒绝');
	} catch (error) {
		showToast(`没能识别：${error instanceof Error ? error.message : String(error)}`, true);
	}
}
// A plugin edited (by hand or by an AI in the terminal) is put in again at once: said here; the article drawn again if its blocks changed.
studioPlugins.on('studio/plugins-reloaded', (changed, problems) => {
	showToast(problems.length ? problems.join('；') : `已重新载入插件：${changed.join('、')}`, problems.length > 0);
});
studioPlugins.on('studio/editor-changed', () => void session.remount());

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
		const reference = await readMarkdownReference(await copyFromDrive(path), async (copied) => (session.slug ? articleFileHead(session.slug, copied) : null));
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
// ⌫ that nothing took (a structure editor with nothing left to delete) is "back" to WebKit, the Mac
// app's browser: the Studio would leave for the app's start page. Where it isn't typed into, it does nothing.
window.addEventListener('keydown', (event) => {
	if (event.key !== 'Backspace' || event.defaultPrevented) return;
	const target = event.target instanceof Element ? event.target : null;
	if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
	event.preventDefault();
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

const opening = openFromList().then(
	() => {
		articleActions.offerPendingUndo();
		refreshGit();
	},
	(error) => topBar.error(error instanceof Error ? error.message : '无法连接本地 Studio'),
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
