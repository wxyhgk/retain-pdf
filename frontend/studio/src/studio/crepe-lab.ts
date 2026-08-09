import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import { getArticle, listArticles, saveArticle, saveMoleculeView, StudioApiError } from './api/client';
import { parseStudioDocument, replaceStudioDocumentBody } from './document';
import '../science/browser/molecule-renderer.css';
import {
	setMoleculeViewContext,
} from '../science/browser/molecule-renderer';
import { createSciencePreview, observeSciencePreviews } from '../science/browser/science-renderer';
import { setScienceResourceBaseUrl } from '../science/browser/resource-context';
import { ArticleStore } from './state/article-store';

const articleList = document.querySelector<HTMLElement>('#article-list')!;
const editorHost = document.querySelector<HTMLElement>('#crepe-editor')!;
const editorPath = document.querySelector<HTMLElement>('#editor-path')!;
const differenceDetail = document.querySelector<HTMLElement>('#difference-detail')!;
const roundtripStatus = document.querySelector<HTMLElement>('#roundtrip-status')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-button')!;
const openArticle = document.querySelector<HTMLAnchorElement>('#open-article')!;

const scienceDataSupport = new LanguageSupport(StreamLanguage.define({
	token(stream) {
		stream.skipToEnd();
		return null;
	},
}));
const scienceDataLanguage = LanguageDescription.of({
	name: 'Science data',
	alias: ['smiles', 'sdf', 'mol', 'xyz', 'gjf', 'com', 'pdb', 'mol2', 'cif', 'cube',
		'sdf-2d', 'mol-2d', 'sdf-3d', 'mol-3d', 'xyz-3d', 'pdb-3d', 'mol2-3d', 'cif-3d', 'cube-3d'],
	support: scienceDataSupport,
});

const store = new ArticleStore();
let crepe: Crepe | null = null;
let loading = false;
let loadSequence = 0;
observeSciencePreviews(editorHost);

function setSaveState(text: string, state = ''): void {
	saveStatus.textContent = text;
	saveStatus.dataset.state = state;
}

function compareRoundtrip(original: string, current: string): void {
	if (original === current) {
		roundtripStatus.textContent = '正文往返：逐字一致';
		roundtripStatus.dataset.state = 'exact';
		differenceDetail.textContent = `${current.length} 字符，无差异`;
		return;
	}

	let offset = 0;
	const limit = Math.min(original.length, current.length);
	while (offset < limit && original[offset] === current[offset]) offset += 1;
	const line = original.slice(0, offset).split('\n').length;
	roundtripStatus.textContent = '正文往返：存在规范化';
	roundtripStatus.dataset.state = 'changed';
	differenceDetail.textContent = `首个差异：第 ${line} 行，原文 ${original.length} / Crepe ${current.length} 字符`;
}

function updateMarkdown(markdown: string): void {
	if (loading || !store.current.article) return;
	const source = replaceStudioDocumentBody(parseStudioDocument(store.current.source), markdown);
	store.updateSource(source);
	compareRoundtrip(store.current.article.source, source);
	setSaveState(store.current.dirty ? '未保存' : '已载入', store.current.dirty ? 'dirty' : 'saved');
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
				languages: [...codeMirrorLanguages, scienceDataLanguage],
				copyText: '复制',
				previewLabel: '预览',
				previewLoading: '正在渲染…',
				renderPreview: (language, content) => createSciencePreview(language, content),
			},
			[CrepeFeature.Placeholder]: {
				text: "输入 '/' 添加内容，或直接开始记录…",
				mode: 'block',
			},
			[CrepeFeature.Latex]: {
				katexOptions: { throwOnError: false },
			},
		},
	});
	crepe.on((listener) => {
		listener.markdownUpdated((_ctx, markdown) => updateMarkdown(markdown));
	});
	await crepe.create();
	const markdown = crepe.getMarkdown();
	loading = false;
	return replaceStudioDocumentBody(parseStudioDocument(source), markdown);
}

async function loadArticle(slug: string): Promise<void> {
	if (store.current.dirty && !confirm('当前文章尚未保存，确定要切换吗？')) return;
	const sequence = ++loadSequence;
	setSaveState('正在载入…');
	const article = await getArticle(slug);
	if (sequence !== loadSequence) return;
	store.load(article);
	setScienceResourceBaseUrl(`/api/studio/articles/${encodeURIComponent(article.slug)}/files`);
	setMoleculeViewContext({
		views: article.chemistryViews,
		save: async (key, format, view, display) => {
			const snapshot = store.current;
			if (!snapshot.article) throw new Error('文章尚未载入');
			const result = await saveMoleculeView(
				snapshot.article.slug,
				key,
				format,
				view,
				snapshot.revision,
				display,
			);
			store.updateRevision(result.revision, result.chemistryViews);
		},
	});
	const normalizedSource = await mountEditor(article.source);
	if (sequence !== loadSequence) return;
	editorPath.textContent = `blog/${article.slug}/index.md`;
	openArticle.href = `/blog/${article.slug}/`;
	saveButton.disabled = false;
	compareRoundtrip(article.source, normalizedSource);
	setSaveState(article.source === normalizedSource ? '已载入' : '已载入 · 规范化未应用', 'saved');

	for (const button of articleList.querySelectorAll('button')) {
		button.classList.toggle('active', button.dataset.slug === slug);
	}
}

async function loadArticleList(): Promise<void> {
	const articles = await listArticles();
	articleList.replaceChildren();
	for (const article of articles) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.slug = article.slug;
		const title = document.createElement('strong');
		title.textContent = article.title;
		const slug = document.createElement('span');
		slug.textContent = article.slug;
		button.append(title, slug);
		button.addEventListener('click', () => { void loadArticle(article.slug); });
		articleList.append(button);
	}
	if (articles[0]) await loadArticle(articles[0].slug);
	else setSaveState('还没有文章');
}

async function saveCurrentArticle(): Promise<void> {
	const snapshot = store.current;
	if (!snapshot.article || !snapshot.dirty) return;
	saveButton.disabled = true;
	setSaveState('正在保存…', 'saving');
	try {
		const result = await saveArticle(snapshot.article.slug, snapshot.source, snapshot.revision);
		store.markSaved(result.revision);
		compareRoundtrip(store.current.article!.source, store.current.source);
		setSaveState('已保存', 'saved');
	} catch (error) {
		const message = error instanceof Error ? error.message : '保存失败';
		setSaveState(error instanceof StudioApiError && error.status === 409 ? `保存冲突：${message}` : message, 'error');
	} finally {
		saveButton.disabled = false;
	}
}

saveButton.addEventListener('click', () => { void saveCurrentArticle(); });

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
