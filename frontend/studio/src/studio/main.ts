// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
import {
	articleFilesUrl,
	articleFileUrl,
	checkArticle,
	codeFileFigure,
	createArticle,
	getArticle,
	gitStatus,
	listArticleFiles,
	revealArticleFile,
	saveArticle,
	saveMoleculeView,
	StudioApiError,
	uploadArticleFile,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { createStudioEditor } from './editor/studio-editor';
import { setMoleculeViewContext } from '../science/browser/molecule-renderer';
import { setScienceResourceBaseUrl } from '../science/browser/resource-context';
import { useArticleMacros } from '../science/rendering/math';
import { ArticleSession } from './state/article-session';
import type { ArticlePayload, ArticleSummary } from './types';
import { createArticleActions } from './workspace/article-actions';
import { createArticleList } from './workspace/article-list';
import { showContextMenu } from './workspace/context-menu';
import { watchDisk } from './workspace/disk-events';
import { createFilePanel } from './workspace/file-panel';
import { isImage, uploadFolderFor } from './workspace/file-tree';
import { createNewArticleDialog } from './workspace/new-article-dialog';
import { createOutline } from './workspace/outline';
import { createPageHeader } from './workspace/page-header';
import { createPublishCheck } from './workspace/publish-check';
import { createQuickFind } from './workspace/quick-find';
import { createReviewBar } from './workspace/review-bar';
import { createSidePanel } from './workspace/side-panel';
import { createTerminalPane } from './workspace/terminal';
import { showToast } from './workspace/toast';
import { createTopBar } from './workspace/top-bar';
import { createTrashView } from './workspace/trash-view';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;
const editorPanel = shell.querySelector<HTMLElement>('.editor-panel')!;
createOutline(editorScroll, shell.querySelector<HTMLElement>('#editor-outline')!);

const topBar = createTopBar(shell);
const articleActions = createArticleActions({
	openSlug: () => session.slug,
	leave: () => session.saveBeforeLeaving(),
	open: (slug) => session.open(slug, { discard: true }),
	reload: () => articleList.load(),
	refreshGit: () => refreshGit(),
});
const articleList = createArticleList(shell.querySelector<HTMLElement>('.article-sidebar')!, {
	open: (slug) => { void session.open(slug); },
	rename: (article) => void articleActions.rename(article),
	duplicate: (article) => void articleActions.duplicate(article),
	remove: (article) => void articleActions.remove(article),
	commit: (article) => void articleActions.commit(article),
	listed: (articles) => properties.knowTags(articles.flatMap((article) => article.tags ?? [])),
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
	publish: () => { void session.flush(); },
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
createSidePanel(shell);
const terminal = createTerminalPane(shell.querySelector<HTMLElement>('#side-terminal')!);
const filePanel = createFilePanel(shell.querySelector<HTMLElement>('#side-files')!, {
	source: () => session.current.source,
	revision: () => session.current.revision,
	settle: () => session.flush(),
	moved: (from, to, rewritten) => session.fileMoved(from, to, rewritten),
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
		report: showToast,
	},
	fileUrl: (src) => (session.slug ? articleFileUrl(session.slug, src) : src),
	codeFile: (reference, language, meta) => (session.slug ? codeFileFigure(session.slug, reference, language, meta) : Promise.reject(new Error('文章尚未载入'))),
	changed: (markdown) => session.editBody(markdown),
	async pickArticle() {
		const slug = await quickFind.pick();
		const article = articleList.articles().find((entry) => entry.slug === slug);
		return article ? { title: article.title, href: `/${article.kind === 'wiki' ? 'wiki' : 'blog'}/${article.slug}/` } : null;
	},
	openArticle: (slug) => void session.open(slug),
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
	},
	{
		async mount(article, body, again) {
			useArticleContext(article);
			const scrollTop = editorScroll.scrollTop;
			const markdown = await editor.mount(body);
			if (again) editorScroll.scrollTop = scrollTop;
			return markdown;
		},
		review(article, body) {
			useArticleContext(article);
			return editor.review(body);
		},
		settle: () => editor.settle(),
		confirm: (message) => window.confirm(message),
		toast: (message) => showToast(message),
		opened({ article, properties: shown }) {
			properties.show(shown, article.problems ?? []);
			topBar.showArticle(article.slug, shown.title || article.slug, shown.kind);
			topBar.edited(article.modified ?? null);
			editorPanel.classList.toggle('is-wide', Boolean(shown.wide));
			articleList.select(article.slug);
			filePanel.show(article.slug);
			terminal.showArticle(article.slug);
			const url = new URL(window.location.href);
			url.searchParams.set('article', article.slug);
			history.replaceState(null, '', url);
		},
		saveState: (state) => topBar.saveState(state),
		roundtrip: (exact) => topBar.roundtrip(exact),
		retitled: (title) => topBar.showTitle(title),
		saved(slug, saved, problems) {
			articleList.saved(slug, saved);
			topBar.edited(Date.now());
			properties.showProblems(problems);
		},
	},
	testDelay ? { delay: testDelay, maxWait: testDelay } : {},
);
session.subscribe(() => filePanel.sourceChanged());

/** Where the article's chemistry finds its files and its saved molecule views. */
function useArticleContext(article: ArticlePayload): void {
	setScienceResourceBaseUrl(articleFilesUrl(article.slug));
	useArticleMacros(article.macros);
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

createNewArticleDialog([...shell.querySelectorAll<HTMLElement>('#new-article, #new-article-secondary')], {
	leave: () => session.saveBeforeLeaving(),
	create: async (slug, title) => { await createArticle(slug, title); },
	open: (slug) => openFromList(slug, true),
});

// Something changed in blog/: the terminal, Finder or another editor.
watchDisk((changes) => {
	articleList.changedOnDisk(changes);
	refreshGit();
	const change = changes.find((entry) => entry.slug === session.slug);
	if (!change) return;
	void filePanel.refresh();
	session.changedOnDisk(change.paths);
});

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

const quickFind = createQuickFind(document.querySelector<HTMLDialogElement>('#quick-find-dialog')!, {
	articles: () => articleList.articles(),
	async open(slug, text) {
		await session.open(slug);
		if (text && session.slug === slug) requestAnimationFrame(() => showFound(text));
	},
});
shell.querySelector('#open-search')!.addEventListener('click', () => quickFind.open());

const trashView = createTrashView(document.querySelector<HTMLDialogElement>('#trash-dialog')!, {
	articleRestored(slug) {
		void articleList.load().then(() => session.open(slug));
	},
	fileRestored(slug) {
		if (slug === session.slug) void filePanel.refresh();
	},
});
shell.querySelector('#open-trash')!.addEventListener('click', () => void trashView.open());

/** The open article, as the list knows it, for the actions on a whole article. */
function openSummary(): ArticleSummary | null {
	return articleList.articles().find((article) => article.slug === session.slug) ?? null;
}

// ⋯: what can be done to the page, as in Notion's page menu.
const pageMenu = shell.querySelector<HTMLButtonElement>('#page-menu')!;
pageMenu.addEventListener('click', () => {
	const article = openSummary();
	if (!article) return;
	const address = `/${article.kind === 'wiki' ? 'wiki' : 'blog'}/${article.slug}/`;
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

// Saving is automatic; ⌘S (or ⌘↩) saves at once.
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
);
