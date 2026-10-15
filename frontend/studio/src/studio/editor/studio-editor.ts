import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { diffComponent, diffComponentConfig } from '@milkdown/kit/component/diff';
import {
	acceptAllDiffsCmd,
	clearDiffReviewCmd,
	diff,
	diffConfig,
	diffPluginKey,
	getPendingChanges,
	startDiffReviewCmd,
} from '@milkdown/kit/plugin/diff';
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import { $prose, callCommand } from '@milkdown/utils';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import '../../science/browser/molecule-renderer.css';
import { gfmOptions } from '../../plugins/markdown-gfm.mjs';
import { createSciencePreview, observeSciencePreviews } from '../../science/browser/science-renderer';
import { linkPath } from '../workspace/file-tree';
import { blockFeelPlugins } from './block-menu';
import { buildScienceSlashMenu, scienceBlockPlugins } from './crepe-science-block';
import { displayMathPlugins } from './display-math';
import { articleFileDrop, replaceSlashImageItem, type ArticleFileDropHost } from './file-drop';
import { imageMarkdownRemark } from './image-markdown';
import { inlineMathPlugins } from './inline-math';
import { mathBracketsRemark } from './math-brackets';
import { SCIENCE_FENCE_TYPE } from './science-block';

/** What the editor needs from the Studio around it. */
export type StudioEditorHost = {
	/** Uploads for files dropped, pasted or picked in the editor. */
	files: ArticleFileDropHost;
	/** Where to load a file the article links to (`./img/a.png`) from. */
	fileUrl(src: string): string;
	/** The author edited: the whole body as Markdown. */
	changed(markdown: string): void;
	/** How many changes are left to review, or null when none is under review. */
	reviewing(pending: number | null): void;
};

export type StudioEditor = {
	/** Shows a Markdown body, replacing what was shown; the Markdown the editor writes for it. */
	mount(body: string): Promise<string>;
	/** The caret at the start of the body. */
	focusStart(): void;
	/**
	 * Shows how `body` differs from the body shown, each change to accept or
	 * reject; resolves with the Markdown shown once every one is decided.
	 */
	review(body: string): Promise<string>;
	acceptAll(): void;
	rejectAll(): void;
};

/** The Studio's editor: Crepe with the science blocks, formulas, file drops and block feel. */
export function createStudioEditor(root: HTMLElement, host: StudioEditorHost): StudioEditor {
	let crepe: Crepe | null = null;
	let mounting = false;
	/** The review under way: what to call once every change is decided. */
	let review: ((markdown: string) => void) | null = null;
	observeSciencePreviews(root);

	/** Ends the review, with the Markdown the editor now holds. */
	function endReview(): void {
		const finish = review;
		if (!finish) return;
		review = null;
		host.reviewing(null);
		finish(crepe?.getMarkdown() ?? '');
	}

	/** Follows the review: what is left of it, and its end. */
	const reviewWatch = $prose(
		() =>
			new Plugin({
				view: () => ({
					update: (view) => {
						if (!review) return;
						const state = diffPluginKey.getState(view.state);
						const pending = state?.active ? getPendingChanges(state).length : 0;
						// Changes inside a block drawn by its own view show as one: count what is shown.
						if (pending) host.reviewing(view.dom.querySelectorAll('.milkdown-diff-controls').length || pending);
						// Ended by accepting or rejecting the last change, or nothing to review.
						else queueMicrotask(() => {
							if (diffPluginKey.getState(view.state)?.active) view.dispatch(view.state.tr.setMeta(diffPluginKey, { type: 'clear' }));
							endReview();
						});
					},
				}),
			}),
	);

	async function mount(body: string): Promise<string> {
		mounting = true;
		try {
			// Another article, or this one anew: a review still open is over.
			endReview();
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
			crepe.editor
				.config((ctx) => {
					ctx.set(remarkGFMPlugin.options.key, gfmOptions);
					ctx.update(diffConfig.key, (prev) => ({ ...prev, ignoreAttrs: { heading: ['id'] } }));
					ctx.update(diffComponentConfig.key, (prev) => ({
						...prev,
						acceptLabel: '接受',
						rejectLabel: '拒绝',
						// Blocks drawn by their own views: a change inside one replaces it whole.
						customBlockTypes: ['table', 'image-block', 'code_block', SCIENCE_FENCE_TYPE],
					}));
				})
				.use(diff)
				.use(diffComponent)
				.use(reviewWatch);
			crepe.on((listener) => {
				// Opening the body is not an edit, nor is deciding a change under review.
				listener.markdownUpdated((_ctx, markdown) => { if (!mounting && !review) host.changed(markdown); });
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

	function startReview(body: string): Promise<string> {
		if (!crepe) return Promise.resolve(body);
		const editor = crepe;
		return new Promise((resolve) => {
			// A newer version on disk takes over a review still open.
			const overtaken = review;
			review = resolve;
			overtaken?.(editor.getMarkdown());
			editor.editor.action(callCommand(startDiffReviewCmd.key, body));
		});
	}

	return {
		mount,
		focusStart,
		review: startReview,
		acceptAll: () => crepe?.editor.action(callCommand(acceptAllDiffsCmd.key)),
		rejectAll: () => crepe?.editor.action(callCommand(clearDiffReviewCmd.key)),
	};
}
