import { createArticle, getArticle, listArticles, saveArticle as saveArticleRequest, StudioApiError } from './api/client';
import { parseStudioDocument, replaceStudioDocumentBody } from './document';
import { MarkdownEditor } from './editor/markdown-editor';
import { VisualMarkdownEditor } from './editor/visual-markdown-editor';
import { analyzeVisualSafety } from './editor/visual-safety';
import { ArticleStore } from './state/article-store';
import type { ArticleFiles } from './types';

type EditorMode = 'visual' | 'source';

const articleList = document.querySelector<HTMLElement>('#article-list')!;
const bundleFiles = document.querySelector<HTMLElement>('#bundle-files')!;
const sourceEditorHost = document.querySelector<HTMLElement>('#source-editor')!;
const visualEditorHost = document.querySelector<HTMLElement>('#visual-editor')!;
const editorPath = document.querySelector<HTMLElement>('#editor-path')!;
const editorNotice = document.querySelector<HTMLElement>('#editor-notice')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-button')!;
const newArticleButton = document.querySelector<HTMLButtonElement>('#new-article')!;
const openArticle = document.querySelector<HTMLAnchorElement>('#open-article')!;
const visualModeButton = document.querySelector<HTMLButtonElement>('#mode-visual')!;
const sourceModeButton = document.querySelector<HTMLButtonElement>('#mode-source')!;

const store = new ArticleStore();
let mode: EditorMode = 'visual';

const sourceEditor = new MarkdownEditor({
	parent: sourceEditorHost,
	onChange: (source) => {
		if (mode !== 'source') return;
		updateSource(source);
		const safety = analyzeVisualSafety(source);
		showNotice(safety.safe ? '' : `${safety.reason}，请继续使用源码模式。`);
	},
	onSave: () => { void saveCurrentArticle(); },
});

const visualEditor = new VisualMarkdownEditor({
	parent: visualEditorHost,
	onChange: (body) => {
		if (mode !== 'visual' || !store.current.article) return;
		const source = replaceStudioDocumentBody(parseStudioDocument(store.current.source), body);
		updateSource(source);
	},
	onSave: () => { void saveCurrentArticle(); },
});

function updateSource(source: string): void {
	store.updateSource(source);
	setSaveState(store.current.dirty ? '未保存' : '已载入', store.current.dirty ? 'dirty' : 'saved');
}

function setSaveState(text: string, state = ''): void {
	saveStatus.textContent = text;
	saveStatus.dataset.state = state;
}

function showNotice(message: string): void {
	editorNotice.textContent = message;
	editorNotice.hidden = message.length === 0;
}

function renderFiles(files: ArticleFiles): void {
	const sections = [['img', files.img], ['assets', files.assets], ['ai', files.ai]] as const;
	bundleFiles.replaceChildren();
	for (const [name, entries] of sections) {
		const section = document.createElement('section');
		const heading = document.createElement('h2');
		heading.textContent = `${name}/`;
		section.append(heading);
		if (entries.length) {
			for (const file of entries) {
				const item = document.createElement('p');
				item.textContent = file;
				section.append(item);
			}
		} else {
			const empty = document.createElement('p');
			empty.className = 'muted';
			empty.textContent = '空';
			section.append(empty);
		}
		bundleFiles.append(section);
	}
}

function activateMode(nextMode: EditorMode, reason = ''): boolean {
	const snapshot = store.current;
	if (!snapshot.article) return false;

	if (nextMode === 'visual') {
		const safety = analyzeVisualSafety(snapshot.source);
		if (!safety.safe) {
			showNotice(`${safety.reason}，已保留全文并切换到源码模式。`);
			return activateMode('source');
		}
		visualEditor.setValue(parseStudioDocument(snapshot.source).body.raw, () => { void saveCurrentArticle(); });
		showNotice(reason);
	} else {
		sourceEditor.setValue(snapshot.source);
		if (reason) showNotice(reason);
	}

	mode = nextMode;
	visualEditorHost.hidden = mode !== 'visual';
	sourceEditorHost.hidden = mode !== 'source';
	visualEditor.setEnabled(mode === 'visual');
	sourceEditor.setEnabled(mode === 'source');
	visualModeButton.classList.toggle('active', mode === 'visual');
	sourceModeButton.classList.toggle('active', mode === 'source');
	visualModeButton.setAttribute('aria-pressed', String(mode === 'visual'));
	sourceModeButton.setAttribute('aria-pressed', String(mode === 'source'));
	return true;
}

async function loadArticle(slug: string): Promise<void> {
	if (store.current.dirty && !confirm('当前文章尚未保存，确定要切换吗？')) return;
	setSaveState('正在载入…');
	const article = await getArticle(slug);
	store.load(article);
	sourceEditor.setValue(article.source);
	editorPath.textContent = `blog/${article.slug}/index.md`;
	openArticle.href = `/blog/${article.slug}/`;
	saveButton.disabled = false;
	setSaveState('已载入', 'saved');
	renderFiles(article.files);
	showNotice('');
	activateMode('visual');
	for (const button of articleList.querySelectorAll('button')) {
		button.classList.toggle('active', button.dataset.slug === slug);
	}
}

async function loadArticleList(selectSlug?: string): Promise<void> {
	const articles = await listArticles();
	articleList.replaceChildren();
	for (const article of articles) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.slug = article.slug;
		button.innerHTML = '<strong></strong><span></span>';
		button.querySelector('strong')!.textContent = article.title;
		button.querySelector('span')!.textContent = article.slug;
		button.addEventListener('click', () => { void loadArticle(article.slug); });
		articleList.append(button);
	}
	const initial = selectSlug ?? articles[0]?.slug;
	if (initial) await loadArticle(initial);
	else setSaveState('还没有文章');
}

async function saveCurrentArticle(): Promise<void> {
	const snapshot = store.current;
	if (!snapshot.article || !snapshot.dirty) return;
	saveButton.disabled = true;
	setSaveState('正在保存…', 'saving');
	try {
		const result = await saveArticleRequest(snapshot.article.slug, snapshot.source, snapshot.revision);
		store.markSaved(result.revision);
		setSaveState('已保存', 'saved');
	} catch (error) {
		const message = error instanceof Error ? error.message : '保存失败';
		setSaveState(error instanceof StudioApiError && error.status === 409 ? `保存冲突：${message}` : message, 'error');
	} finally {
		saveButton.disabled = false;
	}
}

visualModeButton.addEventListener('click', () => { activateMode('visual'); });
sourceModeButton.addEventListener('click', () => { activateMode('source'); });
saveButton.addEventListener('click', () => { void saveCurrentArticle(); });
newArticleButton.addEventListener('click', async () => {
	const slug = prompt('文章 slug（小写字母、数字和连字符）');
	if (!slug) return;
	const title = prompt('文章标题');
	if (!title) return;
	try {
		await createArticle(slug, title);
		await loadArticleList(slug);
	} catch (error) {
		setSaveState(error instanceof Error ? error.message : '新建失败', 'error');
	}
});

window.addEventListener('beforeunload', (event) => {
	if (!store.current.dirty) return;
	event.preventDefault();
});

loadArticleList().catch((error) => {
	setSaveState(error instanceof Error ? error.message : '无法连接本地 Studio', 'error');
});
