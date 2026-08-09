import { createArticle, getArticle, listArticles, saveArticle as saveArticleRequest } from './api/client';
import { MarkdownEditor } from './editor/markdown-editor';
import { PreviewRenderer } from './preview/renderer';
import type { ArticleFiles, ArticlePayload } from './types';

const articleList = document.querySelector<HTMLElement>('#article-list')!;
const bundleFiles = document.querySelector<HTMLElement>('#bundle-files')!;
const editorHost = document.querySelector<HTMLElement>('#editor')!;
const previewElement = document.querySelector<HTMLElement>('#preview')!;
const editorPath = document.querySelector<HTMLElement>('#editor-path')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const previewStatus = document.querySelector<HTMLElement>('#preview-status')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-button')!;
const newArticleButton = document.querySelector<HTMLButtonElement>('#new-article')!;
const openArticle = document.querySelector<HTMLAnchorElement>('#open-article')!;

let current: ArticlePayload | null = null;
let dirty = false;

const preview = new PreviewRenderer(previewElement, previewStatus);
const editor = new MarkdownEditor({
	parent: editorHost,
	onChange: (content) => {
		dirty = true;
		setSaveState('未保存', 'dirty');
		if (current) preview.schedule(current.slug, content);
	},
	onSave: () => { void saveCurrentArticle(); },
});

function setSaveState(text: string, state = ''): void {
	saveStatus.textContent = text;
	saveStatus.dataset.state = state;
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

async function loadArticle(slug: string): Promise<void> {
	if (dirty && !confirm('当前文章尚未保存，确定要切换吗？')) return;
	setSaveState('正在载入…');
	current = await getArticle(slug);
	editor.setValue(current.content);
	editor.setEnabled(true);
	editorPath.textContent = `blog/${current.slug}/index.md`;
	openArticle.href = `/blog/${current.slug}/`;
	dirty = false;
	saveButton.disabled = false;
	setSaveState('已载入', 'saved');
	renderFiles(current.files);
	for (const button of articleList.querySelectorAll('button')) {
		button.classList.toggle('active', button.dataset.slug === slug);
	}
	await preview.render(current.slug, current.content);
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
	if (!current || !dirty) return;
	saveButton.disabled = true;
	setSaveState('正在保存…', 'saving');
	try {
		const content = editor.getValue();
		const result = await saveArticleRequest(current.slug, content, current.hash);
		current.hash = result.hash;
		current.content = content;
		dirty = false;
		setSaveState('已保存', 'saved');
	} catch (error) {
		setSaveState(error instanceof Error ? error.message : '保存失败', 'error');
	} finally {
		saveButton.disabled = false;
	}
}

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
	if (!dirty) return;
	event.preventDefault();
});

loadArticleList().catch((error) => {
	setSaveState(error instanceof Error ? error.message : '无法连接本地 Studio', 'error');
});
