import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/prose/state';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import { createArticle, getArticle, listArticles, saveArticle, saveMoleculeView, StudioApiError } from './api/client';
import { bindTitleFocus, blockFeelPlugins } from './editor/block-menu';
import { buildScienceSlashMenu, scienceBlockPlugins } from './editor/crepe-science-block';
import { displayMathPlugins } from './editor/display-math';
import { inlineMathPlugins } from './editor/inline-math';
import { imageMarkdownRemark } from './editor/image-markdown';
import { mathBracketsRemark } from './editor/math-brackets';
import { mergeMarkdownBody, parseStudioDocument, replaceStudioDocumentBody, updateStudioFrontmatter } from './document';
import '../science/browser/molecule-renderer.css';
import { setMoleculeViewContext } from '../science/browser/molecule-renderer';
import { createSciencePreview, observeSciencePreviews } from '../science/browser/science-renderer';
import { setScienceResourceBaseUrl } from '../science/browser/resource-context';
import { ArticleStore } from './state/article-store';
import { articlePath, rewriteMovedReferences } from './shared/article-references.mjs';
import type { ArticlePayload, ArticleProperties, ArticleSummary } from './types';
import { createFilePanel } from './workspace/file-panel';
import { createSidePanel } from './workspace/side-panel';

const studioShell = document.querySelector<HTMLElement>('.studio-shell')!;
const articleList = document.querySelector<HTMLElement>('#article-list')!;
const articleSearch = document.querySelector<HTMLInputElement>('#article-search')!;
const editorHost = document.querySelector<HTMLElement>('#crepe-editor')!;
const editorScroll = document.querySelector<HTMLElement>('.editor-scroll')!;
const editorPath = document.querySelector<HTMLElement>('#editor-path')!;
const breadcrumbTitle = document.querySelector<HTMLElement>('#breadcrumb-title')!;
const roundtripStatus = document.querySelector<HTMLElement>('#roundtrip-status')!;
const articleTitleInput = document.querySelector<HTMLInputElement>('#article-title-input')!;
const articleDescriptionInput = document.querySelector<HTMLTextAreaElement>('#article-description')!;
const articleTagsInput = document.querySelector<HTMLInputElement>('#article-tags')!;
const articlePubDateInput = document.querySelector<HTMLInputElement>('#article-pub-date')!;
const articleDraftInput = document.querySelector<HTMLInputElement>('#article-draft')!;
const articlePropertiesPanel = document.querySelector<HTMLElement>('#article-properties')!;
const togglePropertiesButton = document.querySelector<HTMLButtonElement>('#toggle-properties')!;
const propertySummary = document.querySelector<HTMLElement>('#property-summary')!;
const propertyError = document.querySelector<HTMLElement>('#property-error')!;
const publishArticleButton = document.querySelector<HTMLButtonElement>('#publish-article')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-button')!;
const openArticle = document.querySelector<HTMLAnchorElement>('#open-article')!;
const newArticleButtons = [
	document.querySelector<HTMLButtonElement>('#new-article')!,
	document.querySelector<HTMLButtonElement>('#new-article-secondary')!,
];
const toggleSidebarButton = document.querySelector<HTMLButtonElement>('#toggle-sidebar')!;
const newArticleDialog = document.querySelector<HTMLDialogElement>('#new-article-dialog')!;
const newArticleForm = document.querySelector<HTMLFormElement>('#new-article-form')!;
const newArticleTitle = document.querySelector<HTMLInputElement>('#new-article-title')!;
const newArticleSlug = document.querySelector<HTMLInputElement>('#new-article-slug')!;
const newArticleError = document.querySelector<HTMLElement>('#new-article-error')!;
const createArticleButton = document.querySelector<HTMLButtonElement>('#create-article')!;
const cancelNewArticleButtons = [
	document.querySelector<HTMLButtonElement>('#cancel-new-article')!,
	document.querySelector<HTMLButtonElement>('#cancel-new-article-secondary')!,
];

const store = new ArticleStore();
const sidePanel = createSidePanel(studioShell);
const filePanel = createFilePanel(document.querySelector<HTMLElement>('#side-files')!, {
	source: () => store.current.source,
	revision: () => store.current.revision,
	moved: reloadAfterMove,
});
store.subscribe(() => filePanel.sourceChanged());
let crepe: Crepe | null = null;
let loading = false;
let loadSequence = 0;
let articleSummaries: ArticleSummary[] = [];
let slugWasEdited = false;
observeSciencePreviews(editorHost);

function setSaveState(text: string, state = ''): void {
	saveStatus.textContent = text;
	saveStatus.dataset.state = state;
}

function compareRoundtrip(original: string, current: string): void {
	const exact = original === current;
	roundtripStatus.textContent = exact ? 'Markdown 完整保留' : 'Markdown 已规范化';
	roundtripStatus.dataset.state = exact ? 'exact' : 'changed';
}

function propertiesFromInputs(): ArticleProperties {
	return {
		title: articleTitleInput.value.trim(),
		description: articleDescriptionInput.value.trim(),
		pubDate: articlePubDateInput.value,
		tags: articleTagsInput.value.split(/[,，]/u).map((tag) => tag.trim()).filter(Boolean),
		draft: articleDraftInput.checked,
	};
}

function setPropertyError(message: string): void {
	propertyError.textContent = message;
	propertyError.hidden = message.length === 0;
}

function updatePropertySummary(properties: ArticleProperties): void {
	const tags = properties.tags.length ? properties.tags.join(' · ') : '无标签';
	propertySummary.textContent = `${properties.pubDate || '未设置日期'} · ${tags}`;
	publishArticleButton.textContent = properties.draft ? '发布' : '撤回';
	publishArticleButton.dataset.published = String(!properties.draft);
}

function renderProperties(properties: ArticleProperties): void {
	articleTitleInput.value = properties.title;
	articleDescriptionInput.value = properties.description;
	articleTagsInput.value = properties.tags.join(', ');
	articlePubDateInput.value = properties.pubDate;
	articleDraftInput.checked = properties.draft;
	for (const input of [articleTitleInput, articleDescriptionInput, articleTagsInput, articlePubDateInput, articleDraftInput]) {
		input.disabled = false;
	}
	publishArticleButton.disabled = false;
	setPropertyError('');
	updatePropertySummary(properties);
}

function updatePropertiesFromInputs(): ArticleProperties | null {
	if (!store.current.article) return null;
	const properties = propertiesFromInputs();
	try {
		const source = updateStudioFrontmatter(store.current.source, properties);
		store.updateSource(source);
		breadcrumbTitle.textContent = properties.title || store.current.article.slug;
		updatePropertySummary(properties);
		setPropertyError('');
		setSaveState(store.current.dirty ? '未保存' : '已载入', store.current.dirty ? 'dirty' : 'saved');
		return properties;
	} catch (error) {
		setPropertyError(error instanceof Error ? error.message : '文章属性无效');
		return null;
	}
}

function updateArticleSummary(properties: ArticleProperties): void {
	const summary = articleSummaries.find((article) => article.slug === store.current.article?.slug);
	if (!summary) return;
	summary.title = properties.title;
	summary.draft = properties.draft;
	renderArticleTree();
}

function updateMarkdown(markdown: string): void {
	if (loading || !store.current.article) return;
	const original = parseStudioDocument(store.current.article.source);
	const current = parseStudioDocument(store.current.source);
	const merged = mergeMarkdownBody(original.body.raw, markdown);
	const source = replaceStudioDocumentBody(current, merged.body);
	store.updateSource(source);
	compareRoundtrip(store.current.article.source, source);
	setSaveState(store.current.dirty ? '未保存' : '已载入', store.current.dirty ? 'dirty' : 'saved');
}

/** Where the editor loads an image the article writes as `./img/a.png` from. */
function articleFileUrl(src: string): string {
	const slug = store.current.article?.slug;
	const path = articlePath(src);
	const [root, ...rest] = path?.split('/') ?? [];
	if (!slug || !path || (root !== 'img' && root !== 'assets') || !rest.length) return src;
	return `/api/studio/articles/${encodeURIComponent(slug)}/files/${root}/${rest.map(encodeURIComponent).join('/')}`;
}

async function mountEditor(source: string): Promise<string> {
	loading = true;
	if (crepe) await crepe.destroy();
	editorHost.replaceChildren();

	const body = parseStudioDocument(source).body.raw;
	crepe = new Crepe({
		root: editorHost,
		defaultValue: body,
		features: {
			[CrepeFeature.TopBar]: false,
			[CrepeFeature.AI]: false,
		},
		featureConfigs: {
			[CrepeFeature.CodeMirror]: {
				languages: [...codeMirrorLanguages],
				copyText: '复制',
				previewLabel: '预览',
				previewLoading: '正在渲染…',
				previewOnlyByDefault: true,
				previewToggleText: (previewOnly: boolean) => (previewOnly ? '编辑' : '收起'),
				searchPlaceholder: '搜索语言',
				noResultText: '没有匹配的语言',
				renderPreview: (language, content) => createSciencePreview(language, content),
			},
			[CrepeFeature.Placeholder]: {
				text: "输入 '/' 插入块",
				mode: 'block',
			},
			[CrepeFeature.Latex]: {
				katexOptions: { throwOnError: false },
				inlineEditConfirm: '完成',
			},
			[CrepeFeature.Toolbar]: {
				boldLabel: '粗体',
				italicLabel: '斜体',
				strikethroughLabel: '删除线',
				codeLabel: '行内代码',
				linkLabel: '链接',
				latexLabel: '公式',
			},
			[CrepeFeature.LinkTooltip]: {
				inputPlaceholder: '粘贴链接…',
			},
			[CrepeFeature.ImageBlock]: {
				proxyDomURL: articleFileUrl,
				inlineUploadButton: '上传',
				inlineUploadPlaceholderText: '或粘贴链接',
				blockUploadButton: '上传图片',
				blockCaptionPlaceholderText: '添加说明',
				blockUploadPlaceholderText: '或粘贴图片链接',
				blockConfirmButton: '确定',
			},
			[CrepeFeature.BlockEdit]: {
				buildMenu: (builder) => buildScienceSlashMenu(builder),
				textGroup: {
					label: '文本',
					text: { label: '正文' },
					h1: { label: '标题 1' },
					h2: { label: '标题 2' },
					h3: { label: '标题 3' },
					h4: null,
					h5: null,
					h6: null,
					quote: { label: '引用' },
					divider: { label: '分割线' },
				},
				listGroup: {
					label: '列表',
					bulletList: { label: '无序列表' },
					orderedList: { label: '有序列表' },
					taskList: { label: '待办' },
				},
				advancedGroup: {
					label: '插入',
					image: { label: '图片' },
					codeBlock: { label: '代码' },
					table: { label: '表格' },
					math: { label: '公式' },
				},
			},
		},
	});
	crepe.editor.use(scienceBlockPlugins);
	crepe.editor.use(blockFeelPlugins);
	crepe.editor.use(inlineMathPlugins);
	crepe.editor.use(displayMathPlugins);
	crepe.editor.use(mathBracketsRemark);
	crepe.editor.use(imageMarkdownRemark);
	crepe.on((listener) => {
		listener.markdownUpdated((_ctx, markdown) => updateMarkdown(markdown));
	});
	await crepe.create();
	const markdown = crepe.getMarkdown();
	loading = false;
	const original = parseStudioDocument(source);
	return replaceStudioDocumentBody(original, mergeMarkdownBody(original.body.raw, markdown).body);
}

function renderArticleTree(): void {
	const selected = store.current.article;
	const query = articleSearch.value.trim().toLocaleLowerCase('zh-CN');
	const visibleArticles = query
		? articleSummaries.filter((article) => `${article.title}\n${article.slug}`.toLocaleLowerCase('zh-CN').includes(query))
		: articleSummaries;
	articleList.replaceChildren();
	if (!visibleArticles.length) {
		const empty = document.createElement('p');
		empty.className = 'article-list-empty';
		empty.textContent = articleSummaries.length ? '没有匹配的文章。' : '还没有文章。点击 ＋ 创建第一篇笔记。';
		articleList.append(empty);
		return;
	}

	const pages = document.createElement('div');
	pages.className = 'page-list';
	for (const article of visibleArticles) {
		const active = selected?.slug === article.slug;
		const open = document.createElement('button');
		open.type = 'button';
		open.className = `page-row${active ? ' active' : ''}`;
		open.setAttribute('aria-current', active ? 'page' : 'false');
		const icon = document.createElement('span');
		icon.className = 'page-icon';
		icon.textContent = '▤';
		const title = document.createElement('span');
		title.className = 'page-title';
		title.textContent = article.title;
		open.append(icon, title);
		if (article.draft !== false) {
			const draft = document.createElement('span');
			draft.className = 'page-draft';
			draft.textContent = '草稿';
			draft.title = '尚未发布';
			open.append(draft);
		}
		open.addEventListener('click', () => { void loadArticle(article.slug); });
		pages.append(open);
	}
	articleList.append(pages);
}

async function loadArticle(slug: string, discardDirty = false): Promise<void> {
	if (store.current.article?.slug === slug) return;
	if (store.current.dirty && !discardDirty && !confirm('当前文章尚未保存，确定要切换吗？')) return;
	const sequence = ++loadSequence;
	setSaveState('正在载入…');
	const article = await getArticle(slug);
	if (sequence !== loadSequence) return;
	await presentArticle(article, sequence);
}

/**
 * Puts a loaded article in the editor. `edited` is unsaved text to keep
 * instead of what is on disk, with the properties typed for it.
 */
async function presentArticle(
	article: ArticlePayload,
	sequence: number,
	edited?: { source: string; properties: ArticleProperties },
): Promise<void> {
	const source = edited?.source ?? article.source;
	store.load(article);
	store.updateSource(source);
	renderProperties(edited?.properties ?? article.properties);
	setScienceResourceBaseUrl(`/api/studio/articles/${encodeURIComponent(article.slug)}/files`);
	setMoleculeViewContext({
		views: article.chemistryViews,
		save: async (key, format, view, display) => {
			const snapshot = store.current;
			if (!snapshot.article) throw new Error('文章尚未载入');
			const result = await saveMoleculeView(snapshot.article.slug, key, format, view, snapshot.revision, display);
			store.updateRevision(result.revision, result.chemistryViews);
		},
	});
	const normalizedSource = await mountEditor(source);
	if (sequence !== loadSequence) return;
	const summary = articleSummaries.find((entry) => entry.slug === article.slug);
	editorPath.textContent = `blog/${article.slug}/index.md`;
	sidePanel.showArticle(article.slug);
	filePanel.show(article.slug);
	breadcrumbTitle.textContent = edited?.properties.title || summary?.title || article.slug;
	openArticle.href = `/blog/${article.slug}/`;
	saveButton.disabled = false;
	compareRoundtrip(source, normalizedSource);
	setSaveState(store.current.dirty ? '未保存' : '已载入', store.current.dirty ? 'dirty' : 'saved');
	renderArticleTree();
	const url = new URL(window.location.href);
	url.searchParams.set('article', article.slug);
	history.replaceState(null, '', url);
}

/**
 * A file the article uses was renamed or moved. When the server rewrote
 * `index.md` to follow it, or unsaved text names it, the editor shows the
 * article again: what was saved as it now is on disk, and unsaved edits kept
 * as edits, their references pointed at the new name the same way.
 */
async function reloadAfterMove(from: string, to: string, rewritten: boolean): Promise<void> {
	const current = store.current;
	if (!current.article) return;
	const edited = rewriteMovedReferences(current.source, from, to);
	if (!rewritten && edited.changed === 0) return;
	const properties = propertiesFromInputs();
	const scrollTop = editorScroll.scrollTop;
	const sequence = ++loadSequence;
	const article = await getArticle(current.article.slug);
	if (sequence !== loadSequence) return;
	await presentArticle(article, sequence, current.dirty ? { source: edited.source, properties } : undefined);
	editorScroll.scrollTop = scrollTop;
}

async function loadArticleList(selectSlug?: string, discardDirty = false): Promise<void> {
	articleSummaries = await listArticles();
	renderArticleTree();
	const requested = selectSlug ?? new URL(window.location.href).searchParams.get('article') ?? undefined;
	const initial = articleSummaries.some((article) => article.slug === requested) ? requested : articleSummaries[0]?.slug;
	if (initial) await loadArticle(initial, discardDirty);
	else {
		setSaveState('还没有文章');
		editorPath.textContent = '创建第一篇文章后即可开始写作';
		breadcrumbTitle.textContent = '空工作区';
	}
}

async function saveCurrentArticle(): Promise<void> {
	const snapshot = store.current;
	if (!snapshot.article || !snapshot.dirty) return;
	const properties = updatePropertiesFromInputs();
	if (!properties) return;
	saveButton.disabled = true;
	publishArticleButton.disabled = true;
	setSaveState('正在保存…', 'saving');
	try {
		const current = store.current;
		const result = await saveArticle(current.article!.slug, current.source, current.revision);
		store.markSaved(result.revision, properties);
		updateArticleSummary(properties);
		compareRoundtrip(store.current.article!.source, store.current.source);
		setSaveState('已保存', 'saved');
	} catch (error) {
		const message = error instanceof Error ? error.message : '保存失败';
		setSaveState(error instanceof StudioApiError && error.status === 409 ? `保存冲突：${message}` : message, 'error');
	} finally {
		saveButton.disabled = false;
		publishArticleButton.disabled = false;
	}
}

function suggestedSlug(title: string): string {
	const ascii = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
	if (ascii) return ascii;
	const now = new Date();
	const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
		.map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0')).join('');
	const time = [now.getHours(), now.getMinutes()].map((value) => String(value).padStart(2, '0')).join('');
	return `note-${date}-${time}`;
}

function showNewArticleError(message: string): void {
	newArticleError.textContent = message;
	newArticleError.hidden = message.length === 0;
}

function openNewArticleDialog(): void {
	newArticleForm.reset();
	slugWasEdited = false;
	showNewArticleError('');
	newArticleDialog.showModal();
	newArticleTitle.focus();
}

function closeNewArticleDialog(): void {
	if (!createArticleButton.disabled) newArticleDialog.close();
}

for (const button of newArticleButtons) button.addEventListener('click', openNewArticleDialog);
articleSearch.addEventListener('input', renderArticleTree);
saveButton.addEventListener('click', () => { void saveCurrentArticle(); });
togglePropertiesButton.addEventListener('click', () => {
	const open = articlePropertiesPanel.hasAttribute('hidden');
	articlePropertiesPanel.hidden = !open;
	togglePropertiesButton.setAttribute('aria-expanded', String(open));
});
for (const input of [articleTitleInput, articleDescriptionInput, articleTagsInput]) {
	input.addEventListener('input', updatePropertiesFromInputs);
}
for (const input of [articlePubDateInput, articleDraftInput]) {
	input.addEventListener('change', updatePropertiesFromInputs);
}
publishArticleButton.addEventListener('click', async () => {
	const previous = articleDraftInput.checked;
	articleDraftInput.checked = !previous;
	if (!updatePropertiesFromInputs()) {
		articleDraftInput.checked = previous;
		updatePropertySummary(propertiesFromInputs());
		return;
	}
	await saveCurrentArticle();
});
function focusBodyStart(): void {
	if (!crepe) return;
	crepe.editor.action((ctx) => {
		const view = ctx.get(editorViewCtx);
		const selection = TextSelection.atStart(view.state.doc);
		view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
		view.focus();
	});
}

bindTitleFocus(() => {
	const end = articleTitleInput.value.length;
	articleTitleInput.focus();
	articleTitleInput.setSelectionRange(end, end);
});
articleTitleInput.addEventListener('keydown', (event) => {
	if (event.isComposing || articleTitleInput.disabled) return;
	if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
	if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) return;
	event.preventDefault();
	focusBodyStart();
});
toggleSidebarButton.addEventListener('click', () => {
	const collapsed = studioShell.classList.toggle('sidebar-collapsed');
	toggleSidebarButton.setAttribute('aria-pressed', String(collapsed));
	toggleSidebarButton.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
});
if (window.matchMedia('(max-width: 720px)').matches) {
	studioShell.classList.add('sidebar-collapsed');
	toggleSidebarButton.setAttribute('aria-pressed', 'true');
	toggleSidebarButton.setAttribute('aria-label', '展开侧边栏');
}
newArticleTitle.addEventListener('input', () => {
	if (!slugWasEdited) newArticleSlug.value = suggestedSlug(newArticleTitle.value);
});
newArticleSlug.addEventListener('input', () => {
	slugWasEdited = true;
	newArticleSlug.value = newArticleSlug.value.toLowerCase().replace(/[^a-z0-9-]/gu, '');
});
for (const button of cancelNewArticleButtons) button.addEventListener('click', closeNewArticleDialog);
newArticleDialog.addEventListener('click', (event) => {
	if (event.target === newArticleDialog) closeNewArticleDialog();
});
newArticleForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!newArticleForm.reportValidity()) return;
	if (store.current.dirty && !confirm('当前文章尚未保存。确定放弃修改并创建新文章吗？')) return;
	createArticleButton.disabled = true;
	showNewArticleError('');
	try {
		const slug = newArticleSlug.value.trim();
		await createArticle(slug, newArticleTitle.value.trim());
		newArticleDialog.close();
		await loadArticleList(slug, true);
	} catch (error) {
		showNewArticleError(error instanceof Error ? error.message : '新建失败');
	} finally {
		createArticleButton.disabled = false;
	}
});

document.addEventListener('keydown', (event) => {
	if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
	event.preventDefault();
	void saveCurrentArticle();
});
window.addEventListener('beforeunload', (event) => {
	if (!store.current.dirty) return;
	event.preventDefault();
});

loadArticleList().catch((error) => {
	setSaveState(error instanceof Error ? error.message : '无法连接本地 Studio', 'error');
});
