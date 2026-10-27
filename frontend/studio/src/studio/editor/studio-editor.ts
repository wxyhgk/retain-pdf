import { Crepe, CrepeFeature } from '@milkdown/crepe';
import type { ForkBlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';
import { editorStateCtx, editorStateOptionsCtx, editorViewCtx, editorViewOptionsCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
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
import { syncHeadingIds } from '@milkdown/kit/preset/commonmark';
import { remarkGFMPlugin, strikethroughKeymap } from '@milkdown/kit/preset/gfm';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/prose/model';
import { EditorState, Plugin, PluginKey, TextSelection, type Transaction } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose, callCommand, insert } from '@milkdown/utils';
import { languages as codeMirrorLanguages } from '@codemirror/language-data';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import 'katex/contrib/mhchem';
import { gfmOptions } from '@blog/markdown/plugins/markdown-gfm.mjs';
import { linkPath } from '../files/article-files';
import { blockFeelPlugins, buildBlockMenu, buildToolbarAsk, buildToolbarTurn } from './block-menu';
import { filesNamed, headingSection } from './split-section';
import { canSaveAsFile, codeFileLanguageDescriptions, codeFilePreview, observeCodeFiles, saveCodeBlockAsFile } from './code-files';
import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { blockwiseMarkdown } from './blockwise-markdown';
import { isLongArticle, LONG, OPENING } from '@blog/editor-kit/near-screen.ts';
import { displayMathPlugins } from '@blog/editor-kit/math/display-math.ts';
import { articleFileDrop, replaceSlashImageItem, type ArticleFileDropHost } from './file-drop';
import { articleLinkPlugins, type ArticleLinkHost } from './article-links';
import { blockToLink, linkTargets, replaceBlock } from './link-embeds';
import { smartPastePlugins } from './smart-paste';
import { blockKeyPlugins } from './block-key-plugins';
import { selectBlockForHandle } from './block-range';
import { buildBlockSlashMenu, buildCommandSlashMenu, type SlashMenuBuilder } from './block-slash-menu';
import { calloutPlugins } from './callout-block';
import { citationPlugins, setCitationLibrary, type CitationHost } from './citations';
import { officeCardPlugins } from './office-card-block';
import type { BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { FIGURE_TYPE, figurePlugins } from './figure-block';
import { inlineMathPlugins } from '@blog/editor-kit/math/inline-math.ts';
import { mathBracketsRemark } from '@blog/editor-kit/math/math-brackets.ts';
import { addSearchWords, SLASH_INLINE_TRIGGERS, SLASH_TRIGGERS } from './slash-search';
import { withoutTrailingEmptyLines } from '@blog/document/index.ts';
import { bodyParts } from '@blog/document/parse.ts';
import type { MarkdownBlockSlice } from '@blog/document/types.ts';
import { SELECTION_END, SELECTION_START } from '@blog/document/source-lines.ts';
import { togglePlugins } from './toggle-block';
import { columnsPlugins } from './columns-block';
import { pluginBlocks, pluginSlashCommands } from '../plugins';
import { runCommand } from '../plugin-ui';
import { t } from '@blog/i18n/index.mjs';

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
	/** The article mounted is on the page: a long one's first part, the rest coming in after. */
	shown(): void;
	/** The AI in the editor, on the selected blocks (⌘J, 「AI」): `markSelection` tells which. */
	askAI(): void;
	/** Space on an empty line: the AI in the editor, to write there. */
	writeWithAI(): void;
	/** Alt+Enter: an AI does what the blocks the caret is in say, by itself (⇧ as well: in a new talk). */
	instruct(fresh: boolean): void;
	/** OCR 成子页面: the PDF the line at `pos` links to (`path` in the article) read into a page under it, linked under that line. */
	ocrPdf(view: EditorView, pos: number, path: string): void;
	/** 识别…: the picture at `pos` read by the large model of AI 设置. */
	recognize(view: EditorView, pos: number): void;
	/**
	 * 转成子页面: the folder name a page made now under the open article
	 * would get (null when none is open), and making it with this text and the
	 * article's files it names; whether it was made.
	 */
	subPage: { plan(): string | null; make(slug: string, title: string, body: string, files: string[]): Promise<boolean> };
} & ArticleLinkHost &
	CitationHost;

export type StudioEditor = {
	/**
	 * Shows a Markdown body, replacing what was shown; the Markdown the editor writes for it. A long one is shown a
	 * part at a time (the first at once), unless `whole`; it resolves once all of it is.
	 */
	mount(body: string, whole?: boolean): Promise<string>;
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
	/** Whether something is selected in the article (not a caret alone). */
	hasSelection(): boolean;
	/** The article's library (assets/refs.bib), to number its citations by; null when it has none. */
	setLibrary(library: Map<string, BibEntry> | null): void;
	/** Puts Markdown in where the caret is, as blocks of their own. */
	insertMarkdown(markdown: string): void;
	/** The ProseMirror view of the article shown; null before one is. */
	view(): EditorView | null;
	/** The blocks the selection is in shown as being worked on by an AI (Alt+Enter), as `id`, till `unmarkInstructing`. */
	markInstructing(id: string): void;
	unmarkInstructing(id: string): void;
};

/** Each editor's writer: its blocks' Markdown, remembered (a long article is not written whole at every edit). */
const writers = new WeakMap<Crepe, (doc: ProseNode) => string>();

function writerOf(editor: Crepe): (doc: ProseNode) => string {
	let write = writers.get(editor);
	if (!write) writers.set(editor, (write = editor.editor.action((ctx) => blockwiseMarkdown(ctx.get(serializerCtx)))));
	return write;
}

/** What the editor holds, as Markdown, without empty lines left at the end. */
function markdownOf(editor: Crepe): string {
	return withoutTrailingEmptyLines(writerOf(editor)(editor.editor.action((ctx) => ctx.get(editorViewCtx).state.doc)));
}

/**
 * A body longer than this (in characters; the longest article in this blog has about 24 000) is shown a part at a
 * time, as SiYuan shows a long document: a book's blocks take seconds to make and lay out, a few screens' a moment.
 */
const IN_PARTS = 50_000;
/** About how long the first part is (a few screens), and each after it (a frame's work). */
const FIRST_PART = 12_000;
const PART = 12_000;

/** Where the next part of an article shown a part at a time goes: after those in, moved by what is typed meanwhile. */
const nextPartKey = new PluginKey<number>('studio-next-part');
const nextPart = $prose(
	() =>
		new Plugin<number>({
			key: nextPartKey,
			state: {
				init: (_, state) => state.doc.content.size,
				// What is put in right there (an empty line the editor keeps last) stays after the parts.
				apply: (tr, at) => (tr.getMeta(nextPartKey) as number | undefined) ?? tr.mapping.map(at, -1),
			},
		}),
);

/** The blocks an AI is working on (Alt+Enter), each marked till its task is over: `add` or `remove` (a task's id) as meta. */
const instructingKey = new PluginKey<DecorationSet>('studio-instructing');
const instructing = $prose(
	() =>
		new Plugin<DecorationSet>({
			key: instructingKey,
			state: {
				init: () => DecorationSet.empty,
				apply(tr, marks) {
					const meta = tr.getMeta(instructingKey) as { add?: { id: string; from: number; to: number }; remove?: string } | undefined;
					let next = marks.map(tr.mapping, tr.doc);
					if (meta?.remove) next = next.remove(next.find(undefined, undefined, (spec) => spec.instructing === meta.remove));
					if (meta?.add) {
						const { id, from, to } = meta.add;
						const blocks: Decoration[] = [];
						tr.doc.nodesBetween(from, to, (node, pos) => {
							blocks.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-instructing' }, { instructing: id }));
							return false;
						});
						next = next.add(tr.doc, blocks);
					}
					return next;
				},
			},
			props: { decorations: (state) => instructingKey.getState(state) },
		}),
);

/** ProseMirror's own step of applying a transaction, without the plugins' answers to it (appendTransaction). */
type Applying = EditorState & { applyInner(tr: Transaction): EditorState };

/**
 * `doc` with the ids the editor gives its headings: given as an article is read, not in an edit of the plugin's own
 * once it is shown, which goes over the whole article again (a tenth of a second for one with many headings).
 */
function withHeadingIds(ctx: Ctx, doc: ProseNode): ProseNode {
	const { tr } = EditorState.create({ doc });
	return syncHeadingIds(ctx, tr) ? tr.doc : doc;
}

/** Whether two lists hold the same things, in order. */
const sameItems = (one: readonly unknown[], other: readonly unknown[]) => one.length === other.length && one.every((item, index) => item === other[index]);

/** How many blocks of an article just opened are written as Markdown at a frame (a few milliseconds' work). */
const WRITTEN_AT_A_FRAME = 40;

const nextFrame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done)));

/** The Studio's editor: Crepe with the plugins' blocks, formulas, file drops and block feel. */
export function createStudioEditor(root: HTMLElement, host: StudioEditorHost): StudioEditor {
	let crepe: Crepe | null = null;
	let mounting = false;
	/** The article is being opened, till it is first shown: its formulas far from the screen are drawn after (near-screen.ts). */
	let beingOpened = false;
	/** The article shown is a long one, put in a part at a time; `loading` till the last is in. */
	let inParts = false;
	let loading = false;
	/** Done once the article shown is all in. */
	let loaded: Promise<unknown> = Promise.resolve();
	/**
	 * How many times an article has been shown: what is still being done for one (the rest of a long one put in,
	 * its Markdown written) stops once another is. Not the editor: it is kept from one article to the next
	 * (showDocument), and the rest of a long article left early went on into the next one shown.
	 */
	let shownCount = 0;
	/** The plugins' blocks and commands the editor was made with: made again only when they change. */
	let madeWith: { blocks: readonly unknown[]; commands: readonly unknown[] } | null = null;
	/** The review under way: what to call once every change is decided. */
	let review: ((markdown: string) => void) | null = null;
	/** The body as last reported, or as mounted. */
	let reported: ProseNode | null = null;

	/** Reports the body, when it is an edit and not what was reported already. */
	function report(): void {
		if (!crepe || mounting || loading || review) return;
		crepe.editor.action((ctx) => {
			const { doc } = ctx.get(editorViewCtx).state;
			if (reported?.eq(doc)) return;
			reported = doc;
			host.changed(markdownOf(crepe!));
		});
	}
	observeCodeFiles(root);
	/** What the plugins' blocks watch on the page (to draw what their previews left), for the article shown. */
	let unobserve: Array<() => void> = [];

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

	/**
	 * A long article (a book's worth of blocks) marked so: its formulas are drawn as they come near (near-screen.ts),
	 * and the outline goes to a heading at once (outline.ts). And an article being opened: its formulas far from the
	 * screen are drawn after it is shown.
	 */
	const longArticle = $prose(
		() =>
			new Plugin({
				props: {
					attributes: (state): Record<string, string> => {
						const classes = [...(inParts || isLongArticle(state.doc) ? [LONG] : []), ...(beingOpened ? [OPENING] : [])];
						return classes.length ? { class: classes.join(' ') } : {};
					},
				},
			}),
	);

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

	/**
	 * Makes the editor, showing `opening`: with the plugins' `blocks` (their nodes) and `commands` (in the slash menu).
	 * Made once, and again only when they change: the other articles are shown in it (showDocument).
	 */
	async function make(blocks: Awaited<ReturnType<typeof pluginBlocks>>, commands: Awaited<ReturnType<typeof pluginSlashCommands>>, opening: string): Promise<void> {
		if (crepe) await crepe.destroy();
		madeWith = null;
		root.replaceChildren();
		for (const stop of unobserve) stop();
		unobserve = blocks.flatMap((block) => (block.observe ? [block.observe(root)] : []));
		const codeBlocks = blocks.flatMap((block) => (block.codeBlock ? [block.codeBlock] : []));
		const links = linkTargets(blocks);
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
					split: (view, pos) => void splitToPage(view, pos),
					recognize: (view, pos) => host.recognize(view, pos),
					ocr: (view, pos, path) => host.ocrPdf(view, pos, path),
					blocks,
					links: {
						targets: links,
						turn: (view, pos, markdown) => replaceBlock(view, pos, markdown, (text) => crepe!.editor.action((ctx) => ctx.get(parserCtx)(text))),
						back: blockToLink,
					},
				}),
			buildMenu: (builder) => {
				buildBlockSlashMenu(builder as unknown as SlashMenuBuilder, host, blocks);
				buildCommandSlashMenu(builder as unknown as SlashMenuBuilder, commands, (command) => runCommand(command, 'slash'));
				replaceSlashImageItem(builder, fileDrop.chooseImages);
				addSearchWords(builder);
			},
			slashMenu: { triggers: SLASH_TRIGGERS, inlineTriggers: SLASH_INLINE_TRIGGERS },
			textGroup: {
				label: t('文本'),
				text: { label: t('正文') },
				h1: { label: t('标题 1') },
				h2: { label: t('标题 2') },
				h3: { label: t('标题 3') },
				h4: null,
				h5: null,
				h6: null,
				quote: { label: t('引用') },
				divider: { label: t('分割线') },
			},
			listGroup: {
				label: t('列表'),
				bulletList: { label: t('无序列表') },
				orderedList: { label: t('有序列表') },
				taskList: { label: t('待办') },
			},
			advancedGroup: {
				label: t('插入'),
				image: { label: t('图片') },
				codeBlock: { label: t('代码') },
				table: { label: t('表格') },
				math: { label: t('公式') },
			},
		};
		crepe = new Crepe({
			root,
			defaultValue: opening,
			features: {
				[CrepeFeature.TopBar]: false,
				[CrepeFeature.AI]: false,
			},
			featureConfigs: {
				[CrepeFeature.CodeMirror]: {
					// The plugins' code blocks first (```widget is HTML), then code files', then CodeMirror's.
					languages: [...(codeBlocks.flatMap((code) => code.languages ?? []) as typeof codeMirrorLanguages), ...codeFileLanguageDescriptions, ...codeMirrorLanguages],
					copyText: t('复制'),
					previewLabel: t('预览'),
					previewLoading: t('正在渲染…'),
					previewOnlyByDefault: true,
					previewToggleText: (previewOnly: boolean) => (previewOnly ? t('编辑') : t('收起')),
					searchPlaceholder: t('搜索语言'),
					noResultText: t('没有匹配的语言'),
					// A block that shows a file of the article (`@file ./assets/opt.log`) previews it as the blog does.
					// It comes later (undefined), once the file is read. The fork passes the fence's
					// `lines=` and `title=` (meta) too, which the npm release's type does not know.
					renderPreview: (language: string, content: string, apply: (value: HTMLElement) => void, meta = '') => {
						// A plugin's code block (a widget's frame) previews as its plugin says.
						for (const code of codeBlocks) {
							const shown = code.preview?.(language, content, meta);
							if (shown) return shown;
						}
						return filePreview(language, content, apply, meta);
					},
				},
				[CrepeFeature.Placeholder]: {
					text: t('写点什么，或输入 / 插入块'),
					mode: 'block',
				},
				// Formulas are drawn by inline-math.ts and display-math.ts; a ```latex fence is code.
				[CrepeFeature.Latex]: { blockPreview: false },
				[CrepeFeature.Toolbar]: {
					boldLabel: t('粗体'),
					italicLabel: t('斜体'),
					strikethroughLabel: t('删除线'),
					codeLabel: t('行内代码'),
					linkLabel: t('链接'),
					latexLabel: t('公式'),
					buildToolbar: (builder) => {
						buildToolbarTurn(builder);
						buildToolbarAsk(builder, () => host.askAI());
					},
				},
				[CrepeFeature.LinkTooltip]: {
					inputPlaceholder: t('粘贴链接…'),
				},
				[CrepeFeature.ImageBlock]: {
					proxyDomURL: host.fileUrl,
					onUpload: async (file: File) => linkPath((await host.files.upload([file]))[0]),
					inlineUploadButton: t('上传'),
					inlineUploadPlaceholderText: t('或粘贴链接'),
					blockUploadButton: t('上传图片'),
					blockCaptionPlaceholderText: t('添加说明'),
					blockUploadPlaceholderText: t('或粘贴图片链接'),
					blockConfirmButton: t('确定'),
				},
				[CrepeFeature.BlockEdit]: blockEdit,
			},
		});
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
		crepe.editor.use(smartPastePlugins({ articleTitle: (slug) => host.articleTitle(slug), links: () => links }));
		crepe.editor.use(fileDrop.plugin);
		// Last, so Esc and the other keys go to what is open first.
		crepe.editor.use(blockKeyPlugins(host));
		crepe.editor
			.config((ctx) => {
				ctx.set(remarkGFMPlugin.options.key, gfmOptions);
				ctx.update(editorStateOptionsCtx, (prev) => (options) => {
					const next = prev(options);
					return next.doc ? { ...next, doc: withHeadingIds(ctx, next.doc) } : next;
				});
				// Notion's key for strikethrough; the toolbar's tooltip follows it.
				ctx.set(strikethroughKeymap.key, { ToggleStrikethrough: { shortcuts: 'Mod-Shift-s' } });
				ctx.update(diffConfig.key, (prev) => ({ ...prev, ignoreAttrs: { heading: ['id'] } }));
				// A block's handle selects as Esc and the margin do: one kind of block selection.
				ctx.update(blockConfig.key, (prev) => ({ ...prev, selectBlock: selectBlockForHandle }));
				// Room kept round the caret as it is typed or moved, as SiYuan keeps it: not on the window's edge.
				ctx.update(editorViewOptionsCtx, (prev) => ({
					...prev,
					scrollThreshold: { top: 64, bottom: 120, left: 0, right: 0 },
					scrollMargin: { top: 64, bottom: 120, left: 0, right: 0 },
				}));
				ctx.update(diffComponentConfig.key, (prev) => ({
					...prev,
					acceptLabel: t('接受'),
					rejectLabel: t('拒绝'),
					// Blocks drawn by their own views: a change inside one replaces it whole.
					customBlockTypes: ['table', 'image-block', FIGURE_TYPE, 'code_block', ...blocks.flatMap((block) => block.drawnWhole ?? [])],
				}));
			})
			.use(diff)
			.use(diffComponent)
			.use(reviewWatch)
			.use(longArticle)
			.use(nextPart)
			.use(instructing);
		crepe.on((listener) => {
			// Opening the body is not an edit, nor is deciding a change under review.
			listener.updated(() => report());
		});
		await crepe.create();
		madeWith = { blocks, commands };
	}

	/**
	 * Shows `markdown` in the editor there is, in place of what it shows: a new state (no undo of the article before),
	 * the editor, its menus and toolbar kept. Made anew, they took a while at every article opened.
	 */
	function showDocument(shown: Crepe, markdown: string): void {
		shown.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const state = EditorState.create({ doc: withHeadingIds(ctx, ctx.get(parserCtx)(markdown)), plugins: view.state.plugins });
			view.updateState(state);
			ctx.set(editorStateCtx, state);
		});
	}

	async function mount(body: string, whole = false): Promise<string> {
		mounting = true;
		const showing = ++shownCount;
		// What was being done for the article before (left while it was put in) is over.
		loading = false;
		root.removeAttribute('aria-busy');
		let mounted: Crepe;
		/** Where the first part ends, as shown: the next goes there. */
		let firstEnd = 0;
		// Browser tests show short articles a part at a time too, in small parts.
		const sizes = { from: IN_PARTS, first: FIRST_PART, rest: PART, ...(window as { STUDIO_PARTS?: object }).STUDIO_PARTS };
		const parts = !whole && body.length > sizes.from ? bodyParts(body, sizes.first, sizes.rest) : null;
		const first = parts?.next().value;
		const opening = first?.length ? body.slice(0, first.at(-1)!.end) : body;
		inParts = opening !== body;
		beingOpened = true;
		try {
			// Another article, or this one anew: a review still open is over.
			endReview();
			// The blocks of the project's plugins (plugins/*/studio.ts): their nodes, their slash-menu entries.
			const blocks = await pluginBlocks();
			const commands = await pluginSlashCommands();
			if (crepe && madeWith && sameItems(madeWith.blocks, blocks) && sameItems(madeWith.commands, commands)) showDocument(crepe, opening);
			else await make(blocks, commands, opening);
			mounted = crepe!;
			applyLibrary();
			mounted.editor.action((ctx) => {
				const { state } = ctx.get(editorViewCtx);
				reported = state.doc;
				firstEnd = nextPartKey.getState(state)!;
			});
		} finally {
			mounting = false;
		}
		// Shown with what is near the screen drawn (in the frame before it is shown): what is made from now on is drawn at once.
		beingOpened = false;
		root.querySelector('.ProseMirror')?.classList.remove(OPENING);
		// Shown first: what it holds as Markdown (whether it reads back as written) is worked out after, a long
		// article's taking a while. Another article shown meanwhile: this one's text as it was.
		await nextFrame();
		if (showing !== shownCount) return body;
		host.shown();
		if (!inParts) return (await writeOpened(mounted, reported!, showing)) ?? body;
		const rest = showRest(mounted, body, parts!, reported!, firstEnd, showing);
		loaded = rest;
		return (await rest) ?? body;
	}

	/**
	 * The Markdown of the article as opened (`doc`), written a few blocks at a frame: written whole, an article of
	 * formulas took a frame of its own right after it was shown. What is typed meanwhile is reported after. Null:
	 * another article was shown meanwhile.
	 */
	async function writeOpened(shown: Crepe, doc: ProseNode, showing: number): Promise<string | null> {
		loading = true;
		const write = writerOf(shown);
		try {
			for (let from = 0; from < doc.childCount; from += WRITTEN_AT_A_FRAME) {
				const blocks: ProseNode[] = [];
				for (let index = from; index < Math.min(doc.childCount, from + WRITTEN_AT_A_FRAME); index += 1) blocks.push(doc.child(index));
				write(doc.copy(Fragment.from(blocks)));
				await nextFrame();
				if (showing !== shownCount) return null;
			}
			reported = doc;
			setTimeout(report);
			return withoutTrailingEmptyLines(write(doc));
		} finally {
			// Another article shown meanwhile: its loading is its own.
			if (showing === shownCount) loading = false;
		}
	}

	/**
	 * Puts the rest of a long article after its first part, a part a frame: it is shown, scrolled and typed in
	 * meanwhile, and what is typed is reported once all is in. `opening` is the first part as shown, the next going at
	 * `end`. The Markdown the article as written is (null: another article was shown meanwhile).
	 */
	async function showRest(shown: Crepe, body: string, parts: Iterator<MarkdownBlockSlice[]>, opening: ProseNode, end: number, showing: number): Promise<string | null> {
		loading = true;
		root.setAttribute('aria-busy', 'true');
		const write = writerOf(shown);
		try {
			/** The article as shown, without what is typed meanwhile: each part put in where it goes in the editor. */
			let asShown = opening;
			/** The part put in last, its Markdown not written yet. */
			let unwritten: Fragment | null = null;
			// Two frames a part, each a short while's work: the part is read (and the one before written as Markdown, a
			// part at a time rather than all at the end); then put in, made and laid out.
			for (let part = parts.next(); !part.done; part = parts.next()) {
				const blocks = part.value;
				const doc = shown.editor.action((ctx) => ctx.get(parserCtx)(body.slice(blocks[0]!.start, blocks.at(-1)!.end)));
				if (unwritten) write(opening.copy(unwritten));
				await nextFrame();
				if (showing !== shownCount) return null;
				unwritten = shown.editor.action((ctx) => {
					const view = ctx.get(editorViewCtx);
					const $at = view.state.doc.resolve(nextPartKey.getState(view.state)!);
					const at = $at.depth ? $at.after(1) : $at.pos;
					const tr = view.state.tr.insert(at, doc.content).setMeta(nextPartKey, at + doc.content.size).setMeta('addToHistory', false);
					// The ids the editor gives headings, given here, not in an edit of its own after each part.
					syncHeadingIds(ctx, tr);
					// Not an edit: the plugins' answers to an edit (paragraph breaks, a last empty line) are not given it,
					// as they are not given the first part.
					view.updateState((view.state as Applying).applyInner(tr));
					return tr.doc.slice(at, at + doc.content.size).content;
				});
				asShown = asShown.replace(end, end, new Slice(unwritten, 0, 0));
				end += unwritten.size;
				await nextFrame();
				if (showing !== shownCount) return null;
			}
			reported = asShown;
			// What was typed meanwhile, as an edit: once the article is settled as shown (when mount has returned).
			setTimeout(report);
			return withoutTrailingEmptyLines(write(asShown));
		} finally {
			if (showing === shownCount) {
				loading = false;
				root.removeAttribute('aria-busy');
			}
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

	/**
	 * A heading's section made a page under the article (as SiYuan turns a
	 * heading into a document): its text there, the heading its title, the
	 * files it names copied along; in its place, a link to the new page. Taken
	 * back (⌘Z) if the page could not be made.
	 */
	async function splitToPage(view: EditorView, pos: number): Promise<void> {
		if (!crepe) return;
		const section = headingSection(view.state.doc, pos);
		const slug = host.subPage.plan();
		if (!section || !slug) return;
		const { doc, schema } = view.state;
		const heading = doc.nodeAt(section.from)!;
		const content = doc.slice(section.from + heading.nodeSize, section.to).content;
		const page = schema.topNodeType.createAndFill(null, content) ?? schema.topNodeType.createAndFill()!;
		const body = crepe.editor.action((ctx) => withoutTrailingEmptyLines(ctx.get(serializerCtx)(page)));
		const title = section.title || '无标题'; // i18n-ignore: saved as the page's title
		const link = schema.marks.link?.create({ href: `/blog/${slug}/`, title: null });
		const paragraph = schema.nodes.paragraph!.create(null, schema.text(title, link ? [link] : []));
		const before = view.state.doc;
		view.dispatch(view.state.tr.replaceWith(section.from, section.to, paragraph).scrollIntoView());
		const after = view.state.doc;
		if (await host.subPage.make(slug, title, body, filesNamed(body))) return;
		// Not made: the section back, if nothing was done since.
		if (view.state.doc === after) view.dispatch(view.state.tr.replaceWith(0, after.content.size, before.content));
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
		hasSelection: () => crepe?.editor.action((ctx) => !ctx.get(editorViewCtx).state.selection.empty) ?? false,
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
		markInstructing(id) {
			crepe?.editor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				const { $from, $to } = view.state.selection;
				// The whole top-level blocks the selection is in, as markSelection takes them.
				const from = $from.depth ? $from.before(1) : $from.pos;
				const to = $to.depth ? $to.after(1) : $to.pos;
				view.dispatch(view.state.tr.setMeta(instructingKey, { add: { id, from, to } }).setMeta('addToHistory', false));
			});
		},
		unmarkInstructing(id) {
			crepe?.editor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				view.dispatch(view.state.tr.setMeta(instructingKey, { remove: id }).setMeta('addToHistory', false));
			});
		},
		focusStart,
		settle: report,
		// A review of a long article waits for all of it to be in.
		review: (body) => loaded.then(() => startReview(body)),
		acceptAll: () => crepe?.editor.action(callCommand(acceptAllDiffsCmd.key)),
		rejectAll: () => crepe?.editor.action(callCommand(clearDiffReviewCmd.key)),
	};
}
