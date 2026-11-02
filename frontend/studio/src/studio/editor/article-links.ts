import type { MilkdownPlugin } from '@milkdown/ctx';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { ARTICLE_ADDRESS } from '@blog/markdown/articles/rules.mjs';
import { changedRange } from '@blog/editor-kit/changed-range.ts';
import { fileKind, fileKindName, fileSize } from '@blog/markdown/files/file-kinds.mjs';
import { linkedArticleFile } from './file-links';

/**
 * Links to the blog's other articles, as Notion links its pages: `[[` opens
 * the article finder and the chosen one comes in as an ordinary Markdown
 * link to its address (`[标题](/blog/slug/)`). In a sentence such a link
 * shows as a page (its icon before it, pm-article-mention) and a click opens
 * that article here.
 *
 * And pages, as Notion's: 页面 (/page) makes a page under the article and
 * puts a line linking to it where the caret is; a line that is only a link to
 * one of the blog's articles shows as a page (pm-page-link), opened with a
 * click. Its words follow the page's title (the server changes them as the
 * page is retitled), and it is the Markdown link it was.
 */

/** What the links need from the Studio around the editor. */
export type ArticleLinkHost = {
	/** Asks which article to link to; null when given up. */
	pickArticle(): Promise<{ title: string; href: string } | null>;
	/** Opens an article of the blog in the Studio. */
	openArticle(slug: string): void;
	/** The title of one of the blog's articles; null when there is none by that name. */
	articleTitle(slug: string): string | null;
	/** 页面: a page made under the article shown, to link to; null when it could not be. */
	makePage(): Promise<{ slug: string; title: string; href: string } | null>;
	/** Goes into the page just made (the article linking to it saved first), its title to be typed. */
	enterPage(slug: string): void;
	/** How large a file of the article is (its card says so); null while not known. */
	fileSize?(path: string): number | null;
	/** `@`: a page, or a file (the article's, or the drive's copied into it), as a link's words and address; null when given up. */
	pickMention?(): Promise<{ title: string; href: string } | null>;
};

/**
 * 页面, as Notion's /page: a page made under the article, a line linking to it where the caret is (in a block emptied
 * for it), and the editor goes into it.
 */
export async function insertPage(view: EditorView, host: ArticleLinkHost): Promise<void> {
	const at = view.state.selection.from;
	const page = await host.makePage();
	const link = view.state.schema.marks.link;
	if (!page || !link || view.isDestroyed) return;
	const pos = Math.min(at, view.state.doc.content.size);
	view.dispatch(view.state.tr.insert(pos, view.state.schema.text(page.title, [link.create({ href: page.href, title: null })])));
	host.enterPage(page.slug);
}

/** The article a paragraph links to when it is that link and nothing else; null for any other block. */
function pageLinked(node: ProseNode): string | null {
	if (node.type.name !== 'paragraph' || !node.childCount) return null;
	let href: string | null = null;
	let alone = true;
	node.forEach((child) => {
		const link = child.isText ? child.marks.find((mark) => mark.type.name === 'link') : undefined;
		const address = link ? String(link.attrs.href ?? '') : null;
		if (!address || (href !== null && address !== href)) alone = false;
		href ??= address;
	});
	return alone && href ? (ARTICLE_ADDRESS.exec(href)?.[2] ?? null) : null;
}

/** The article a link mark goes to; null for a link elsewhere (or no link). */
function linkedArticle(node: ProseNode): { href: string; slug: string } | null {
	const link = node.isText ? node.marks.find((mark) => mark.type.name === 'link') : undefined;
	const href = link ? String(link.attrs.href ?? '') : '';
	const slug = ARTICLE_ADDRESS.exec(href)?.[2];
	return slug ? { href, slug } : null;
}

/** The file of the article a link mark goes to (`./assets/opt.py`); null for any other link (or none). */
function linkedFile(node: ProseNode): { href: string; path: string } | null {
	const link = node.isText ? node.marks.find((mark) => mark.type.name === 'link') : undefined;
	const href = link ? String(link.attrs.href ?? '') : '';
	const path = href ? linkedArticleFile(href) : null;
	return path ? { href, path } : null;
}

/** The file a paragraph links to when it is that link and nothing else (spaces aside); null for any other block. */
function fileLined(node: ProseNode): string | null {
	if (node.type.name !== 'paragraph' || !node.childCount) return null;
	let found: string | null = null;
	let alone = true;
	node.forEach((child) => {
		if (child.isText && !child.marks.some((mark) => mark.type.name === 'link') && !child.text?.trim()) return;
		const file = linkedFile(child);
		if (!file || (found !== null && found !== file.path)) alone = false;
		found ??= file?.path ?? null;
	});
	return alone ? found : null;
}

/** What a file card says after its name: what the file is, how large (once known), and its ⋯. */
function fileCardMeta(path: string, size: number | null): HTMLElement {
	const meta = document.createElement('span');
	meta.className = 'pm-file-card-meta';
	meta.contentEditable = 'false';
	meta.textContent = [fileKindName(fileKind(path)), size === null ? '' : fileSize(size)].filter(Boolean).join(' · ');
	const more = document.createElement('button');
	more.type = 'button';
	more.className = 'pm-file-card-more';
	more.dataset.fileMenu = path;
	more.textContent = '⋯';
	meta.append(more);
	return meta;
}

/**
 * The links to articles in a block that is more than one (at `pos`): each shown as a page, its icon before its first
 * piece (a link partly bold is pieces of text). The links to the article's files there: each marked by its kind's icon.
 */
function mentions(node: ProseNode, pos: number): Decoration[] {
	const found: Decoration[] = [];
	let previous: string | null = null;
	node.forEach((child, offset) => {
		const article = linkedArticle(child);
		const file = article ? null : linkedFile(child);
		const from = pos + 1 + offset;
		if (article) {
			const first = article.href !== previous;
			found.push(Decoration.inline(from, from + child.nodeSize, { class: first ? 'pm-article-mention pm-article-mention-start' : 'pm-article-mention' }));
		} else if (file) {
			const first = file.href !== previous;
			found.push(Decoration.inline(from, from + child.nodeSize, { class: first ? 'pm-file-mention pm-file-mention-start' : 'pm-file-mention', 'data-file-kind': fileKind(file.path) }));
		}
		previous = article?.href ?? file?.href ?? null;
	});
	return found;
}

/**
 * The page lines between `from` and `to` in `doc` (and in the blocks holding that stretch), and the pages linked in
 * sentences; the file cards (a file of the article linked alone on its line, but in a list) and the files linked in
 * sentences, `size` telling how large each is.
 */
function pageLines(doc: ProseNode, from: number, to: number, size: (path: string) => number | null = () => null): Decoration[] {
	const found: Decoration[] = [];
	doc.nodesBetween(from, to, (node, pos, parent) => {
		if (!node.isTextblock) return !node.isInline;
		const file = parent?.type.name === 'list_item' ? null : fileLined(node);
		if (pageLinked(node)) found.push(Decoration.node(pos, pos + node.nodeSize, { class: 'pm-page-link' }));
		else if (file) {
			const bytes = size(file);
			found.push(
				Decoration.node(pos, pos + node.nodeSize, { class: 'pm-file-card', 'data-file-kind': fileKind(file) }),
				Decoration.widget(pos + node.nodeSize - 1, () => fileCardMeta(file, bytes), { side: 1, ignoreSelection: true, key: `file-card:${file}:${bytes ?? ''}` }),
			);
		} else if (!node.type.spec.code) found.push(...mentions(node, pos));
		return false;
	});
	return found;
}

const pageLinesKey = new PluginKey<DecorationSet>('studio-page-lines');

/** The files of the article listed anew (their sizes known): its file cards drawn again. */
export function refreshPageLines(view: EditorView): void {
	view.dispatch(view.state.tr.setMeta(pageLinesKey, 'refresh').setMeta('addToHistory', false));
}

/**
 * Asks for an article and links it at `at`, as its title; given up, `typed`
 * goes back where it was (the `[[` that asked).
 */
export async function linkArticleAt(view: EditorView, host: ArticleLinkHost, at: number, typed = ''): Promise<void> {
	const chosen = await host.pickArticle();
	if (view.isDestroyed) return;
	const { state } = view;
	const pos = Math.min(at, state.doc.content.size);
	const link = state.schema.marks.link;
	let tr = state.tr;
	if (chosen && link) {
		tr = tr.insert(pos, state.schema.text(chosen.title, [link.create({ href: chosen.href, title: null })]));
		const end = pos + chosen.title.length;
		// Typing on after the link is not more of it.
		tr = tr.setSelection(TextSelection.create(tr.doc, end)).removeStoredMark(link);
	} else if (typed) {
		tr = tr.insertText(typed, pos).setSelection(TextSelection.create(tr.doc, pos + typed.length));
	}
	view.dispatch(tr.scrollIntoView());
	view.focus();
}

/**
 * `@` (as Notion's): a page, or a file (the article's own, or the drive's copied into it), linked where it was typed;
 * given up, the `@` stays as typed.
 */
async function mentionAt(view: EditorView, host: ArticleLinkHost, at: number): Promise<void> {
	const chosen = await host.pickMention!();
	if (view.isDestroyed) return;
	const { state } = view;
	const pos = Math.min(at, state.doc.content.size);
	const link = state.schema.marks.link;
	let tr = state.tr;
	if (chosen && link) {
		tr = tr.insert(pos, state.schema.text(chosen.title, [link.create({ href: chosen.href, title: null })]));
		tr = tr.setSelection(TextSelection.create(tr.doc, pos + chosen.title.length)).removeStoredMark(link);
	} else {
		tr = tr.insertText('@', pos).setSelection(TextSelection.create(tr.doc, pos + 1));
	}
	view.dispatch(tr.scrollIntoView());
	view.focus();
}

export function articleLinkPlugins(host: ArticleLinkHost): MilkdownPlugin[] {
	const plugin = $prose(
		() =>
			new Plugin({
				props: {
					// `[[`, or `【【` as a Chinese input method types it (one that pairs
					// brackets types `【】` at each press: the `】`s go too).
					handleTextInput(view, from, to, text) {
						// `@`, where it begins a word (not in an address: a@b.com), out of code; `[@` is a citation's (citations.ts).
						if ((text === '@' || text === '＠') && host.pickMention && from === to) {
							const { $from } = view.state.selection;
							const before = from > $from.start() ? view.state.doc.textBetween(from - 1, from) : '';
							if (!$from.parent.type.spec.code && !/[\w.%+\-[]/u.test(before)) {
								void mentionAt(view, host, from);
								return true;
							}
						}
						const open = text === '[' ? '[' : text === '【' || text === '【】' ? '【' : null;
						if (!open || from !== to || from < 1) return false;
						const { doc, selection } = view.state;
						if (selection.$from.parent.type.spec.code || doc.textBetween(from - 1, from) !== open) return false;
						const paired = open === '【' && doc.textBetween(from, Math.min(from + 1, selection.$from.end())) === '】';
						// The first bracket goes; the article finder asks the rest.
						view.dispatch(view.state.tr.delete(from - 1, paired ? from + 1 : from));
						void linkArticleAt(view, host, from - 1, open + open);
						return true;
					},
					handleClick(_view, _pos, event) {
						// A link opens with a click, as in Notion: a page here, a web address in the browser (Studio.app gives
						// it to the default one). Pointed at, it says where it goes, with 编辑 to change it (Crepe's link
						// preview); ⇧-click is the editor's (it selects). Links to the article's files: file-links.ts.
						if (event.shiftKey || event.button !== 0) return false;
						const link = (event.target as Element | null)?.closest?.('a[href]');
						const href = link?.getAttribute('href') ?? '';
						const slug = ARTICLE_ADDRESS.exec(href)?.[2];
						if (slug) {
							event.preventDefault();
							host.openArticle(slug);
							return true;
						}
						if (!/^(?:https?:|mailto:)/iu.test(href)) return false;
						event.preventDefault();
						window.open(href, '_blank', 'noopener');
						return true;
					},
				},
			}),
	);
	// What is typed at a link's end is not more of it (as Notion and Google Docs have it): the caret there, the marks to
	// type with are those but the link. ProseMirror's input methods follow them too (a cursor of those marks, out of the
	// <a>): Chinese typed after a link stayed in it, its spaces underlined.
	const linkEnds = $prose(
		() =>
			new Plugin({
				appendTransaction(_transactions, _old, state) {
					const { selection } = state;
					if (!(selection instanceof TextSelection) || !selection.$cursor || state.storedMarks) return null;
					const $cursor = selection.$cursor;
					const before = $cursor.nodeBefore;
					const link = before?.isText ? before.marks.find((mark) => mark.type.name === 'link') : undefined;
					if (!before || !link || ($cursor.nodeAfter && link.isInSet($cursor.nodeAfter.marks))) return null;
					return state.tr.setStoredMarks(link.removeFromSet(before.marks)).setMeta('addToHistory', false);
				},
			}),
	);
	const size = (path: string) => host.fileSize?.(path) ?? null;
	// Looked for at first in the whole article, then only round each edit (a long article has thousands of blocks).
	const pages = $prose(
		() =>
			new Plugin<DecorationSet>({
				key: pageLinesKey,
				state: {
					init: (_, state) => DecorationSet.create(state.doc, pageLines(state.doc, 0, state.doc.content.size, size)),
					apply(tr, lines, before, after) {
						if (tr.getMeta(pageLinesKey) === 'refresh') return DecorationSet.create(after.doc, pageLines(after.doc, 0, after.doc.content.size, size));
						if (!tr.docChanged) return lines;
						const mapped = lines.map(tr.mapping, tr.doc);
						const range = changedRange(before.doc, after.doc);
						if (!range) return mapped;
						const from = Math.max(0, range.from - 1);
						const to = Math.min(after.doc.content.size, range.toAfter + 1);
						// Those found touch the stretch, a line just before or after it among them (one written under a page
						// line ends where the new one begins): each looked at again, not only those in the stretch.
						const stale = mapped.find(from, to);
						const start = Math.min(from, ...stale.map((line) => line.from));
						const end = Math.max(to, ...stale.map((line) => line.to));
						return mapped.remove(stale).add(after.doc, pageLines(after.doc, start, end, size));
					},
				},
				props: { decorations: (state) => pageLinesKey.getState(state) },
			}),
	);
	return [plugin, pages, linkEnds].flat();
}
