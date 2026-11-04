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
import { blockFeelPlugins, buildBlockMenu, buildToolbarAsk, buildToolbarClear, buildToolbarTurn } from './block-menu';
import { filesNamed, headingSection } from './split-section';
import type { FileClick } from '../files/file-open';
import { openFileLinks } from './file-links';
import { DATABASE_TYPE, databasePlugins } from './database/database-block';
import { findPlugins } from './find-in-article';
import { canSaveAsFile, codeFileLanguageDescriptions, codeFilePath, codeFilePreview, observeCodeFiles, redrawCodeFiles, saveCodeBlockAsFile } from './code-files';
import type { HastElement } from '@blog/markdown/code-files/render.mjs';
import { blockwiseMarkdown } from './blockwise-markdown';
import { isLongArticle, LONG, OPENING, setReach } from '@blog/editor-kit/near-screen.ts';
import { displayMathPlugins } from '@blog/editor-kit/math/display-math.ts';
import { articleFileDrop, replaceSlashImageItem, type ArticleFileDropHost } from './file-drop';
import { articleLinkPlugins, refreshPageLines, type ArticleLinkHost } from './article-links';
import { blockToLink, linkTargets, replaceBlock } from './link-embeds';
import { smartPastePlugins } from './smart-paste';
import { blockKeyPlugins } from './block-key-plugins';
import { selectBlockForHandle } from './block-range';
import { addInlineFormulaItem, buildBlockSlashMenu, buildCommandSlashMenu, type SlashMenuBuilder } from './block-slash-menu';
import { calloutPlugins } from './callout-block';
import { citationPlugins, setCitationLibrary, type CitationHost } from './citations';
import { officeCardPlugins } from './office-card-block';
import type { BibEntry } from '@blog/markdown/references/bibtex.mjs';
import { FIGURE_TYPE, figurePlugins } from './figure-block';
import { inlineMathPlugins } from '@blog/editor-kit/math/inline-math.ts';
import { mathBracketsRemark } from '@blog/editor-kit/math/math-brackets.ts';
import { addSearchWords, SLASH_INLINE_TRIGGERS, SLASH_TRIGGERS } from './slash-search';
import { clickIntoCodeBlocks } from './code-block-clicks';
import { withoutTrailingEmptyLines } from '@blog/document/index.ts';
import { bodyParts } from '@blog/document/parse.ts';
import { BookText, bookHeadings, CHUNK, formulaCount, isBook, type BookHeading } from './book-window.ts';
import { ANCHORED, type Anchored } from '../pages/scroll-anchor.ts';
import type { MarkdownBlockSlice } from '@blog/document/types.ts';
import { SELECTION_END, SELECTION_START } from '@blog/document/source-lines.ts';
import { togglePlugins } from './toggle-block';
import { columnsPlugins } from './columns-block';
import { sourcePlugins } from './retainpdf-source';
import { pluginBlocks, pluginSlashCommands } from '../plugins';
import { runCommand } from '../plugin-ui';
import { t } from '@blog/i18n/index.mjs';
import { showToast } from '../common/toast';

/** What the editor needs from the Studio around it. */
export type StudioEditorHost = {
	/** Uploads for files dropped, pasted or picked in the editor. */
	files: ArticleFileDropHost;
	/** Where to load a file the article links to (`./img/a.png`) from. */
	fileUrl(src: string): string;
	/** A code block's `@file ./assets/opt.log`, drawn as the blog draws it. */
	codeFile(reference: string, language: string, meta: string): Promise<HastElement>;
	/** A file of the article opened to edit (a code file's 编辑, or a double-click on it). */
	editFile(path: string): void;
	/** /模板: a template chosen, its content put where the caret is in `view`. */
	insertTemplate(view: EditorView): void;
	/** A file of the article a link names, clicked: opened as chosen for that click (file-open.ts). */
	openFile(path: string, click: FileClick): void;
	/** A file card's ⋯: what can be done to its file, by `anchor`. */
	fileMenu(path: string, anchor: HTMLElement): void;
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
	/** Shows a body (book-window.ts for a book's); `again`: the article open, shown anew where it was. Resolves with its Markdown. */
	mount(body: string, again?: boolean, options?: { windowed?: boolean; from?: number }): Promise<string>;
	/** A book's: where its window starts in it (characters before it); null for an article held whole. */
	bookStart(): number | null;
	/** A book's headings, all of them (the outline's); null for an article held whole. */
	bookHeadings(): BookHeading[] | null;
	/** A book's window opened at `at` (an offset in it): what is there shown, to be gone to. */
	revealBook(at: number): Promise<void>;
	/** The caret at the start of the body. */
	focusStart(): void;
	/** A new block at the top, holding `text`, the caret at its start (Enter in the title); the empty one there, if it is. */
	startNewBlock(text?: string): void;
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
	/** The words selected (as text, a line for each block); empty for none, or for a block selected whole (a picture, a formula). */
	selectedWords(): string;
	/** The article's library (assets/refs.bib), to number its citations by; null when it has none. */
	setLibrary(library: Map<string, BibEntry> | null): void;
	/**
	 * Puts Markdown in as blocks of their own: where the caret is, or after the last block (`end`, the caret then in
	 * an empty paragraph after it); scrolled to. The first block put in (its element), to show it; null when nothing was put in.
	 * `focus`: the keys given the editor after, the caret after what was put in (摘到笔记 from a book beside: written on at once).
	 */
	insertMarkdown(markdown: string, where?: 'caret' | 'end', options?: { focus?: boolean }): HTMLElement | null;
	/**
	 * Where the next passage quoted goes, marked faintly while the editor has not the keys (a book beside it, read): at the
	 * caret, after the last block (`end`), or nowhere (null).
	 */
	showQuoteSpot(where: 'caret' | 'end' | null): void;
	/** The ProseMirror view of the article shown; null before one is. */
	view(): EditorView | null;
	/** The article's files listed anew (their sizes known): the file cards drawn again. */
	filesListed(): void;
	/** The previews of the article's file `path` drawn again: it was changed (edited, saved). */
	redrawCodeFile(path: string): void;
};

/** Each editor's writer: its blocks' Markdown, remembered (a long article is not written whole at every edit). */
/** The link preview's: where a link goes (lucide's globe), and copy it (lucide's copy). */
const GLOBE_ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
/** The fork's: a copy button of its own (the link icon then only shows); spread, the npm types not knowing it. */
const LINK_COPY = {
	copyButton:
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
};

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

/**
 * What is selected, still shown when the article is left for something else (the AI panel's input, a menu): the
 * browser shows no selection where it has no focus, and what the AI is told of (选中的内容) would not be seen.
 */
const keptSelectionKey = new PluginKey<boolean>('studio-kept-selection');
const keptSelection = $prose(
	() =>
		new Plugin<boolean>({
			key: keptSelectionKey,
			state: {
				init: () => false,
				apply: (tr, away) => (tr.getMeta(keptSelectionKey) as boolean | undefined) ?? away,
			},
			props: {
				decorations(state) {
					const { selection } = state;
					if (!keptSelectionKey.getState(state) || selection.empty || !(selection instanceof TextSelection)) return null;
					return DecorationSet.create(state.doc, [Decoration.inline(selection.from, selection.to, { class: 'is-kept-selection' })]);
				},
				handleDOMEvents: {
					blur(view) {
						if (!view.state.selection.empty) view.dispatch(view.state.tr.setMeta(keptSelectionKey, true).setMeta('addToHistory', false));
						return false;
					},
					focus(view) {
						if (keptSelectionKey.getState(view.state)) view.dispatch(view.state.tr.setMeta(keptSelectionKey, false).setMeta('addToHistory', false));
						return false;
					},
				},
			},
		}),
);

/**
 * Where the next passage quoted goes (showQuoteSpot): a faint mark at the caret, or a line after the last block; not while
 * the editor has the keys (the caret says it then, studio-page.css).
 */
const quoteSpotKey = new PluginKey<'caret' | 'end' | null>('studio-quote-spot');
const quoteSpot = $prose(
	() =>
		new Plugin<'caret' | 'end' | null>({
			key: quoteSpotKey,
			state: {
				init: () => null,
				apply: (tr, where) => (tr.getMeta(quoteSpotKey) as 'caret' | 'end' | null | undefined) ?? where,
			},
			props: {
				decorations(state) {
					const where = quoteSpotKey.getState(state);
					if (!where) return null;
					const at = where === 'end' ? state.doc.content.size : state.selection.head;
					const mark = () => {
						const element = document.createElement(where === 'end' ? 'div' : 'span');
						element.className = `quote-spot quote-spot-${where}`;
						element.contentEditable = 'false';
						if (where === 'end') element.textContent = t('摘录放这里');
						return element;
					};
					return DecorationSet.create(state.doc, [Decoration.widget(at, mark, { side: where === 'end' ? 1 : -1, key: `quote-spot-${where}`, ignoreSelection: true })]);
				},
			},
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

/** A book's window (book-window.ts): the next chunk taken in this many screens from its end; kept at most this many screens long, what is more than KEPT_SCREENS from the screen let go. */
const BOOK_LOAD_SCREENS = 2;
const WINDOW_SCREENS = 12;
const KEPT_SCREENS = 3;
/** What of a book's window is drawn at once (near-screen.ts): once something waits within a screen of it, the screen and half a screen round it. */
const BOOK_REACH = { look: [-1, 2] as [number, number], draw: [-0.5, 1.5] as [number, number] };
/** How long after the last scroll the window's far ends are let go (ms). */
const TRIM_AFTER = 300;
/** How long the page has to have stood still for the text above the screen to be moved (ms): put in, let go. */
const STILL_AFTER = 150;

/** How many blocks of an article just opened are written as Markdown at a frame (a few milliseconds' work). */
const WRITTEN_AT_A_FRAME = 40;

const nextFrame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done)));

/** The Studio's editor: Crepe with the plugins' blocks, formulas, file drops and block feel. */
export function createStudioEditor(root: HTMLElement, host: StudioEditorHost): StudioEditor {
	clickIntoCodeBlocks(root);
	let crepe: Crepe | null = null;
	let mounting = false;
	/** The article is being opened, till it is first shown: its formulas far from the screen are drawn after (near-screen.ts). */
	let beingOpened = false;
	/** The article shown is a long one, put in a part at a time; `loading` till the last is in. */
	let inParts = false;
	/** About how many formulas the article shown has, all of it (its `$`s halved): a book's are drawn only near the screen. */
	let formulas = 0;
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
	/** A book's text round the window the editor holds (book-window.ts); null for an article held whole. */
	let book: BookText | null = null;
	/** The whole body, from what the editor holds as Markdown: a book's window put back between what is round it. */
	const whole = (markdown: string): string => (book ? book.full(markdown) : markdown);

	/** Reports the body, when it is an edit and not what was reported already. */
	function report(): void {
		if (!crepe || mounting || loading || review) return;
		crepe.editor.action((ctx) => {
			const { doc } = ctx.get(editorViewCtx).state;
			if (reported?.eq(doc)) return;
			reported = doc;
			host.changed(whole(markdownOf(crepe!)));
		});
	}
	/**
	 * A book's window moved as it is scrolled (book-window.ts), as SiYuan's: near its end, the next chunk in after it;
	 * near its start, the one before; once it is more than WINDOW_SCREENS screens, the blocks far from the screen at
	 * the other end let go (written back as Markdown round it). Where the reader is stays where it is: a block kept is
	 * measured before and after, and the editor scrolled by the difference. Not edits: nothing to undo, nothing reported.
	 */
	const scroller = (): HTMLElement | null => root.closest<HTMLElement>('.editor-scroll');
	let sliding = 0;
	/** Let go once the scrolling stops, not as it goes (it is a frame's work of its own). */
	let trimming = 0;
	/** The next chunk read (a frame's work), to be put in at the next frame: read and put in at once, a frame was long. */
	let prepared: { book: BookText; side: 'after' | 'before'; text: string; parsed: ProseNode } | null = null;
	/** When the page was last scrolled: what moves the text above the screen waits till it has stopped a while. */
	let scrolledAt = 0;
	let waitingStill = 0;
	const still = () => performance.now() - scrolledAt > STILL_AFTER;
	function slideSoon(): void {
		if (!book) return;
		sliding ||= requestAnimationFrame(slide);
	}
	document.addEventListener(
		'scroll',
		() => {
			if (!book) return;
			scrolledAt = performance.now();
			slideSoon();
			window.clearTimeout(trimming);
			trimming = window.setTimeout(trimSoon, TRIM_AFTER);
		},
		{ capture: true, passive: true },
	);

	function slide(): void {
		sliding = 0;
		const port = scroller();
		if (!book || !crepe || !port || mounting || loading || review) return;
		const shown = book;
		crepe.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const screen = port.clientHeight;
			const box = view.dom.getBoundingClientRect();
			const sight = port.getBoundingClientRect();
			// More at that end: in the text round the window, or read already to be put in.
			const more = (side: 'after' | 'before') => (prepared?.book === shown && prepared.side === side) || (side === 'after' ? shown.hasAfter : shown.hasBefore);
			const side = box.bottom - sight.bottom < BOOK_LOAD_SCREENS * screen && more('after') ? 'after' : sight.top - box.top < BOOK_LOAD_SCREENS * screen && more('before') ? 'before' : null;
			// Scrolled on and on: let go as it goes too, once the window is more than twice as long as it is kept (one
			// piece a frame, before anything is put in). Not above the screen while it is being scrolled (unless it is
			// far too long): what goes there moves the text, the scroll keeps it in place, and WebKit stops the wheel's.
			const far = side === 'before' ? 'after' : 'before';
			if (box.height > 2 * WINDOW_SCREENS * screen && (far === 'after' || still() || box.height > 4 * WINDOW_SCREENS * screen) && letGo(view, far)) {
				slideSoon();
				return;
			}
			if (!side) return;
			// What goes in above the screen, the same: once the scrolling has stopped (read meanwhile).
			if (side === 'before' && prepared?.side === 'before' && prepared.book === shown && !still()) {
				window.clearTimeout(waitingStill);
				waitingStill = window.setTimeout(slideSoon, STILL_AFTER);
				return;
			}
			// Read this frame, put in the next.
			if (prepared?.book !== shown || prepared.side !== side) {
				unprepare();
				const text = side === 'after' ? shown.takeAfter() : shown.takeBefore();
				if (text !== null) prepared = { book: shown, side, text, parsed: ctx.get(parserCtx)(text) };
			} else {
				takeIn(ctx, view, prepared.side, prepared.parsed);
				prepared = null;
			}
			slideSoon();
		});
	}

	/** A chunk read and not put in (scrolled the other way meanwhile): back where it was. */
	function unprepare(): void {
		if (!prepared) return;
		if (prepared.side === 'after') prepared.book.putAfter(prepared.text);
		else prepared.book.putBefore(prepared.text);
		prepared = null;
	}

	/** A chunk read (`parsed`) put in after the window's end, or before its start. */
	function takeIn(ctx: Ctx, view: EditorView, side: 'after' | 'before', parsed: ProseNode): void {
		// Typed and not reported yet: reported with the window as it is, before it moves.
		report();
		const { state } = view;
		let tr = state.tr;
		if (side === 'after') {
			// Before the empty line the editor keeps last.
			const $at = state.doc.resolve(nextPartKey.getState(state)!);
			const at = $at.depth ? $at.after(1) : $at.pos;
			tr = tr.insert(at, parsed.content).setMeta(nextPartKey, at + parsed.content.size);
		} else {
			tr = tr.insert(0, parsed.content);
		}
		tr.setMeta('addToHistory', false);
		syncHeadingIds(ctx, tr);
		stayingPut(view, () => view.updateState((view.state as Applying).applyInner(tr)));
		reported = view.state.doc;
	}

	/** Scrolling stopped: the window's far ends let go, a piece a frame, till it is WINDOW_SCREENS screens or less. */
	function trimSoon(): void {
		trimming = 0;
		if (!book || !crepe || mounting || loading || review) return;
		const more = crepe.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			return letGo(view, 'before') || letGo(view, 'after');
		});
		if (more) trimming = window.setTimeout(trimSoon, 0);
	}

	/**
	 * Lets the window's blocks at `side` go, far from the screen, while it is longer than WINDOW_SCREENS screens: they
	 * go back to the text round it as Markdown. The caret in one of them is put where they were (the window's edge): far
	 * from the screen it is not being typed at, and kept, it would keep all the book between it and the screen.
	 */
	function letGo(view: EditorView, side: 'before' | 'after'): boolean {
		const port = scroller();
		if (!book || !crepe || !port) return false;
		const screen = port.clientHeight;
		if (view.dom.getBoundingClientRect().height < WINDOW_SCREENS * screen) return false;
		const sight = port.getBoundingClientRect();
		const { doc } = view.state;
		/** The top-level blocks, each where it starts and its element. */
		const blocks: Array<{ from: number; to: number; node: ProseNode; element: Element | null }> = [];
		doc.forEach((node, offset) => blocks.push({ from: offset, to: offset + node.nodeSize, node, element: view.nodeDOM(offset) as Element | null }));
		// Not the empty line the editor keeps last.
		if (doc.lastChild?.type.name === 'paragraph' && !doc.lastChild.content.size) blocks.pop();
		const far = side === 'before'
			? (block: (typeof blocks)[number]) => block.element !== null && block.element.getBoundingClientRect().bottom < sight.top - KEPT_SCREENS * screen
			: (block: (typeof blocks)[number]) => block.element !== null && block.element.getBoundingClientRect().top > sight.bottom + KEPT_SCREENS * screen;
		// A chunk's worth at most, from the far end: let go a piece at a time, each a chunk to come back as.
		const gone: typeof blocks = [];
		let size = 0;
		const order = side === 'before' ? blocks.slice(0, -1) : blocks.slice(1).reverse();
		for (const block of order) {
			if (!far(block) || size >= CHUNK) break;
			gone.push(block);
			size += block.node.textContent.length + 2;
		}
		if (!gone.length) return false;
		if (side === 'after') gone.reverse();
		const [from, to] = [gone[0]!.from, gone.at(-1)!.to];
		const markdown = withoutTrailingEmptyLines(writerOf(crepe)(doc.copy(doc.slice(from, to).content)));
		if (side === 'before') book.putBefore(markdown);
		else book.putAfter(markdown);
		const tr = view.state.tr.delete(from, to).setMeta('addToHistory', false);
		stayingPut(view, () => view.updateState((view.state as Applying).applyInner(tr)));
		reported = view.state.doc;
		return true;
	}

	/**
	 * Does `change` to the window with what is read kept where it is: the first block on the screen measured before and
	 * after, the page scrolled by the difference; the page's own keeping (scroll-anchor.ts) told, not to do it again.
	 * ProseMirror keeps a place of its own as it draws a new state, by scrolling every element round the editor (the
	 * editor's panel too, which does not scroll, and was left moved, the wheel no longer reaching the page): undone.
	 */
	function stayingPut(view: EditorView, change: () => void): void {
		const port = scroller();
		const sight = port?.getBoundingClientRect();
		const blocks = [...view.dom.children] as HTMLElement[];
		const anchor = (sight && blocks.find((block) => block.getBoundingClientRect().bottom > sight.top)) || blocks[0];
		const before = anchor?.getBoundingClientRect().top;
		const round: Array<[Element, number, number]> = [];
		for (let element: Element | null = view.dom.parentElement; element; element = element.parentElement) round.push([element, element.scrollTop, element.scrollLeft]);
		change();
		for (const [element, top, left] of round) {
			if (element.scrollTop !== top) element.scrollTop = top;
			if (element.scrollLeft !== left) element.scrollLeft = left;
		}
		if (port && anchor?.isConnected && before !== undefined) port.scrollTop += anchor.getBoundingClientRect().top - before;
		port?.dispatchEvent(new CustomEvent<Anchored | undefined>(ANCHORED, { detail: anchor && before !== undefined ? { block: anchor, top: before } : undefined }));
	}

	observeCodeFiles(root);
	// A link to a file of the article: a click opens it (in the Studio, with its program, in Finder: as chosen).
	openFileLinks(root, (path, click) => host.openFile(path, click), (path, anchor) => host.fileMenu(path, anchor));
	// A file's preview: 编辑, or a double-click on it, opens the file to edit. Before ProseMirror (it would select the block).
	root.addEventListener(
		'click',
		(event) => {
			const shown = (event.target as Element).closest('[data-code-action="edit"]')?.closest('figure.code-file');
			const path = shown && codeFilePath(shown);
			if (!path) return;
			event.preventDefault();
			event.stopPropagation();
			host.editFile(path);
		},
		true,
	);
	root.addEventListener(
		'dblclick',
		(event) => {
			const target = event.target as Element;
			const shown = target.closest('figure.code-file[data-file-path]');
			const path = shown && !target.closest('button, a') ? codeFilePath(shown) : null;
			if (!path) return;
			event.preventDefault();
			event.stopPropagation();
			host.editFile(path);
		},
		true,
	);
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
						const long = inParts || book !== null || isLongArticle(state.doc);
						const classes = [...(long ? [LONG] : []), ...(beingOpened ? [OPENING] : [])];
						return { ...(classes.length ? { class: classes.join(' ') } : {}), ...(long ? { 'data-formulas': String(formulas) } : {}) };
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
				buildBlockSlashMenu(builder as unknown as SlashMenuBuilder, host, blocks, { pick: (view) => host.insertTemplate(view) });
				buildCommandSlashMenu(builder as unknown as SlashMenuBuilder, commands, (command) => runCommand(command, 'slash'));
				replaceSlashImageItem(builder, fileDrop.chooseImages);
				addInlineFormulaItem(builder as unknown as Parameters<typeof addInlineFormulaItem>[0]);
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
						// A plugin's code block (a widget's frame) previews as its plugin says; one changed by what its
						// preview shows keeps it (undefined: what is shown stays), not drawn again (a frame would load again).
						if (codeBlocks.some((code) => code.keep?.(language, content, meta))) return undefined;
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
						buildToolbarClear(builder);
						buildToolbarAsk(builder, () => host.askAI());
					},
				},
				// Pointed at, a link says where it goes, as Notion's: 🌐 the address, copy, 编辑 (a click opens it: article-links.ts).
				[CrepeFeature.LinkTooltip]: {
					inputPlaceholder: t('粘贴链接…'),
					linkIcon: GLOBE_ICON,
					...LINK_COPY,
					editButton: `<span>${t('编辑')}</span>`,
					removeButton: '',
					onCopyLink: () => showToast(t('已复制链接')),
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
		// Where a passage quoted from RetainPDF is: its mark (retainpdf-source.ts).
		crepe.editor.use(sourcePlugins());
		crepe.editor.use(officeCardPlugins(host.fileUrl));
		crepe.editor.use(togglePlugins());
		crepe.editor.use(columnsPlugins());
		crepe.editor.use(articleLinkPlugins(host));
		// ```database: the pages under this one as a table or a board (database/).
		crepe.editor.use(databasePlugins);
		// ⌘F in the article: the places found marked (find-in-article.ts).
		crepe.editor.use(findPlugins());
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
					customBlockTypes: ['table', 'image-block', FIGURE_TYPE, DATABASE_TYPE, 'code_block', ...blocks.flatMap((block) => block.drawnWhole ?? [])],
				}));
			})
			.use(diff)
			.use(diffComponent)
			.use(reviewWatch)
			.use(longArticle)
			.use(nextPart)
			.use(keptSelection)
			.use(quoteSpot);
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

	/**
	 * Shows `body` in the editor. `again`: the article open shown anew (changed on disk), where it was: all at once, not a
	 * part at a time. A book is shown a window at a time (book-window.ts), opened where the window was (`again`), or at
	 * `from` (an offset in it), unless `windowed` is false (to be reviewed, all of it). Resolves with the Markdown the
	 * editor writes for all of the body.
	 */
	async function mount(fullBody: string, again = false, { windowed = true, from = 0 }: { windowed?: boolean; from?: number } = {}): Promise<string> {
		const opened = windowed && isBook(fullBody) ? BookText.open(fullBody, again && book ? book.start : from) : null;
		const shownBook = (book = opened?.book ?? null);
		const body = opened?.window ?? fullBody;
		const markdown = await mountShown(body, again);
		// A book's window: its formulas drawn near the screen only at once (near-screen.ts), the rest a few at a frame.
		const element = root.querySelector<HTMLElement>('.ProseMirror');
		if (element && book === shownBook) setReach(element, book ? BOOK_REACH : null);
		// Shown as written, or another article shown meanwhile: the body as it was.
		if (markdown === body) return fullBody;
		return shownBook ? shownBook.full(markdown) : markdown;
	}

	async function mountShown(body: string, whole: boolean): Promise<string> {
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
		// A book's window: its formulas all drawn, a few at a frame (near-screen.ts), as a short article's.
		formulas = book ? 0 : formulaCount(body);
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
			return whole(withoutTrailingEmptyLines(ctx.get(serializerCtx)(marked)));
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

	function startNewBlock(text = ''): void {
		crepe?.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const { state } = view;
			const paragraph = state.schema.nodes.paragraph;
			const first = state.doc.firstChild;
			if (!paragraph) return;
			let tr = state.tr;
			if (first?.type === paragraph && !first.content.size) {
				if (text) tr = tr.insertText(text, 1);
			} else tr = tr.insert(0, paragraph.create(null, text ? state.schema.text(text) : null));
			view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)).scrollIntoView());
			view.focus();
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

	/** Markdown put in as blocks (insertMarkdown, without what is done after). */
	function putMarkdown(markdown: string, where: 'caret' | 'end'): HTMLElement | null {
		return (
			crepe?.editor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				if (where === 'end') {
					const parsed = ctx.get(parserCtx)(markdown);
					if (!parsed?.content.size) return null;
					const at = view.state.doc.content.size;
					// An empty paragraph after it for the caret: written on below what was put in, not inside it (the
					// caret at the end of a code block would open it for editing).
					const tr = view.state.tr.insert(at, parsed.content.append(Fragment.from(view.state.schema.nodes.paragraph.create())));
					view.dispatch(tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1)).scrollIntoView());
					return view.nodeDOM(at) instanceof HTMLElement ? (view.nodeDOM(at) as HTMLElement) : null;
				}
				insert(markdown)(ctx);
				// The block put in: the top-level one the caret is left in (at its end), or the one before when the
				// caret is between blocks or in the empty paragraph left after it.
				const { doc, selection } = view.state;
				const { $from } = selection;
				let index = $from.depth === 0 ? $from.index(0) - 1 : $from.index(0);
				if ($from.depth > 0 && index > 0 && doc.child(index).isTextblock && !doc.child(index).content.size) index -= 1;
				index = Math.max(0, Math.min(index, doc.childCount - 1));
				let pos = 0;
				for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
				const dom = view.nodeDOM(pos);
				return dom instanceof HTMLElement ? dom : null;
			}) ?? null
		);
	}

	/** The whole body as the editor holds it now, a book's window and all. */
	const wholeNow = (): string => (crepe ? whole(markdownOf(crepe)) : '');

	return {
		bookStart: () => book?.start ?? null,
		bookHeadings: () => (book ? bookHeadings(wholeNow()) : null),
		async revealBook(at) {
			if (!book || !crepe || mounting || loading || review) return;
			// Typed and not reported: reported first, the window's place left after.
			report();
			await mount(wholeNow(), false, { from: at });
		},
		markSelection,
		hasSelection: () => crepe?.editor.action((ctx) => !ctx.get(editorViewCtx).state.selection.empty) ?? false,
		selectedWords: () =>
			crepe?.editor.action((ctx) => {
				const { selection, doc } = ctx.get(editorViewCtx).state;
				return selection instanceof TextSelection ? doc.textBetween(selection.from, selection.to, '\n', ' ') : '';
			}) ?? '',
		showQuoteSpot(where) {
			crepe?.editor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				if (quoteSpotKey.getState(view.state) !== where) view.dispatch(view.state.tr.setMeta(quoteSpotKey, where).setMeta('addToHistory', false));
			});
		},
		insertMarkdown(markdown, where = 'caret', { focus = false } = {}) {
			const placed = putMarkdown(markdown, where);
			if (placed && focus) crepe?.editor.action((ctx) => ctx.get(editorViewCtx).focus());
			return placed;
		},
		redrawCodeFile(path) {
			redrawCodeFiles(root, path, host.codeFile);
		},
		filesListed() {
			if (!crepe || mounting) return;
			try {
				crepe.editor.action((ctx) => refreshPageLines(ctx.get(editorViewCtx)));
			} catch {
				// Not made yet: drawn with the sizes as it is made.
			}
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
		startNewBlock,
		settle: report,
		// A review of a long article waits for all of it to be in; a book's, for all of it to be in the editor (the
		// differences may be anywhere in it), as a long article's is.
		async review(body) {
			if (book && crepe) await mount(book.full(markdownOf(crepe)), false, { windowed: false });
			return loaded.then(() => startReview(body));
		},
		acceptAll: () => crepe?.editor.action(callCommand(acceptAllDiffsCmd.key)),
		rejectAll: () => crepe?.editor.action(callCommand(clearDiffReviewCmd.key)),
	};
}
