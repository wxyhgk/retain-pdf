// The Studio page: its parts, and how they talk to each other. Each part
// keeps to its own corner of the page; the open article lives in the session.
import {
	articleFilesUrl,
	articleFileUrl,
	createArticle,
	getArticle,
	saveArticle,
	saveMoleculeView,
	StudioApiError,
	uploadArticleFile,
} from './api/client';
import { bindTitleFocus } from './editor/block-menu';
import { createStudioEditor } from './editor/studio-editor';
import { setMoleculeViewContext } from '../science/browser/molecule-renderer';
import { setScienceResourceBaseUrl } from '../science/browser/resource-context';
import { ArticleSession } from './state/article-session';
import type { ArticlePayload } from './types';
import { createArticleList } from './workspace/article-list';
import { watchDisk } from './workspace/disk-events';
import { createFilePanel } from './workspace/file-panel';
import { uploadFolderFor } from './workspace/file-tree';
import { createNewArticleDialog } from './workspace/new-article-dialog';
import { createPropertiesPanel } from './workspace/properties-panel';
import { createReviewBar } from './workspace/review-bar';
import { createSidePanel } from './workspace/side-panel';
import { createTerminalPane } from './workspace/terminal';
import { showToast } from './workspace/toast';
import { createTopBar } from './workspace/top-bar';

const shell = document.querySelector<HTMLElement>('.studio-shell')!;
const editorScroll = shell.querySelector<HTMLElement>('.editor-scroll')!;

const topBar = createTopBar(shell);
const articleList = createArticleList(shell.querySelector<HTMLElement>('.article-sidebar')!, {
	open: (slug) => { void session.open(slug); },
});
const properties = createPropertiesPanel(shell.querySelector<HTMLElement>('.document-header')!, {
	changed: (typed) => session.editProperties(typed),
	publish: () => { void session.flush(); },
	leaveTitle: () => editor.focusStart(),
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
	changed: (markdown) => session.editBody(markdown),
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
		confirm: (message) => window.confirm(message),
		toast: (message) => showToast(message),
		opened({ article, properties: shown }) {
			properties.show(shown);
			topBar.showArticle(article.slug, shown.title || article.slug);
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
		saved: (slug, saved) => articleList.saved(slug, saved),
	},
	testDelay ? { delay: testDelay, maxWait: testDelay } : {},
);
session.subscribe(() => filePanel.sourceChanged());

/** Where the article's chemistry finds its files and its saved molecule views. */
function useArticleContext(article: ArticlePayload): void {
	setScienceResourceBaseUrl(articleFilesUrl(article.slug));
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
	const change = changes.find((entry) => entry.slug === session.slug);
	if (!change) return;
	void filePanel.refresh();
	session.changedOnDisk(change.paths);
});

// Saving is automatic; ⌘S (or ⌘↩) saves at once.
document.addEventListener('keydown', (event) => {
	if (!(event.metaKey || event.ctrlKey) || event.altKey || (event.key !== 'Enter' && event.key.toLowerCase() !== 's')) return;
	event.preventDefault();
	void session.flush();
});
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden' && session.current.dirty) void session.flush();
});
window.addEventListener('beforeunload', (event) => {
	if (!session.current.dirty) return;
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

openFromList().catch((error) => {
	topBar.error(error instanceof Error ? error.message : '无法连接本地 Studio');
});
