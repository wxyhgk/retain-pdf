import { Crepe, CrepeFeature } from '@milkdown/crepe';
import type { ForkBlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
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
import { blockConfig } from '@milkdown/kit/plugin/block';
import { remarkGFMPlugin, strikethroughKeymap } from '@milkdown/kit/preset/gfm';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose, callCommand, insert } from '@milkdown/utils';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import '@blog/science/browser/molecule-renderer.css';
import { gfmOptions } from '@blog/markdown/plugins/markdown-gfm.mjs';
import { createSciencePreview, observeSciencePreviews } from '@blog/science/browser/science-renderer.ts';
import { linkPath } from '../article-files';
import { blockFeelPlugins, buildBlockMenu, buildToolbarAsk, buildToolbarTurn } from './block-menu';
import { canSaveAsFile, codeFileLanguageDescriptions, codeFilePreview, observeCodeFiles, saveCodeBlockAsFile } from './code-files';
import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { scienceBlockPlugins } from './crepe-science-block';
import { displayMathPlugins } from './display-math';
import { articleFileDrop, replaceSlashImageItem, type ArticleFileDropHost } from './file-drop';
import { articleLinkPlugins, type ArticleLinkHost } from './article-links';
import { smartPastePlugins } from './smart-paste';
import { blockKeyPlugins } from './block-key-plugins';
import { selectBlockForHandle } from './block-range';
import { buildBlockSlashMenu, buildCommandSlashMenu } from './block-slash-menu';
import { calloutPlugins } from './callout-block';
import { citationPlugins, setCitationLibrary, type CitationHost } from './citations';
import { officeCardPlugins } from './office-card-block';
import type { BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { FIGURE_TYPE, figurePlugins } from './figure-block';
import { inlineMathPlugins } from './inline-math';
import { mathBracketsRemark } from './math-brackets';
import { SCIENCE_FENCE_TYPE } from './science-block';
import { buildScienceSlashMenu, type SlashMenuBuilder } from './science-slash-menu';
import { addSearchWords, SLASH_TRIGGERS } from './slash-search';
import { withoutTrailingEmptyLines } from '../document/index.ts';
import { SELECTION_END, SELECTION_START } from '../document/source-lines.ts';
import { togglePlugins } from './toggle-block';
import { columnsPlugins } from './columns-block';
import { observeWidgets, widgetLanguageDescription, widgetPreview } from './widget-block';
import { pluginBlocks, pluginSlashCommands } from '../plugins';
import { runCommand } from '../workspace/plugin-ui';
import '@blog/markdown/widgets/widgets.css';

/** What the editor needs from the Studio around it. */
export type StudioEditorHost = {
	/** Uploads for files dropped, pasted or picked in the editor. */
	files: ArticleFileDropHost;
	/** Where to load a file the article links to (`./img/a.png`) from. */
	fileUrl(src: string): string;
	/** A code block's `@file ./assets/opt.log`, drawn as the blog draws it. */
	codeFile(reference: string, language: string, meta: string): Promise<HastElement>;
	/** The author edited: the whole body as Markdown. */
	changed(markdown: string): void;
	/** How many changes are left to review, or null when none is under review. */
	reviewing(pending: number | null): void;
	/** The author asks an AI about the selected blocks (⌘J, 「问 AI」): `markSelection` tells which. */
	askAI(): void;
} & ArticleLinkHost &
	CitationHost;

export type StudioEditor = {
	/** Shows a Markdown body, replacing what was shown; the Markdown the editor writes for it. */
	mount(body: string): Promise<string>;
	/** The caret at the start of the body. */
	focusStart(): void;
	/** Reports the edits not reported yet (`changed` follows the typing by a moment). */
	settle(): void;
	/**
	 * Shows how `body` differs from the body shown, each change to accept or
	 * reject; resolves with the Markdown shown once every one is decided.
	 */
	review(body: string): Promise<string>;
	acceptAll(): void;
	rejectAll(): void;
	/**
	 * The body as Markdown with the blocks the selection is in marked
	 * (source-lines.ts): which lines of the file they are. Null with nothing shown.
	 */
	markSelection(): string | null;
	/** The article's library (assets/refs.bib), to number its citations by; null when it has none. */
	setLibrary(library: Map<string, BibEntry> | null): void;
	/** Puts Markdown in where the caret is, as blocks of their own. */
	insertMarkdown(markdown: string): void;
	/** The ProseMirror view of the article shown; null before one is. */
	view(): EditorView | null;
};

/** What the editor holds, as Markdown, without empty lines left at the end. */
function markdownOf(editor: { getMarkdown(): string }): string {
	return withoutTrailingEmptyLines(editor.getMarkdown());
}

/** The Studio's editor: Crepe with the science blocks, formulas, file drops and block feel. */
export function createStudioEditor(root: HTMLElement, host: StudioEditorHost): StudioEditor {
	let crepe: Crepe | null = null;
	let mounting = false;
	/** The review under way: what to call once every change is decided. */
	let review: ((markdown: string) => void) | null = null;
	/** The body as last reported, or as mounted. */
	let reported: ProseNode | null = null;

	/** Reports the body, when it is an edit and not what was reported already. */
	function report(): void {
		if (!crepe || mounting || review) return;
		crepe.editor.action((ctx) => {
			const { doc } = ctx.get(editorViewCtx).state;
			if (reported?.eq(doc)) return;
			reported = doc;
			host.changed(markdownOf(crepe!));
		});
	}
	observeSciencePreviews(root);
	observeCodeFiles(root);
	observeWidgets(root);

	/** Ends the review, with the Markdown the editor now holds. */
	function endReview(): void {
		const finish = review;
		if (!finish) return;
		review = null;
		host.reviewing(null);
		// The review's outcome goes to `finish`; it is not an edit to report again.
		crepe?.editor.action((ctx) => { reported = ctx.get(editorViewCtx).state.doc; });
		finish(crepe ? markdownOf(crepe) : '');
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
			// The blocks of the project's plugins (plugins/*/studio.ts): their nodes, their slash-menu entries.
			const blocks = await pluginBlocks();
			const commands = await pluginSlashCommands();
			root.replaceChildren();
			const fileDrop = articleFileDrop(host.files);
			// Crepe's own config, plus the block menu only the Milkdown fork has.
			const saveAsFile = saveCodeBlockAsFile(host.files);
			const filePreview = codeFilePreview(host.codeFile);
			const blockEdit: ForkBlockEditFeatureConfig = {
				// A block in a column has its handle close by, in the gap between the columns; others, in the margin.
				blockHandle: { getOffset: ({ active }) => (active.$pos.parent.type.name === 'column' ? 2 : 16) },
				buildBlockMenu: (builder, target) =>
					buildBlockMenu(builder, target, {
						saveAsFile: { can: canSaveAsFile, run: (view, pos) => void saveAsFile(view, pos) },
						ask: () => host.askAI(),
					}),
				buildMenu: (builder) => {
					buildScienceSlashMenu(builder);
					buildBlockSlashMenu(builder as unknown as SlashMenuBuilder, host, blocks);
					buildCommandSlashMenu(builder as unknown as SlashMenuBuilder, commands, (command) => runCommand(command, 'slash'));
					replaceSlashImageItem(builder, fileDrop.chooseImages);
					addSearchWords(builder);
				},
				slashMenu: { triggers: SLASH_TRIGGERS },
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
			};
			crepe = new Crepe({
				root,
				defaultValue: body,
				features: {
					[CrepeFeature.TopBar]: false,
					[CrepeFeature.AI]: false,
				},
				featureConfigs: {
					[CrepeFeature.CodeMirror]: {
						languages: [widgetLanguageDescription, ...codeFileLanguageDescriptions, ...codeMirrorLanguages],
						copyText: '复制',
						previewLabel: '预览',
						previewLoading: '正在渲染…',
						previewOnlyByDefault: true,
						previewToggleText: (previewOnly: boolean) => (previewOnly ? '编辑' : '收起'),
						searchPlaceholder: '搜索语言',
						noResultText: '没有匹配的语言',
						// A block that shows a file of the article (`@file ./assets/opt.log`) previews it as the blog does.
						// It comes later (undefined), once the file is read. The fork passes the fence's
						// `lines=` and `title=` (meta) too, which the npm release's type does not know.
						renderPreview: (language: string, content: string, apply: (value: HTMLElement) => void, meta = '') => {
							const widget = widgetPreview(language, content, meta);
							if (widget) return widget;
							const file = filePreview(language, content, apply, meta);
							return file === null ? createSciencePreview(language, content) : file;
						},
					},
					[CrepeFeature.Placeholder]: {
						text: "输入 '/' 插入块",
						mode: 'block',
					},
					// Formulas are drawn by inline-math.ts and display-math.ts; a ```latex fence is code.
					[CrepeFeature.Latex]: { blockPreview: false },
					[CrepeFeature.Toolbar]: {
						boldLabel: '粗体',
						italicLabel: '斜体',
						strikethroughLabel: '删除线',
						codeLabel: '行内代码',
						linkLabel: '链接',
						latexLabel: '公式',
						buildToolbar: (builder) => {
							buildToolbarTurn(builder);
							buildToolbarAsk(builder, () => host.askAI());
						},
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
					[CrepeFeature.BlockEdit]: blockEdit,
				},
			});
			crepe.editor.use(scienceBlockPlugins);
			for (const block of blocks) if (block.milkdown) crepe.editor.use(block.milkdown as never);
			crepe.editor.use(blockFeelPlugins);
			crepe.editor.use(inlineMathPlugins);
			crepe.editor.use(displayMathPlugins);
			crepe.editor.use(mathBracketsRemark);
			crepe.editor.use(figurePlugins(host.fileUrl));
			crepe.editor.use(calloutPlugins());
			crepe.editor.use(citationPlugins(host));
			crepe.editor.use(officeCardPlugins(host.fileUrl));
			crepe.editor.use(togglePlugins());
			crepe.editor.use(columnsPlugins());
			crepe.editor.use(articleLinkPlugins(host));
			crepe.editor.use(smartPastePlugins(host));
			crepe.editor.use(fileDrop.plugin);
			// Last, so Esc and the other keys go to what is open first.
			crepe.editor.use(blockKeyPlugins(host));
			crepe.editor
				.config((ctx) => {
					ctx.set(remarkGFMPlugin.options.key, gfmOptions);
					// Notion's key for strikethrough; the toolbar's tooltip follows it.
					ctx.set(strikethroughKeymap.key, { ToggleStrikethrough: { shortcuts: 'Mod-Shift-s' } });
					ctx.update(diffConfig.key, (prev) => ({ ...prev, ignoreAttrs: { heading: ['id'] } }));
					// A block's handle selects as Esc and the margin do: one kind of block selection.
					ctx.update(blockConfig.key, (prev) => ({ ...prev, selectBlock: selectBlockForHandle }));
					ctx.update(diffComponentConfig.key, (prev) => ({
						...prev,
						acceptLabel: '接受',
						rejectLabel: '拒绝',
						// Blocks drawn by their own views: a change inside one replaces it whole.
						customBlockTypes: ['table', 'image-block', FIGURE_TYPE, 'code_block', SCIENCE_FENCE_TYPE],
					}));
				})
				.use(diff)
				.use(diffComponent)
				.use(reviewWatch);
			crepe.on((listener) => {
				// Opening the body is not an edit, nor is deciding a change under review.
				listener.markdownUpdated(() => report());
			});
			await crepe.create();
			applyLibrary();
			crepe.editor.action((ctx) => { reported = ctx.get(editorViewCtx).state.doc; });
			return markdownOf(crepe);
		} finally {
			mounting = false;
		}
	}

	/** The library the citations are numbered by; kept for the next article shown too, until it is set again. */
	let library: Map<string, BibEntry> | null = null;
	function applyLibrary(): void {
		crepe?.editor.action((ctx) => setCitationLibrary(ctx.get(editorViewCtx), library));
	}

	function markSelection(): string | null {
		if (!crepe) return null;
		return crepe.editor.action((ctx) => {
			const { state } = ctx.get(editorViewCtx);
			const paragraph = state.schema.nodes.paragraph;
			if (!paragraph || !state.doc.childCount) return null;
			const { from, to } = state.selection;
			const $from = state.doc.resolve(from);
			const $to = state.doc.resolve(to);
			// Whole blocks: from the start of the one the selection starts in to the end of the one it ends in.
			const start = $from.depth ? $from.before(1) : from;
			const end = $to.depth ? $to.after(1) : to;
			const mark = (text: string) => paragraph.create(null, state.schema.text(text));
			const marked = state.tr.insert(end, mark(SELECTION_END)).insert(start, mark(SELECTION_START)).doc;
			return withoutTrailingEmptyLines(ctx.get(serializerCtx)(marked));
		});
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
			overtaken?.(markdownOf(editor));
			editor.editor.action(callCommand(startDiffReviewCmd.key, body));
		});
	}

	return {
		markSelection,
		insertMarkdown(markdown) {
			crepe?.editor.action(insert(markdown));
		},
		view() {
			if (!crepe || mounting) return null;
			let view: EditorView | null = null;
			try {
				crepe.editor.action((ctx) => {
					view = ctx.get(editorViewCtx);
				});
			} catch {
				// Not made yet.
			}
			return view;
		},
		setLibrary(next) {
			library = next;
			applyLibrary();
		},
		mount,
		focusStart,
		settle: report,
		review: startReview,
		acceptAll: () => crepe?.editor.action(callCommand(acceptAllDiffsCmd.key)),
		rejectAll: () => crepe?.editor.action(callCommand(clearDiffReviewCmd.key)),
	};
}
