import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/prose/state';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import '../../science/browser/molecule-renderer.css';
import { createSciencePreview, observeSciencePreviews } from '../../science/browser/science-renderer';
import { linkPath } from '../workspace/file-tree';
import { blockFeelPlugins } from './block-menu';
import { buildScienceSlashMenu, scienceBlockPlugins } from './crepe-science-block';
import { displayMathPlugins } from './display-math';
import { articleFileDrop, replaceSlashImageItem, type ArticleFileDropHost } from './file-drop';
import { imageMarkdownRemark } from './image-markdown';
import { inlineMathPlugins } from './inline-math';
import { mathBracketsRemark } from './math-brackets';

/** What the editor needs from the Studio around it. */
export type StudioEditorHost = {
	/** Uploads for files dropped, pasted or picked in the editor. */
	files: ArticleFileDropHost;
	/** Where to load a file the article links to (`./img/a.png`) from. */
	fileUrl(src: string): string;
	/** The author edited: the whole body as Markdown. */
	changed(markdown: string): void;
};

export type StudioEditor = {
	/** Shows a Markdown body, replacing what was shown; the Markdown the editor writes for it. */
	mount(body: string): Promise<string>;
	/** The caret at the start of the body. */
	focusStart(): void;
};

/** The Studio's editor: Crepe with the science blocks, formulas, file drops and block feel. */
export function createStudioEditor(root: HTMLElement, host: StudioEditorHost): StudioEditor {
	let crepe: Crepe | null = null;
	let mounting = false;
	observeSciencePreviews(root);

	async function mount(body: string): Promise<string> {
		mounting = true;
		try {
			if (crepe) await crepe.destroy();
			root.replaceChildren();
			const fileDrop = articleFileDrop(host.files);
			crepe = new Crepe({
				root,
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
						proxyDomURL: host.fileUrl,
						onUpload: async (file: File) => linkPath((await host.files.upload([file]))[0]),
						inlineUploadButton: '上传',
						inlineUploadPlaceholderText: '或粘贴链接',
						blockUploadButton: '上传图片',
						blockCaptionPlaceholderText: '添加说明',
						blockUploadPlaceholderText: '或粘贴图片链接',
						blockConfirmButton: '确定',
					},
					[CrepeFeature.BlockEdit]: {
						buildMenu: (builder) => {
							buildScienceSlashMenu(builder);
							replaceSlashImageItem(builder, fileDrop.chooseImages);
						},
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
			crepe.editor.use(fileDrop.plugin);
			crepe.on((listener) => {
				// Opening the body is not an edit.
				listener.markdownUpdated((_ctx, markdown) => { if (!mounting) host.changed(markdown); });
			});
			await crepe.create();
			return crepe.getMarkdown();
		} finally {
			mounting = false;
		}
	}

	function focusStart(): void {
		crepe?.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			view.dispatch(view.state.tr.setSelection(TextSelection.atStart(view.state.doc)).scrollIntoView());
			view.focus();
		});
	}

	return { mount, focusStart };
}
